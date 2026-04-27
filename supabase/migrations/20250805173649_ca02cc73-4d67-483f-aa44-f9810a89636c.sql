-- Add LMS URL field to company settings
ALTER TABLE public.company_settings 
ADD COLUMN lms_url text DEFAULT 'https://growthos.core47.ai';