-- Remove all email-related functionality from the database
-- First drop triggers that depend on the functions
DROP TRIGGER IF EXISTS trigger_send_welcome_email ON public.users CASCADE;

-- Now drop functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS public.enqueue_welcome_email(uuid, text, text, text, jsonb) CASCADE;
DROP FUNCTION IF EXISTS public.fn_send_welcome_email() CASCADE;
DROP FUNCTION IF EXISTS public.fn_send_student_welcome() CASCADE;

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