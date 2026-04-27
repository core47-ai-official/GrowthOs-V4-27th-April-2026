-- Create enhanced sequential unlock function that respects feature flag
CREATE OR REPLACE FUNCTION public.get_sequential_unlock_status(p_user_id uuid)
RETURNS TABLE(
  recording_id uuid,
  sequence_order integer,
  is_unlocked boolean,
  unlock_reason text,
  assignment_required boolean,
  assignment_completed boolean
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sequential_enabled boolean := false;
  fees_cleared boolean := false;
  current_sequence integer := 1;
  prev_assignment_completed boolean := true;
BEGIN
  -- Check if sequential unlock is enabled
  SELECT COALESCE(lms_sequential_unlock, false) INTO sequential_enabled
  FROM public.company_settings WHERE id = 1;
  
  -- If sequential unlock is disabled, fall back to existing behavior
  IF NOT sequential_enabled THEN
    RETURN QUERY
    SELECT 
      get_student_unlock_sequence.recording_id,
      get_student_unlock_sequence.sequence_order,
      get_student_unlock_sequence.is_unlocked,
      get_student_unlock_sequence.unlock_reason,
      false::boolean as assignment_required,
      false::boolean as assignment_completed
    FROM public.get_student_unlock_sequence(p_user_id);
    RETURN;
  END IF;
  
  -- Check if fees are cleared for this student
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
      should_unlock boolean := false;
      reason text := '';
    BEGIN
      -- Check if this recording has an assignment
      SELECT EXISTS(
        SELECT 1 FROM public.assignments a 
        WHERE a.recording_id = get_sequential_unlock_status.recording_id
      ) INTO has_assignment;
      
      -- Check if assignment is completed (latest submission approved)
      IF has_assignment THEN
        SELECT EXISTS(
          SELECT 1 
          FROM public.assignments a
          JOIN public.submissions s ON s.assignment_id = a.id
          WHERE a.recording_id = get_sequential_unlock_status.recording_id
          AND s.student_id = p_user_id
          AND s.status = 'approved'
          AND s.version = (
            SELECT MAX(version) 
            FROM public.submissions s2 
            WHERE s2.assignment_id = a.id AND s2.student_id = p_user_id
          )
        ) INTO assignment_completed;
      ELSE
        assignment_completed := true; -- No assignment means it's considered complete
      END IF;
      
      -- Determine unlock status
      IF current_sequence = 1 AND fees_cleared THEN
        should_unlock := true;
        reason := 'First recording - unlocked after fees cleared';
      ELSIF prev_assignment_completed THEN
        should_unlock := true;
        reason := 'Previous assignment completed - unlocked';
      ELSE
        should_unlock := false;
        reason := 'Previous assignment not completed - locked';
      END IF;
      
      -- Return row
      RETURN QUERY SELECT 
        get_sequential_unlock_status.recording_id,
        get_sequential_unlock_status.sequence_order,
        should_unlock,
        reason,
        has_assignment,
        assignment_completed;
      
      -- Update state for next iteration
      prev_assignment_completed := assignment_completed;
      current_sequence := current_sequence + 1;
    END;
  END LOOP;
END;
$function$;

-- Create trigger to handle sequential unlock on submission approval
CREATE OR REPLACE FUNCTION public.handle_sequential_submission_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sequential_enabled boolean := false;
  assignment_recording_id uuid;
  next_recording_id uuid;
BEGIN
  -- Only process approved submissions
  IF NEW.status != 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  
  -- Check if sequential unlock is enabled
  SELECT COALESCE(lms_sequential_unlock, false) INTO sequential_enabled
  FROM public.company_settings WHERE id = 1;
  
  -- If sequential unlock disabled, use existing logic
  IF NOT sequential_enabled THEN
    -- Get the recording_id from the assignment
    SELECT recording_id INTO assignment_recording_id
    FROM public.assignments
    WHERE id = NEW.assignment_id;
    
    -- Unlock next recording if this assignment is linked to a recording
    IF assignment_recording_id IS NOT NULL THEN
      PERFORM public.unlock_next_recording(NEW.student_id, assignment_recording_id);
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Sequential unlock logic: find next recording and unlock it
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
    'sequential_mode', sequential_enabled
  )::text);
  
  RETURN NEW;
END;
$function$;

-- Replace the existing trigger with the new sequential-aware one
DROP TRIGGER IF EXISTS submission_approval_trigger ON public.submissions;
CREATE TRIGGER submission_approval_trigger
  AFTER UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_sequential_submission_approval();