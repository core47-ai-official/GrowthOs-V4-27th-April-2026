-- Reset onboarding status for testing
UPDATE public.students SET onboarding_completed = false WHERE user_id = '1751eb11-20ff-418b-aa52-e9f621a4343c';