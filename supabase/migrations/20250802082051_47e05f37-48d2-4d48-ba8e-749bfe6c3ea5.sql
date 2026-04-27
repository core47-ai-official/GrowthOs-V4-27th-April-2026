-- Create a function to implement sequential unlock logic
CREATE OR REPLACE FUNCTION public.get_student_unlock_sequence(p_user_id uuid)
RETURNS TABLE(
  recording_id uuid,
  sequence_order integer,
  is_unlocked boolean,
  unlock_reason text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_sequence integer := 1;
  prev_assignment_approved boolean := true;
BEGIN
  -- Loop through all recordings in sequence order
  FOR recording_id, sequence_order IN 
    SELECT al.id, COALESCE(al.sequence_order, 999)
    FROM available_lessons al
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LOOP
    -- Check if this recording should be unlocked
    IF current_sequence = 1 THEN
      -- First recording is always unlocked
      RETURN QUERY SELECT recording_id, sequence_order, true, 'First recording - automatically unlocked';
    ELSIF prev_assignment_approved THEN
      -- Previous assignment was approved, unlock this recording
      RETURN QUERY SELECT recording_id, sequence_order, true, 'Previous assignment completed';
    ELSE
      -- Previous assignment not completed, lock this recording
      RETURN QUERY SELECT recording_id, sequence_order, false, 'Previous assignment not completed';
    END IF;
    
    -- Check if current recording has an assignment and if it's approved
    IF current_sequence > 1 THEN
      SELECT EXISTS(
        SELECT 1 
        FROM assignments a
        JOIN submissions s ON s.assignment_id = a.id
        WHERE a.recording_id = get_student_unlock_sequence.recording_id
        AND s.student_id = p_user_id
        AND s.status = 'approved'
      ) INTO prev_assignment_approved;
    END IF;
    
    current_sequence := current_sequence + 1;
  END LOOP;
END;
$$;