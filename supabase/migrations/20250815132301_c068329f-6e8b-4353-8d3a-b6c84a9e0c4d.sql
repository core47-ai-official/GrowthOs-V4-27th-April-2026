-- Reset students who were incorrectly marked as onboarding completed
-- These students have onboarding_completed = true but no answers_json or goal_brief
UPDATE students 
SET onboarding_completed = false, 
    updated_at = now()
WHERE onboarding_completed = true 
  AND (answers_json IS NULL OR goal_brief IS NULL);

-- Add a constraint to prevent students from being marked as onboarding completed
-- without having proper answers and goal brief
ALTER TABLE students 
ADD CONSTRAINT check_onboarding_completion 
CHECK (
  (onboarding_completed = false) OR 
  (onboarding_completed = true AND answers_json IS NOT NULL AND goal_brief IS NOT NULL)
);