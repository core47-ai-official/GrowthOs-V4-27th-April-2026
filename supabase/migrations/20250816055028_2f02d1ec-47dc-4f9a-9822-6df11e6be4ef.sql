-- Update submission approval trigger to always use sequential logic (hardcoded)
CREATE OR REPLACE FUNCTION public.handle_sequential_submission_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  assignment_recording_id uuid;
  next_recording_id uuid;
BEGIN
  -- Only process approved submissions
  IF NEW.status != 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  
  -- Always use sequential unlock logic (hardcoded behavior)
  SELECT recording_id INTO assignment_recording_id
  FROM public.assignments
  WHERE id = NEW.assignment_id;
  
  IF assignment_recording_id IS NOT NULL THEN
    -- Find next recording in sequence
    SELECT al.id INTO next_recording_id
    FROM public.available_lessons al
    WHERE COALESCE(al.sequence_order, 999) > (
      SELECT COALESCE(current_al.sequence_order, 999)
      FROM public.available_lessons current_al
      WHERE current_al.id = assignment_recording_id
    )
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
    LIMIT 1;
    
    -- Unlock next recording
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
    'recording_id', assignment_recording_id,
    'next_recording_id', next_recording_id,
    'sequential_mode', true
  )::text);
  
  RETURN NEW;
END;
$function$;