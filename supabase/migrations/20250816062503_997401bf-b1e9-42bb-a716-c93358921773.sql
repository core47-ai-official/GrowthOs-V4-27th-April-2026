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