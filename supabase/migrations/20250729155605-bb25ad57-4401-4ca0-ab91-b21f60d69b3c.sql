-- Remove custom SMTP configuration fields from company_settings
ALTER TABLE public.company_settings 
DROP COLUMN IF EXISTS smtp_enabled,
DROP COLUMN IF EXISTS smtp_host,
DROP COLUMN IF EXISTS smtp_port,
DROP COLUMN IF EXISTS smtp_username,
DROP COLUMN IF EXISTS smtp_password,
DROP COLUMN IF EXISTS smtp_encryption,
DROP COLUMN IF EXISTS smtp_sender_email,
DROP COLUMN IF EXISTS smtp_sender_name;

-- Drop the sync function as it's no longer needed
DROP FUNCTION IF EXISTS public.sync_supabase_smtp_config();