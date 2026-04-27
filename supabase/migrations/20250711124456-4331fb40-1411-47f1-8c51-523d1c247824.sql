-- Add a simple jsonb column to store onboarding data to avoid complex column name issues
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS onboarding_data JSONB;