-- Update the sequential unlock system to properly handle assignment-based progression
-- This ensures assignments only unlock after recording is watched and no next recording unlocks until assignment is approved

-- Update the sequential unlock status function to include assignment status
CREATE OR REPLACE FUNCTION public.get_sequential_unlock_status(p_user_id uuid)
 RETURNS TABLE(recording_id uuid, sequence_order integer, is_unlocked boolean, unlock_reason text, assignment_required boolean, assignment_completed boolean, recording_watched boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fees_cleared boolean := false;
  current_sequence integer := 1;
  prev_assignment_completed boolean := true;
  prev_recording_watched boolean := true;
BEGIN
  -- Check if fees are cleared for this student (required for first recording unlock)
  SELECT COALESCE(s.fees_cleared, false) INTO fees_cleared
  FROM public.students s WHERE s.user_id = p_user_id;
  
  -- Loop through recordings in sequence order
  FOR recording_id, sequence_order IN 
    SELECT al.id, COALESCE(al.sequence_order, 999)
    FROM public.available_lessons al
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LOOP
    DECLARE
      has_assignment boolean := false;
      assignment_completed boolean := false;
      is_watched boolean := false;
      should_unlock boolean := false;
      reason text := '';
    BEGIN
      -- Check if recording has been watched
      SELECT EXISTS(
        SELECT 1 FROM public.recording_views rv 
        WHERE rv.user_id = p_user_id AND rv.recording_id = get_sequential_unlock_status.recording_id AND rv.watched = true
      ) INTO is_watched;
      
      -- Check if this recording has an assignment
      SELECT EXISTS(
        SELECT 1 FROM public.available_lessons al 
        WHERE al.id = get_sequential_unlock_status.recording_id AND al.assignment_id IS NOT NULL
      ) INTO has_assignment;
      
      -- Check if assignment is completed (latest submission approved)
      IF has_assignment THEN
        SELECT EXISTS(
          SELECT 1 
          FROM public.available_lessons al
          JOIN public.submissions s ON s.assignment_id = al.assignment_id
          WHERE al.id = get_sequential_unlock_status.recording_id
          AND s.student_id = p_user_id
          AND s.status = 'approved'
          AND s.version = (
            SELECT MAX(version) 
            FROM public.submissions s2 
            WHERE s2.assignment_id = al.assignment_id AND s2.student_id = p_user_id
          )
        ) INTO assignment_completed;
      ELSE
        assignment_completed := true; -- No assignment means it's considered complete
      END IF;
      
      -- Determine unlock status (SEQUENTIAL LOGIC WITH ASSIGNMENT BLOCKING)
      IF current_sequence = 1 THEN
        -- First recording: only unlock if fees are cleared
        IF fees_cleared THEN
          should_unlock := true;
          reason := 'First recording - unlocked after fees cleared';
        ELSE
          should_unlock := false;
          reason := 'Payment required to unlock first recording';
        END IF;
      ELSIF prev_assignment_completed AND prev_recording_watched THEN
        -- Previous recording was watched AND its assignment was completed
        should_unlock := true;
        reason := 'Previous recording watched and assignment completed - unlocked';
      ELSE
        should_unlock := false;
        IF NOT prev_recording_watched THEN
          reason := 'Previous recording not watched - locked';
        ELSIF NOT prev_assignment_completed THEN
          reason := 'Previous assignment not approved - locked';
        ELSE
          reason := 'Previous requirements not met - locked';
        END IF;
      END IF;
      
      -- Return row
      RETURN QUERY SELECT 
        get_sequential_unlock_status.recording_id,
        get_sequential_unlock_status.sequence_order,
        should_unlock,
        reason,
        has_assignment,
        assignment_completed,
        is_watched;
      
      -- Update state for next iteration (current recording becomes previous)
      prev_assignment_completed := assignment_completed;
      prev_recording_watched := is_watched;
      current_sequence := current_sequence + 1;
    END;
  END LOOP;
END;
$function$;

-- Update the submission approval handler to properly unlock next recording
CREATE OR REPLACE FUNCTION public.handle_sequential_submission_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_recording_id uuid;
  current_sequence_order integer;
  next_recording_id uuid;
BEGIN
  -- Only process approved submissions (and ensure it's a status change to approved)
  IF NEW.status != 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  
  -- Find the recording that has this assignment
  SELECT al.id, COALESCE(al.sequence_order, 999) INTO current_recording_id, current_sequence_order
  FROM public.available_lessons al
  WHERE al.assignment_id = NEW.assignment_id;
  
  IF current_recording_id IS NOT NULL THEN
    -- Find next recording in sequence
    SELECT al.id INTO next_recording_id
    FROM public.available_lessons al
    WHERE COALESCE(al.sequence_order, 999) > current_sequence_order
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
    LIMIT 1;
    
    -- Unlock next recording if it exists
    IF next_recording_id IS NOT NULL THEN
      INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
      VALUES (NEW.student_id, next_recording_id, true, now())
      ON CONFLICT (user_id, recording_id) 
      DO UPDATE SET is_unlocked = true, unlocked_at = now();
    END IF;
  END IF;
  
  -- Send broadcast for real-time updates
  PERFORM pg_notify('submission_approved', json_build_object(
    'student_id', NEW.student_id,
    'assignment_id', NEW.assignment_id,
    'current_recording_id', current_recording_id,
    'next_recording_id', next_recording_id,
    'sequential_mode', true
  )::text);
  
  RETURN NEW;
END;
$function$;

-- Add a function to handle recording watch events and sync unlock status
CREATE OR REPLACE FUNCTION public.handle_recording_watched()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only process when watched status changes to true
  IF NEW.watched = true AND (OLD.watched IS NULL OR OLD.watched = false) THEN
    -- Trigger a sync of unlock status for this user to ensure proper sequential flow
    PERFORM public.sync_user_unlock_progress(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for recording views to sync unlock status when recordings are watched
DROP TRIGGER IF EXISTS trigger_recording_watched ON public.recording_views;
CREATE TRIGGER trigger_recording_watched
  AFTER UPDATE OF watched ON public.recording_views
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_recording_watched();