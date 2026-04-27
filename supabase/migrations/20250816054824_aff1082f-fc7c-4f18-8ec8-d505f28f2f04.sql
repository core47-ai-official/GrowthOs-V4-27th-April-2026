-- Remove feature flag dependency and hardcode sequential unlock behavior
-- Update get_sequential_unlock_status to always enforce sequential behavior with fee requirement

CREATE OR REPLACE FUNCTION public.get_sequential_unlock_status(p_user_id uuid)
 RETURNS TABLE(recording_id uuid, sequence_order integer, is_unlocked boolean, unlock_reason text, assignment_required boolean, assignment_completed boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  fees_cleared boolean := false;
  current_sequence integer := 1;
  prev_assignment_completed boolean := true;
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
      
      -- Determine unlock status (HARDCODED SEQUENTIAL LOGIC)
      IF current_sequence = 1 THEN
        -- First recording: only unlock if fees are cleared
        IF fees_cleared THEN
          should_unlock := true;
          reason := 'First recording - unlocked after fees cleared';
        ELSE
          should_unlock := false;
          reason := 'Payment required to unlock first recording';
        END IF;
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

-- Ensure first recording is unlocked when fees are cleared
CREATE OR REPLACE FUNCTION public.initialize_first_recording_unlock(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  first_recording_id uuid;
  fees_cleared boolean := false;
BEGIN
  -- Check if fees are cleared
  SELECT COALESCE(s.fees_cleared, false) INTO fees_cleared
  FROM public.students s WHERE s.user_id = p_user_id;
  
  -- Only proceed if fees are cleared
  IF NOT fees_cleared THEN
    RETURN;
  END IF;
  
  -- Get the first recording in sequence
  SELECT id INTO first_recording_id
  FROM public.available_lessons
  WHERE sequence_order IS NOT NULL
  ORDER BY sequence_order ASC
  LIMIT 1;
  
  -- If no recordings with sequence order, get the first one by title
  IF first_recording_id IS NULL THEN
    SELECT id INTO first_recording_id
    FROM public.available_lessons
    ORDER BY recording_title ASC
    LIMIT 1;
  END IF;
  
  -- Unlock the first recording for this student
  IF first_recording_id IS NOT NULL THEN
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, first_recording_id, true, now())
    ON CONFLICT (user_id, recording_id) 
    DO UPDATE SET is_unlocked = true, unlocked_at = now();
  END IF;
END;
$function$;

-- Create trigger to auto-unlock first recording when fees are cleared
CREATE OR REPLACE FUNCTION public.handle_fees_cleared()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Only trigger when fees_cleared changes from false to true
  IF OLD.fees_cleared = false AND NEW.fees_cleared = true THEN
    PERFORM public.initialize_first_recording_unlock(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS trigger_fees_cleared ON public.students;
CREATE TRIGGER trigger_fees_cleared
  AFTER UPDATE ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_fees_cleared();