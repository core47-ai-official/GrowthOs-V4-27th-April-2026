-- Fix resubmission review error by removing conflicting triggers and functions
-- that reference non-existent recording_id column in assignments table

-- Drop the conflicting triggers first
DROP TRIGGER IF EXISTS trg_submission_approval ON public.submissions;
DROP TRIGGER IF EXISTS trigger_submission_approval ON public.submissions;

-- Drop the old handle_submission_approval function that causes the error
DROP FUNCTION IF EXISTS public.handle_submission_approval();

-- The working submission_approval_trigger with handle_sequential_submission_approval
-- and update_submissions_updated_at trigger will remain intact