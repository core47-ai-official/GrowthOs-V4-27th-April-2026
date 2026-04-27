-- Phase 1: Complete Database Schema Redesign
-- Drop existing user-related tables and functions to start fresh

-- Drop existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS handle_submission_approval_trigger ON submissions;
DROP TRIGGER IF EXISTS notify_financial_events_trigger ON installment_payments;
DROP TRIGGER IF EXISTS notify_user_status_changes_trigger ON users;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.create_student_atomic(uuid, text, text, text, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_student_atomic(text, text, text, integer, uuid, uuid);
DROP FUNCTION IF EXISTS public.create_student_complete(text, text, text, text, text, uuid, uuid, uuid);
DROP FUNCTION IF EXISTS public.delete_student_atomic(uuid);
DROP FUNCTION IF EXISTS public.generate_student_id();
DROP FUNCTION IF EXISTS public.notify_admins_user_created();
DROP FUNCTION IF EXISTS public.enqueue_student_onboarding_jobs(uuid);
DROP FUNCTION IF EXISTS public.initialize_student_unlocks(uuid);

-- Drop existing user-related tables
DROP TABLE IF EXISTS student_onboarding_jobs CASCADE;
DROP TABLE IF EXISTS onboarding_responses CASCADE;
DROP TABLE IF EXISTS user_unlocks CASCADE;
DROP TABLE IF EXISTS installment_payments CASCADE;
DROP TABLE IF EXISTS user_module_progress CASCADE;
DROP TABLE IF EXISTS user_activity_logs CASCADE;
DROP TABLE IF EXISTS mentorship_notes CASCADE;
DROP TABLE IF EXISTS user_badges CASCADE;
DROP TABLE IF EXISTS recording_views CASCADE;
DROP TABLE IF EXISTS quiz_attempts CASCADE;
DROP TABLE IF EXISTS progress CASCADE;
DROP TABLE IF EXISTS feedback CASCADE;
DROP TABLE IF EXISTS session_attendance CASCADE;
DROP TABLE IF EXISTS performance_record CASCADE;
DROP TABLE IF EXISTS user_segments CASCADE;
DROP TABLE IF EXISTS assignment_submissions CASCADE;
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS certificates CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS ticket_replies CASCADE;
DROP TABLE IF EXISTS support_tickets CASCADE;
DROP TABLE IF EXISTS leaderboard CASCADE;

-- Drop the main users table last (due to foreign key dependencies)
DROP TABLE IF EXISTS users CASCADE;

-- Drop custom types
DROP TYPE IF EXISTS onboarding_step CASCADE;
DROP TYPE IF EXISTS onboarding_status CASCADE;

-- Create new clean schema

-- 1. Installment Plans Table
CREATE TABLE installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  total_amount DECIMAL(10,2) NOT NULL,
  num_installments INTEGER NOT NULL CHECK (num_installments > 0),
  interval_days INTEGER NOT NULL CHECK (interval_days > 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Clean Users Table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student')),
  password_hash TEXT NOT NULL,
  password_display TEXT NOT NULL, -- Visible password for admin use
  is_temp_password BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES users(id),
  last_login_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Students Table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  installment_plan_id UUID REFERENCES installment_plans(id),
  lms_username TEXT NOT NULL, -- Always the email
  student_id TEXT UNIQUE, -- Generated student ID (STU000001, etc.)
  enrollment_date TIMESTAMPTZ DEFAULT now(),
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Invoices Table
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  first_reminder_sent BOOLEAN DEFAULT false,
  second_reminder_sent BOOLEAN DEFAULT false,
  first_reminder_sent_at TIMESTAMPTZ,
  second_reminder_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_invoices_student_id ON invoices(student_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Row Level Security Policies

-- Users table policies
CREATE POLICY "Superadmins have full access to users" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
  );

CREATE POLICY "Admins and enrollment managers can manage users" ON users
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'enrollment_manager'))
  );

CREATE POLICY "Mentors can view users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'mentor')
  );

CREATE POLICY "Users can view their own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own password" ON users
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Installment plans policies
CREATE POLICY "Superadmins can manage installment plans" ON installment_plans
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
  );

CREATE POLICY "Staff can view installment plans" ON installment_plans
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'enrollment_manager', 'mentor'))
  );

-- Students table policies
CREATE POLICY "Superadmins have full access to students" ON students
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
  );

CREATE POLICY "Admins and enrollment managers can manage students" ON students
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'enrollment_manager'))
  );

CREATE POLICY "Mentors can view students" ON students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'mentor')
  );

CREATE POLICY "Students can view their own record" ON students
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.id = students.user_id)
  );

-- Invoices table policies
CREATE POLICY "Superadmins have full access to invoices" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'superadmin')
  );

CREATE POLICY "Admins and enrollment managers can manage invoices" ON invoices
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'enrollment_manager'))
  );

CREATE POLICY "Mentors can view invoices" ON invoices
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'mentor')
  );

CREATE POLICY "Students can view their own invoices" ON invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM students s 
      JOIN users u ON u.id = s.user_id 
      WHERE u.id = auth.uid() AND s.id = invoices.student_id
    )
  );

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_installment_plans_updated_at BEFORE UPDATE ON installment_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate student ID
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.student_id IS NULL THEN
    NEW.student_id := 'STU' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1
       FROM students 
       WHERE student_id IS NOT NULL)::TEXT, 
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_student_id_trigger BEFORE INSERT ON students
  FOR EACH ROW EXECUTE FUNCTION generate_student_id();

-- Insert default installment plans
INSERT INTO installment_plans (name, total_amount, num_installments, interval_days) VALUES
('Single Payment', 3000.00, 1, 0),
('2 Installments', 3000.00, 2, 30),
('3 Installments', 3000.00, 3, 30),
('4 Installments', 3000.00, 4, 30);

-- Create a default superadmin user (you'll need to update this with real credentials)
INSERT INTO users (email, full_name, role, password_hash, password_display, is_temp_password, created_at)
VALUES (
  'admin@growthops.com',
  'System Administrator', 
  'superadmin',
  '$2a$10$placeholder.hash.here',
  'Admin123!',
  true,
  now()
);