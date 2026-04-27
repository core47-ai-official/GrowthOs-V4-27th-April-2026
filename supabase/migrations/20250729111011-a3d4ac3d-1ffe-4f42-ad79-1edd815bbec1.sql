-- Add missing column for reviewer notes
ALTER TABLE public.assignment_submissions 
ADD COLUMN IF NOT EXISTS reviewed_note text;

-- Create function for approving/declining submissions
CREATE OR REPLACE FUNCTION public.fn_approve_submission(
  p_submission_id uuid,
  p_decision text,
  p_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_user_role text;
  v_submission_mentor_id uuid;
  v_submission_user_id uuid;
  v_result json;
BEGIN
  -- Get current user role
  SELECT role INTO v_current_user_role
  FROM public.users 
  WHERE id = auth.uid();
  
  -- Get submission details
  SELECT s.user_id INTO v_submission_user_id
  FROM public.assignment_submissions s
  WHERE s.id = p_submission_id;
  
  -- Get student's mentor_id
  SELECT u.mentor_id INTO v_submission_mentor_id
  FROM public.users u
  WHERE u.id = v_submission_user_id;
  
  -- Check permissions
  IF v_current_user_role IN ('admin', 'superadmin') THEN
    -- Admins and superadmins can approve any submission
    NULL;
  ELSIF v_current_user_role = 'mentor' AND auth.uid() = v_submission_mentor_id THEN
    -- Mentors can only approve submissions from their assigned students
    NULL;
  ELSE
    -- No permission
    RETURN json_build_object(
      'success', false,
      'error', 'You are not authorized to review this submission'
    );
  END IF;
  
  -- Validate decision
  IF p_decision NOT IN ('accepted', 'rejected') THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Invalid decision. Must be "accepted" or "rejected"'
    );
  END IF;
  
  -- Update the submission
  UPDATE public.assignment_submissions
  SET 
    status = p_decision,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    reviewed_note = p_note
  WHERE id = p_submission_id;
  
  -- Return success
  v_result := json_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'status', p_decision,
    'reviewed_by', auth.uid(),
    'reviewed_at', NOW()
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;