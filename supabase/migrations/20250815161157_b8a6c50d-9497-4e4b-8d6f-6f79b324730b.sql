-- Create a function to sync all users
CREATE OR REPLACE FUNCTION public.sync_all_users_unlock_progress()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  user_record RECORD;
  processed_count INTEGER := 0;
BEGIN
  -- Loop through all students
  FOR user_record IN 
    SELECT DISTINCT id FROM public.users WHERE role = 'student'
  LOOP
    -- Sync unlock progress for this user
    PERFORM public.sync_user_unlock_progress(user_record.id);
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN 'Synced unlock progress for ' || processed_count || ' students';
END;
$function$