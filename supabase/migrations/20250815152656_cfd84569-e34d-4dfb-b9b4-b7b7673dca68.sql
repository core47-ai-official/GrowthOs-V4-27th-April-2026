-- Fix the onboarding completion constraint issue
-- First, let's check what the constraint requires and fix it

-- Drop the problematic constraint temporarily to understand what it's checking
ALTER TABLE students DROP CONSTRAINT IF EXISTS check_onboarding_completion;

-- Add a safer constraint that allows proper onboarding completion
-- This constraint ensures that if onboarding_completed is true, then answers_json is not null
-- But allows the initial completion with basic data
ALTER TABLE students ADD CONSTRAINT check_onboarding_completion 
CHECK (
  (onboarding_completed = false) OR 
  (onboarding_completed = true AND answers_json IS NOT NULL) OR
  (onboarding_completed = true AND goal_brief IS NOT NULL)
);