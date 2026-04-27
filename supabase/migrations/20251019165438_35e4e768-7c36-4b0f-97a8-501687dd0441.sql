-- Add onboarding video URL to company settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS onboarding_video_url TEXT;

COMMENT ON COLUMN public.company_settings.onboarding_video_url IS 'URL of the onboarding video shown to students after completing questionnaire';

-- Add onboarding video watched flag to students
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS onboarding_video_watched BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.students.onboarding_video_watched IS 'Tracks if student has watched the mandatory onboarding video';