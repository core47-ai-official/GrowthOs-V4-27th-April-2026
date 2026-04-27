-- Create new function for assignment submission approval with exact SQL as requested
CREATE OR REPLACE FUNCTION public.approve_assignment_submission(
  p_submission_id uuid,
  p_new_status text,
  p_mentor_id uuid
)
RETURNS TABLE(
  id uuid,
  user_id uuid, 
  assignment_id uuid,
  status text,
  reviewed_by uuid,
  reviewed_at timestamp without time zone,
  feedback text,
  score integer,
  submission_type text,
  text_response text,
  external_link text,
  file_url text,
  submitted_at timestamp without time zone,
  updated_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Validate status
  IF p_new_status NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status. Must be "accepted" or "rejected"';
  END IF;
  
  -- Update the submission using the exact SQL requested
  UPDATE assignment_submissions AS s
  SET
    status = p_new_status,
    reviewed_by = p_mentor_id,
    reviewed_at = NOW()
  WHERE s.id = p_submission_id;
  
  -- Return the updated row
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    s.assignment_id,
    s.status,
    s.reviewed_by,
    s.reviewed_at,
    s.feedback,
    s.score,
    s.submission_type,
    s.text_response,
    s.external_link,
    s.file_url,
    s.submitted_at,
    s.updated_at
  FROM assignment_submissions s
  WHERE s.id = p_submission_id;
END;
$$;