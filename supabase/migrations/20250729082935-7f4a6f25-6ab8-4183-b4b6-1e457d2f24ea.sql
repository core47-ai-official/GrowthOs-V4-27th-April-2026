-- First, let's check and add missing columns to users table if needed
DO $$ 
BEGIN
    -- Add lms_user_id if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lms_user_id') THEN
        ALTER TABLE public.users ADD COLUMN lms_user_id text;
    END IF;
    
    -- Add lms_password if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lms_password') THEN
        ALTER TABLE public.users ADD COLUMN lms_password text;
    END IF;
    
    -- Add lms_status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lms_status') THEN
        ALTER TABLE public.users ADD COLUMN lms_status text DEFAULT 'inactive';
    END IF;
    
    -- Add created_by if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'created_by') THEN
        ALTER TABLE public.users ADD COLUMN created_by uuid;
    END IF;
END $$;

-- Add installment_plans to company_settings if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'installment_plans') THEN
        ALTER TABLE public.company_settings ADD COLUMN installment_plans text[];
    END IF;
    
    -- Add company_email if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'company_settings' AND column_name = 'company_email') THEN
        ALTER TABLE public.company_settings ADD COLUMN company_email text;
    END IF;
END $$;

-- Make sure email is unique in users table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_unique') THEN
        ALTER TABLE public.users ADD CONSTRAINT users_email_unique UNIQUE (email);
    END IF;
END $$;

-- Insert default installment plans if none exist
INSERT INTO public.company_settings (installment_plans, company_email) 
SELECT 
    ARRAY['1_installment', '2_installments', '3_installments', '4_installments'],
    'admin@company.com'
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings WHERE installment_plans IS NOT NULL)
ON CONFLICT (id) DO UPDATE SET 
    installment_plans = COALESCE(company_settings.installment_plans, EXCLUDED.installment_plans),
    company_email = COALESCE(company_settings.company_email, EXCLUDED.company_email);