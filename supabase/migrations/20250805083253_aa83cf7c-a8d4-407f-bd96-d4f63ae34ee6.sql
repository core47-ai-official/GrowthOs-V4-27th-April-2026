-- Add missing columns to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS dream_goal_summary TEXT,
ADD COLUMN IF NOT EXISTS shopify_credentials TEXT,
ADD COLUMN IF NOT EXISTS meta_ads_credentials TEXT,
ADD COLUMN IF NOT EXISTS lms_status TEXT DEFAULT 'inactive',
ADD COLUMN IF NOT EXISTS lms_user_id TEXT,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- Create leaderboard table
CREATE TABLE IF NOT EXISTS public.leaderboard (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

-- Enable RLS on leaderboard
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Create leaderboard policies
CREATE POLICY "Everyone can view leaderboard" ON public.leaderboard
FOR SELECT USING (true);

CREATE POLICY "System can manage leaderboard" ON public.leaderboard
FOR ALL USING (true);

-- Create installment_payments table
CREATE TABLE IF NOT EXISTS public.installment_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL,
    total_installments INTEGER NOT NULL,
    amount NUMERIC(10,2),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    payment_date TIMESTAMP WITH TIME ZONE,
    invoice_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on installment_payments
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

-- Create installment_payments policies
CREATE POLICY "Staff can manage installment payments" ON public.installment_payments
FOR ALL USING (get_current_user_role() = ANY (ARRAY['admin', 'superadmin', 'enrollment_manager']));

CREATE POLICY "Users can view their own payments" ON public.installment_payments
FOR SELECT USING (auth.uid() = user_id);

-- Add foreign key constraint to admin_logs.performed_by
ALTER TABLE public.admin_logs
ADD CONSTRAINT admin_logs_performed_by_fkey 
FOREIGN KEY (performed_by) REFERENCES public.users(id) ON DELETE SET NULL;

-- Create triggers for updated_at columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for leaderboard and installment_payments
CREATE TRIGGER update_leaderboard_updated_at
    BEFORE UPDATE ON public.leaderboard
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_installment_payments_updated_at
    BEFORE UPDATE ON public.installment_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();