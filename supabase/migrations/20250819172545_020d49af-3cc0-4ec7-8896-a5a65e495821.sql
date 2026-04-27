-- Fix the security definer view issue
-- The user_security_summary view should not use SECURITY DEFINER
DROP VIEW IF EXISTS user_security_summary;

CREATE VIEW user_security_summary AS
SELECT 
  id,
  email,
  full_name,
  role,
  status,
  lms_status,
  created_at,
  updated_at
FROM public.users;

-- Fix the notification function to properly handle edge function context
-- The issue is that when called from edge functions, we need to pass the current user context
CREATE OR REPLACE FUNCTION public.notify_on_student_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  actor_name text;
  student_name text;
  payload jsonb;
  current_actor uuid;
BEGIN
  -- Get the current actor from JWT or auth context
  -- First try auth.uid(), then fall back to JWT claim
  current_actor := auth.uid();
  
  IF current_actor IS NULL THEN
    -- Try to get from JWT claim context
    BEGIN
      current_actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    EXCEPTION
      WHEN OTHERS THEN
        current_actor := NULL;
    END;
  END IF;
  
  -- Get actor name from the current user
  IF current_actor IS NOT NULL THEN
    SELECT full_name INTO actor_name FROM public.users WHERE id = current_actor;
  END IF;
  
  -- Get student name from the new student record
  SELECT full_name INTO student_name FROM public.users WHERE id = NEW.user_id;

  payload := jsonb_build_object(
    'added_by_name', COALESCE(actor_name, 'System'),
    'student_name',  COALESCE(student_name, 'New student'),
    'program_name',  COALESCE((SELECT company_name FROM public.company_settings WHERE id = 1), 'Program'),
    'student_id',    COALESCE(NEW.id::text, NULL)
  );

  PERFORM public.notify_roles(ARRAY['admin','superadmin'], 'student_added', payload);
  RETURN NEW;
END;
$function$;