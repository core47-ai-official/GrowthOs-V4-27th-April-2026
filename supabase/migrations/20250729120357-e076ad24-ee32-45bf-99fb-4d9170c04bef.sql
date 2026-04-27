-- Add dream_goal_summary field to users table
ALTER TABLE public.users 
ADD COLUMN dream_goal_summary TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.users.dream_goal_summary IS 'Generated summary of student dream goals from first sign-in questionnaire';