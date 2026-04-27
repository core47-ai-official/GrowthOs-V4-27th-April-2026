-- Update the function to use the robust SQL with validation and transaction handling
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

  -- Use the robust SQL transaction with validation
  BEGIN
    -- Validate inputs and perform update with CTEs
    WITH params AS (
      SELECT
        p_submission_id AS submission_id,
        p_new_status AS new_status,
        p_mentor_id AS mentor_id
    ),
    valid_status AS (
      SELECT
        submission_id,
        mentor_id,
        CASE
          WHEN new_status IN ('accepted','rejected') THEN new_status
          ELSE NULL
        END AS clean_status
      FROM params
    ),
    found AS (
      SELECT s.id
      FROM assignment_submissions s
      JOIN valid_status v ON s.id = v.submission_id
    ),
    validation AS (
      SELECT 
        CASE
          WHEN v.clean_status IS NULL THEN
            'Invalid status "' || params.new_status || '". Must be ''accepted'' or ''rejected''.'
          WHEN NOT EXISTS (SELECT 1 FROM found) THEN
            'No submission found with id ' || params.submission_id || '.'
          ELSE NULL
        END AS error_msg
      FROM params, valid_status v
    )
    -- Check for validation errors
    SELECT 
      CASE 
        WHEN validation.error_msg IS NOT NULL THEN
          RAISE EXCEPTION '%', validation.error_msg
        ELSE NULL
      END
    FROM validation;

    -- Perform the update and return results
    RETURN QUERY
    WITH params AS (
      SELECT
        p_submission_id AS submission_id,
        p_new_status AS new_status,
        p_mentor_id AS mentor_id
    ),
    valid_status AS (
      SELECT
        submission_id,
        mentor_id,
        CASE
          WHEN new_status IN ('accepted','rejected') THEN new_status
          ELSE NULL
        END AS clean_status
      FROM params
    )
    UPDATE assignment_submissions AS s
    SET
      status      = v.clean_status,
      reviewed_by = v.mentor_id,
      reviewed_at = NOW()
    FROM valid_status v
    WHERE s.id = v.submission_id
    RETURNING
      s.id           AS submission_id,
      s.assignment_id,
      s.status,
      s.reviewed_by,
      s.reviewed_at;

  EXCEPTION WHEN others THEN
    RAISE;
  END;
END;
$$;