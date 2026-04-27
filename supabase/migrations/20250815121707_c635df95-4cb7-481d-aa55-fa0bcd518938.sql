-- Reset the specific student's onboarding status to false for testing
UPDATE public.students 
SET onboarding_completed = false, updated_at = now()
WHERE user_id = '24305269-0df2-45d4-bc3e-f37850d2fc7a';