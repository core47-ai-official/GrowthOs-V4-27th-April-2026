-- Fix student creation notification to show real user name instead of "System"
-- The issue is that auth.uid() is NULL in edge function context
-- We need to pass the actor ID through the function context

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
  -- Try to get the current actor from JWT claim or auth.uid()
  current_actor := COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), '')::uuid,
    auth.uid()
  );
  
  -- Get actor name from the performer
  IF current_actor IS NOT NULL THEN
    SELECT full_name INTO actor_name FROM public.users WHERE id = current_actor;
  END IF;
  
  -- Get student name
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