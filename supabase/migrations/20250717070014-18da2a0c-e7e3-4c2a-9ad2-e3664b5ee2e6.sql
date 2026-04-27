-- Add lms_status column with enum values and migrate existing data
-- First, add the new lms_status column
ALTER TABLE public.users 
ADD COLUMN lms_status text CHECK (lms_status IN ('active', 'inactive', 'suspended', 'dropout', 'complete')) DEFAULT 'active';

-- Migrate existing data from lms_suspended to lms_status
UPDATE public.users 
SET lms_status = CASE 
  WHEN lms_suspended = true THEN 'suspended'
  ELSE 'active'
END;

-- Remove the old lms_suspended column
ALTER TABLE public.users 
DROP COLUMN lms_suspended;