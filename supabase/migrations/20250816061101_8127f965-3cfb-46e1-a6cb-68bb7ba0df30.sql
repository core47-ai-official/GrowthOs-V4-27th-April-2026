-- Remove recording_id column from assignments table
-- Recordings will be linked to assignments via available_lessons.assignment_id

ALTER TABLE public.assignments DROP COLUMN IF EXISTS recording_id;