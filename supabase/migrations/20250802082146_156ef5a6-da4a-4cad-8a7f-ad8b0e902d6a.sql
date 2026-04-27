-- Update the submission approval trigger to refresh unlock status
CREATE OR REPLACE FUNCTION public.handle_submission_approval_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  assignment_recording_id uuid;
  next_recording_id uuid;
  current_sequence integer;
BEGIN
  -- Only process when status changes to approved
  IF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    
    -- Get the recording linked to this assignment
    SELECT recording_id INTO assignment_recording_id
    FROM assignments
    WHERE id = NEW.assignment_id;
    
    IF assignment_recording_id IS NOT NULL THEN
      -- Get the sequence order of the current recording
      SELECT sequence_order INTO current_sequence
      FROM available_lessons
      WHERE id = assignment_recording_id;
      
      -- Find the next recording in sequence
      SELECT id INTO next_recording_id
      FROM available_lessons
      WHERE sequence_order > current_sequence
      ORDER BY sequence_order ASC
      LIMIT 1;
      
      -- If there's a next recording, ensure it's unlocked for this student
      IF next_recording_id IS NOT NULL THEN
        INSERT INTO user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
        VALUES (NEW.student_id, next_recording_id, true, now())
        ON CONFLICT (user_id, recording_id) 
        DO UPDATE SET is_unlocked = true, unlocked_at = now();
        
        -- Log the unlock
        INSERT INTO user_activity_logs (user_id, activity_type, metadata)
        VALUES (
          NEW.student_id,
          'recording_unlocked',
          jsonb_build_object(
            'recording_id', next_recording_id,
            'unlocked_by_assignment', NEW.assignment_id,
            'sequence_order', current_sequence + 1
          )
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop the old trigger if it exists and create the new one
DROP TRIGGER IF EXISTS handle_submission_approval ON submissions;
CREATE TRIGGER handle_submission_approval_unlock_trigger
  AFTER UPDATE ON submissions
  FOR EACH ROW
  EXECUTE FUNCTION handle_submission_approval_unlock();