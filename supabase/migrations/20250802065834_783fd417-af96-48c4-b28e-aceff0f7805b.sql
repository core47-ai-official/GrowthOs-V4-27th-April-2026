-- Remove all email-related functionality from the database

-- Drop email queue table entirely
DROP TABLE IF EXISTS public.email_queue CASCADE;

-- Remove SMTP and email-related columns from company_settings
ALTER TABLE public.company_settings 
DROP COLUMN IF EXISTS smtp_host,
DROP COLUMN IF EXISTS smtp_port,
DROP COLUMN IF EXISTS smtp_username,
DROP COLUMN IF EXISTS smtp_password,
DROP COLUMN IF EXISTS smtp_secure,
DROP COLUMN IF EXISTS lms_from_email,
DROP COLUMN IF EXISTS lms_from_name,
DROP COLUMN IF EXISTS invoice_from_email,
DROP COLUMN IF EXISTS invoice_from_name;

-- Remove email-related functions
DROP FUNCTION IF EXISTS public.enqueue_welcome_email(uuid, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.fn_send_welcome_email();
DROP FUNCTION IF EXISTS public.fn_send_student_welcome();

-- Remove email-related triggers
DROP TRIGGER IF EXISTS tr_send_welcome_email ON public.users;
DROP TRIGGER IF EXISTS tr_send_student_welcome ON public.users;