-- Fix remaining security issues from linter

-- 1. Fix function search paths for all functions to prevent injection attacks
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Fix other functions that may have search path issues
CREATE OR REPLACE FUNCTION public.has_completed_all_modules(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  incomplete_count int;
BEGIN
  -- If there are no lessons, do not allow completion
  IF (SELECT COUNT(*) FROM public.available_lessons) = 0 THEN
    RETURN false;
  END IF;

  -- All recordings must be watched
  SELECT COUNT(*) INTO incomplete_count
  FROM public.available_lessons al
  WHERE NOT public.is_recording_watched(_user_id, al.id);

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  -- All linked assignments must be approved
  SELECT COUNT(*) INTO incomplete_count
  FROM public.assignments a
  WHERE a.recording_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.assignment_id = a.id
        AND s.student_id = _user_id
        AND s.status = 'approved'
    );

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_recording_watched(_user_id uuid, _recording_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT watched FROM public.recording_views 
     WHERE user_id = _user_id AND recording_id = _recording_id
     LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_assignment_passed(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT status = 'approved' FROM public.submissions 
     WHERE student_id = _user_id AND assignment_id = _assignment_id
     LIMIT 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_lms_status(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(lms_status, 'inactive') FROM public.users WHERE id = user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_module_completed(_user_id uuid, _module_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE 
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_completed FROM public.user_module_progress 
     WHERE user_id = _user_id AND module_id = _module_id),
    false
  );
$$;