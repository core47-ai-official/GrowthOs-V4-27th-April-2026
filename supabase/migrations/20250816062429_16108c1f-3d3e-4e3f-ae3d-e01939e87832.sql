-- Drop and recreate the function with the new return type
DROP FUNCTION IF EXISTS public.get_sequential_unlock_status(uuid);

-- Create the updated sequential unlock status function
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