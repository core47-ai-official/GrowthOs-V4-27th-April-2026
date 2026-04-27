-- Drop SMTP configuration table and related functions
DROP TRIGGER IF EXISTS audit_smtp_configs_trigger ON public.smtp_configs;
DROP FUNCTION IF EXISTS public.audit_smtp_configs();
DROP TABLE IF EXISTS public.smtp_configs;