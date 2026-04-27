-- Add questionnaire column to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS enable_student_signin BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS questionnaire JSONB DEFAULT '[]'::jsonb;