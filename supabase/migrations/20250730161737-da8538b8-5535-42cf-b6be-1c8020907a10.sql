-- Add missing columns to users table that the code expects
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lms_status text DEFAULT 'active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fees_overdue boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_invoice_date timestamp with time zone;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_invoice_sent boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fees_due_date timestamp with time zone;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temp_password text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fees_structure text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_done boolean DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dream_goal_summary text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_suspended_date timestamp with time zone;

-- Ensure company_settings table exists with all required columns
CREATE TABLE IF NOT EXISTS public.company_settings (
  id integer PRIMARY KEY DEFAULT 1,
  company_name text NOT NULL DEFAULT 'Your Company',
  primary_phone text NOT NULL DEFAULT '',
  secondary_phone text,
  address text NOT NULL DEFAULT '',
  contact_email text NOT NULL DEFAULT '',
  company_email text,
  currency text NOT NULL DEFAULT 'USD',
  original_fee_amount numeric NOT NULL DEFAULT 3000.00,
  maximum_installment_count integer NOT NULL DEFAULT 3,
  invoice_overdue_days integer NOT NULL DEFAULT 30,
  invoice_send_gap_days integer NOT NULL DEFAULT 7,
  enable_student_signin boolean DEFAULT false,
  company_logo text,
  invoice_notes text,
  installment_plans integer[],
  invoice_from_email text,
  lms_from_email text,
  invoice_from_name text,
  lms_from_name text,
  questionnaire jsonb DEFAULT '[]'::jsonb,
  branding jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Insert default company settings if table is empty
INSERT INTO public.company_settings (id) 
SELECT 1 
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings WHERE id = 1);

-- Ensure installment_payments table exists
CREATE TABLE IF NOT EXISTS public.installment_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  installment_number integer NOT NULL,
  total_installments integer NOT NULL,
  amount numeric,
  status text DEFAULT 'paid',
  payment_date timestamp with time zone DEFAULT now(),
  invoice_id text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Add any missing tables that might be referenced
CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create views for backwards compatibility
CREATE OR REPLACE VIEW public.session_recordings AS 
SELECT * FROM public.available_lessons;

CREATE OR REPLACE VIEW public.segmented_weekly_success_sessions AS
SELECT 
  id,
  title,
  description,
  start_time,
  end_time,
  mentor_id,
  mentor_name,
  status,
  created_at,
  'weekly' as segment
FROM public.success_sessions;

-- Update RLS policies for company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for company_settings if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'Superadmins can manage company settings') THEN
    CREATE POLICY "Superadmins can manage company settings" ON public.company_settings
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'superadmin'
      )
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'company_settings' AND policyname = 'Admins can view company settings') THEN
    CREATE POLICY "Admins can view company settings" ON public.company_settings
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'superadmin')
      )
    );
  END IF;
END $$;

-- Update RLS policies for installment_payments
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_payments' AND policyname = 'Users can view their own installment payments') THEN
    CREATE POLICY "Users can view their own installment payments" ON public.installment_payments
    FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_payments' AND policyname = 'Admins can view all installment payments') THEN
    CREATE POLICY "Admins can view all installment payments" ON public.installment_payments
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'superadmin')
      )
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_payments' AND policyname = 'Admins can insert installment payments') THEN
    CREATE POLICY "Admins can insert installment payments" ON public.installment_payments
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'superadmin')
      )
    );
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'installment_payments' AND policyname = 'Admins can update installment payments') THEN
    CREATE POLICY "Admins can update installment payments" ON public.installment_payments
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'superadmin')
      )
    );
  END IF;
END $$;