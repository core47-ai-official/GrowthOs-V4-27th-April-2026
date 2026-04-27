-- Add columns to students table for questionnaire answers and goal summary
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS answers_json jsonb,
ADD COLUMN IF NOT EXISTS goal_brief text;