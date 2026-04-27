-- Add sequential unlock feature flag to company_settings (additive only)
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS lms_sequential_unlock boolean DEFAULT false;

-- Add version tracking to submissions for resubmission history (additive only)
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;

-- Add fees_cleared flag to students table (additive only)  
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS fees_cleared boolean DEFAULT false;

-- Create index for better performance on submissions version queries
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_version 
ON public.submissions(assignment_id, student_id, version DESC);

-- Add comment to clarify the new sequential unlock behavior
COMMENT ON COLUMN public.company_settings.lms_sequential_unlock IS 
'When enabled, enforces sequential unlock: students must complete recordings and assignments in order. When disabled, uses existing unlock behavior.';