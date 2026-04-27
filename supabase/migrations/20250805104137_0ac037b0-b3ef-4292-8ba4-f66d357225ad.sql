-- Create the create_user_with_role database function
CREATE OR REPLACE FUNCTION public.create_user_with_role(
  target_email text,
  target_password text,
  target_role text,
  target_full_name text DEFAULT NULL,
  target_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  current_user_role text;
  user_count integer;
  result jsonb;
BEGIN
  -- Get current user count to check if this is bootstrap scenario
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  -- If no users exist, allow creation of superadmin (bootstrap scenario)
  IF user_count = 0 THEN
    IF target_role != 'superadmin' THEN
      RETURN jsonb_build_object('error', 'First user must be a superadmin');
    END IF;
    -- Skip permission check for bootstrap
  ELSE
    -- Get current user's role for permission check
    SELECT role INTO current_user_role FROM public.users WHERE id = auth.uid();
    
    IF current_user_role IS NULL THEN
      RETURN jsonb_build_object('error', 'Unauthorized: No valid session');
    END IF;
    
    -- Permission matrix check
    CASE current_user_role
      WHEN 'superadmin' THEN
        -- Superadmins can create anyone
        NULL;
      WHEN 'admin' THEN
        -- Admins can create students, mentors, enrollment_managers
        IF target_role NOT IN ('student', 'mentor', 'enrollment_manager') THEN
          RETURN jsonb_build_object('error', 'Admins cannot create ' || target_role || ' users');
        END IF;
      WHEN 'enrollment_manager' THEN
        -- Enrollment managers can only create students
        IF target_role != 'student' THEN
          RETURN jsonb_build_object('error', 'Enrollment managers can only create students');
        END IF;
      ELSE
        RETURN jsonb_build_object('error', 'Insufficient permissions to create users');
    END CASE;
  END IF;
  
  -- Validate role
  IF target_role NOT IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student') THEN
    RETURN jsonb_build_object('error', 'Invalid role: ' || target_role);
  END IF;
  
  -- Validate email format
  IF target_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('error', 'Invalid email format');
  END IF;
  
  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE email = target_email) THEN
    RETURN jsonb_build_object('error', 'User with this email already exists');
  END IF;
  
  -- Return success - the actual user creation will be handled by the edge function
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Permission check passed',
    'can_create', true
  );
END;
$$;