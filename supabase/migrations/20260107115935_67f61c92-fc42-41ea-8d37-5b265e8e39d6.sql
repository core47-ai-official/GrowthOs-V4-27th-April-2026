-- Add announcement_banner column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS announcement_banner JSONB DEFAULT NULL;

-- Add a comment to document the expected structure
COMMENT ON COLUMN public.company_settings.announcement_banner IS 'JSON structure: { enabled: boolean, message: string, start_date: string, end_date: string, background_color: string, dismissible: boolean }';