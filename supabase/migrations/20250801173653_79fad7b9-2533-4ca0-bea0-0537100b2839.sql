-- Drop SMTP configurations table and related functions
DROP TABLE IF EXISTS public.smtp_configs CASCADE;

-- Drop SMTP-related functions
DROP FUNCTION IF EXISTS public.get_smtp_config(text);
DROP FUNCTION IF EXISTS public.update_smtp_config(text, text, integer, text, text, boolean, text);

-- Remove SMTP columns from company_settings table
ALTER TABLE public.company_settings 
DROP COLUMN IF EXISTS smtp_host,
DROP COLUMN IF EXISTS smtp_port,
DROP COLUMN IF EXISTS smtp_user,
DROP COLUMN IF EXISTS smtp_password,
DROP COLUMN IF EXISTS smtp_use_tls,
DROP COLUMN IF EXISTS invoice_smtp_host,
DROP COLUMN IF EXISTS invoice_smtp_port,
DROP COLUMN IF EXISTS invoice_smtp_user,
DROP COLUMN IF EXISTS invoice_smtp_password,
DROP COLUMN IF EXISTS invoice_smtp_use_tls;