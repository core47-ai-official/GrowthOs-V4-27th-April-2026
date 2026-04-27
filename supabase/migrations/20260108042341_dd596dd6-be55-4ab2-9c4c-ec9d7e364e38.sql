-- Add missing drip_enabled_default column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS drip_enabled_default BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.company_settings.drip_enabled_default 
IS 'Default setting for content drip feature on new courses';