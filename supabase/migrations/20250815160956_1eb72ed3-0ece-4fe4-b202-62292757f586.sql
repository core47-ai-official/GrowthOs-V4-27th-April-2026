-- Create a function to initialize unlock status for existing users
CREATE OR REPLACE FUNCTION public.initialize_all_users_unlocks()
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
    -- Clear existing unlock records for this user to start fresh
    DELETE FROM public.user_unlocks WHERE user_id = user_record.id;
    
    -- Initialize unlocks for this user based on their current progress
    PERFORM public.initialize_student_unlocks(user_record.id);
    
    processed_count := processed_count + 1;
  END LOOP;
  
  RETURN 'Initialized unlock status for ' || processed_count || ' students';
END;
$function$

-- Create a more comprehensive function to set unlock status based on actual progress
CREATE OR REPLACE FUNCTION public.sync_user_unlock_progress(p_user_id uuid)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  recording_record RECORD;
  should_unlock BOOLEAN;
  unlock_reason TEXT;
BEGIN
  -- Clear existing unlock records for this user
  DELETE FROM public.user_unlocks WHERE user_id = p_user_id;
  
  -- Loop through all recordings in sequence order
  FOR recording_record IN 
    SELECT al.id, al.recording_title, COALESCE(al.sequence_order, 999) as seq_order
    FROM available_lessons al
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LOOP
    -- Use the get_student_unlock_sequence function to determine if this recording should be unlocked
    SELECT is_unlocked, unlock_reason 
    INTO should_unlock, unlock_reason
    FROM public.get_student_unlock_sequence(p_user_id) 
    WHERE recording_id = recording_record.id;
    
    -- Insert the unlock record
    INSERT INTO public.user_unlocks (
      user_id, 
      recording_id, 
      is_unlocked, 
      unlocked_at,
      created_at
    ) VALUES (
      p_user_id,
      recording_record.id,
      COALESCE(should_unlock, false),
      CASE WHEN COALESCE(should_unlock, false) THEN now() ELSE NULL END,
      now()
    );
  END LOOP;
END;
$function$

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