-- Drop the existing function first
DROP FUNCTION IF EXISTS public.approve_assignment_submission(uuid, text, uuid);

-- Create the function with robust SQL validation and transaction handling
CREATE OR REPLACE FUNCTION public.approve_assignment_submission(
  p_submission_id uuid,
  p_new_status text,
  p_mentor_id uuid
)
RETURNS TABLE(
  submission_id uuid,
  assignment_id uuid,
  status text,
  reviewed_by uuid,
  reviewed_at timestamp without time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_current_user_role text;
  v_submission_mentor_id uuid;
  v_submission_user_id uuid;
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
    RAISE EXCEPTION 'You are not authorized to review this submission';
  END IF;

  -- Validate inputs first
  IF p_new_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status "%". Must be ''accepted'' or ''rejected''.', p_new_status;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM assignment_submissions WHERE id = p_submission_id) THEN
    RAISE EXCEPTION 'No submission found with id %.', p_submission_id;
  END IF;

  -- Perform the update and return results
  RETURN QUERY
  UPDATE assignment_submissions AS s
  SET
    status      = p_new_status,
    reviewed_by = p_mentor_id,
    reviewed_at = NOW()
  WHERE s.id = p_submission_id
  RETURNING
    s.id           AS submission_id,
    s.assignment_id,
    s.status,
    s.reviewed_by,
    s.reviewed_at;

END;
$$;