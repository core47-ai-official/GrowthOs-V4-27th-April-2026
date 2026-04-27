-- Add role column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT CHECK (role IN ('student', 'admin', 'mentor', 'superadmin')) DEFAULT 'student';

-- Create invoices table for financial management
CREATE TABLE IF NOT EXISTS invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL CHECK (installment_number IN (1, 2, 3)),
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT CHECK (status IN ('pending', 'paid', 'overdue', 'failed')) DEFAULT 'pending',
    payment_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create mentor assignments table
CREATE TABLE IF NOT EXISTS mentor_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    mentor_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(mentor_id, student_id)
);

-- Add financial fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS join_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lms_access_status TEXT CHECK (lms_access_status IN ('active', 'suspended', 'blocked', 'pending')) DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS lms_start_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS lms_end_date DATE;

-- Enable RLS on new tables
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentor_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies for invoices
CREATE POLICY "Users can view own invoices" ON invoices
    FOR SELECT USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Admins can manage invoices" ON invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- RLS policies for mentor assignments
CREATE POLICY "Mentors can view their assignments" ON mentor_assignments
    FOR SELECT USING (
        auth.uid() = mentor_id OR
        auth.uid() = student_id OR
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'superadmin')
        )
    );

CREATE POLICY "Admins can manage mentor assignments" ON mentor_assignments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('admin', 'superadmin')
        )
    );

-- Function to generate invoices for new students
CREATE OR REPLACE FUNCTION generate_student_invoices(student_id UUID, join_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
DECLARE
    installment_amount DECIMAL(10,2) := 1000.00; -- Default amount, can be customized
BEGIN
    -- Generate 3 installments
    INSERT INTO invoices (user_id, installment_number, amount, due_date, issued_date)
    VALUES 
        (student_id, 1, installment_amount, join_date + INTERVAL '7 days', join_date),
        (student_id, 2, installment_amount, join_date + INTERVAL '1 month' + INTERVAL '7 days', join_date + INTERVAL '1 month'),
        (student_id, 3, installment_amount, join_date + INTERVAL '2 months' + INTERVAL '7 days', join_date + INTERVAL '2 months');
        
    -- Update user's LMS dates
    UPDATE users 
    SET 
        lms_start_date = join_date,
        lms_end_date = join_date + INTERVAL '3 months',
        join_date = generate_student_invoices.join_date
    WHERE id = student_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and update LMS access based on payment status
CREATE OR REPLACE FUNCTION update_lms_access_status()
RETURNS VOID AS $$
BEGIN
    -- Suspend access for overdue installment 2 or 3
    UPDATE users 
    SET lms_access_status = 'suspended'
    WHERE id IN (
        SELECT DISTINCT user_id 
        FROM invoices 
        WHERE installment_number IN (2, 3) 
        AND status = 'overdue'
        AND due_date < CURRENT_DATE
    ) AND lms_access_status = 'active';
    
    -- Block access for overdue installment 1
    UPDATE users 
    SET lms_access_status = 'blocked'
    WHERE id IN (
        SELECT DISTINCT user_id 
        FROM invoices 
        WHERE installment_number = 1 
        AND status = 'overdue'
        AND due_date < CURRENT_DATE
    ) AND lms_access_status IN ('pending', 'active');
    
    -- Activate access for paid installment 1
    UPDATE users 
    SET lms_access_status = 'active'
    WHERE id IN (
        SELECT DISTINCT user_id 
        FROM invoices 
        WHERE installment_number = 1 
        AND status = 'paid'
    ) AND lms_access_status = 'pending';
    
    -- Mark invoices as overdue
    UPDATE invoices 
    SET status = 'overdue' 
    WHERE status = 'pending' 
    AND due_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID DEFAULT auth.uid())
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced activity logging function
CREATE OR REPLACE FUNCTION log_user_activity_enhanced(
    p_user_id UUID,
    p_activity_type TEXT,
    p_metadata JSONB DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_activity_logs (user_id, activity_type, metadata, reference_id, occurred_at)
    VALUES (p_user_id, p_activity_type, p_metadata, p_reference_id, NOW());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically generate invoices when a student joins
CREATE OR REPLACE FUNCTION trigger_generate_invoices()
RETURNS TRIGGER AS $$
BEGIN
    -- Only for new students or when join_date is updated
    IF (NEW.role = 'student' AND OLD.role IS DISTINCT FROM 'student') 
       OR (NEW.join_date IS DISTINCT FROM OLD.join_date AND NEW.role = 'student') THEN
        PERFORM generate_student_invoices(NEW.id, COALESCE(NEW.join_date, CURRENT_DATE));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic invoice generation
DROP TRIGGER IF EXISTS auto_generate_invoices ON users;
CREATE TRIGGER auto_generate_invoices
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_invoices();