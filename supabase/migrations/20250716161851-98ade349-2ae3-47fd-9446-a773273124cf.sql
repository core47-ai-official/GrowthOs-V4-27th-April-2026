-- Add due_days_after_unlock field to assignment table
ALTER TABLE public.assignment 
ADD COLUMN due_days_after_unlock integer DEFAULT 2;

-- Update existing records to have a default value
UPDATE public.assignment 
SET due_days_after_unlock = 2 
WHERE due_days_after_unlock IS NULL;