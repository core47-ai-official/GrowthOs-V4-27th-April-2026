-- Create function to initialize student recording unlocks on enrollment
CREATE OR REPLACE FUNCTION public.initialize_student_unlocks(p_student_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  first_recording_id uuid;
BEGIN
  -- Get the recording with the lowest sequence_order
  SELECT id INTO first_recording_id
  FROM public.available_lessons
  WHERE sequence_order IS NOT NULL
  ORDER BY sequence_order ASC
  LIMIT 1;
  
  IF first_recording_id IS NOT NULL THEN
    -- Insert unlock record for the first recording only
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_student_id, first_recording_id, true, now())
    ON CONFLICT (user_id, recording_id) 
    DO UPDATE SET is_unlocked = true, unlocked_at = now();
  END IF;
END;
$$;

-- Create function to unlock next recording when assignment is approved
CREATE OR REPLACE FUNCTION public.unlock_next_recording(p_student_id uuid, p_current_recording_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_sequence integer;
  next_recording_id uuid;
BEGIN
  -- Get the sequence order of the current recording
  SELECT sequence_order INTO current_sequence
  FROM public.available_lessons
  WHERE id = p_current_recording_id;
  
  IF current_sequence IS NOT NULL THEN
    -- Find the next recording in sequence
    SELECT id INTO next_recording_id
    FROM public.available_lessons
    WHERE sequence_order > current_sequence
    ORDER BY sequence_order ASC
    LIMIT 1;
    
    IF next_recording_id IS NOT NULL THEN
      -- Unlock the next recording
      INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
      VALUES (p_student_id, next_recording_id, true, now())
      ON CONFLICT (user_id, recording_id) 
      DO UPDATE SET is_unlocked = true, unlocked_at = now();
    END IF;
  END IF;
END;
$$;

-- Create trigger to automatically initialize unlocks for new students
CREATE OR REPLACE FUNCTION public.handle_new_student_unlock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'student' THEN
    PERFORM public.initialize_student_unlocks(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'new_student_unlock_trigger') THEN
    CREATE TRIGGER new_student_unlock_trigger
      AFTER INSERT ON public.users
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_new_student_unlock();
  END IF;
END;
$$;

-- Update submissions trigger to handle recording unlocks
CREATE OR REPLACE FUNCTION public.handle_submission_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  assignment_recording_id uuid;
BEGIN
  -- Only process when status changes to approved
  IF TG_OP = 'UPDATE' AND OLD.status != 'approved' AND NEW.status = 'approved' THEN
    -- Get the recording_id from the assignment
    SELECT recording_id INTO assignment_recording_id
    FROM public.assignments
    WHERE id = NEW.assignment_id;
    
    -- Unlock next recording if this assignment is linked to a recording
    IF assignment_recording_id IS NOT NULL THEN
      PERFORM public.unlock_next_recording(NEW.student_id, assignment_recording_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create the trigger for submission approvals
DROP TRIGGER IF EXISTS submission_approval_trigger ON public.submissions;
CREATE TRIGGER submission_approval_trigger
  AFTER UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_submission_approval();