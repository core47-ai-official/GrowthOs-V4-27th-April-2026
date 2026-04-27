-- Phase 2: Database Security Fixes (Final)

-- 1. Create safe view for users table (excludes sensitive password fields)
CREATE OR REPLACE VIEW public.users_safe_view AS
SELECT 
  id,
  email,
  full_name,
  role,
  status,
  lms_status,
  phone,
  created_at,
  updated_at,
  last_active_at,
  is_temp_password,
  dream_goal_summary,
  lms_user_id,
  last_login_at,
  created_by
FROM public.users;

-- Grant access to authenticated users
GRANT SELECT ON public.users_safe_view TO authenticated;

-- 2. Add JSON validation function for students.answers_json
CREATE OR REPLACE FUNCTION public.validate_json_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  -- Validate answers_json is proper JSON
  IF NEW.answers_json IS NOT NULL THEN
    BEGIN
      -- Try to access the JSON to validate it
      PERFORM NEW.answers_json::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON in answers_json column: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Create trigger to validate JSON before insert/update
DROP TRIGGER IF EXISTS validate_student_json ON public.students;
CREATE TRIGGER validate_student_json
  BEFORE INSERT OR UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_json_columns();

-- 4. Add indices for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_submissions_assignment_id ON public.submissions(assignment_id);