-- Drop existing function with same signature to avoid parameter name conflict
DROP FUNCTION IF EXISTS public.unlock_next_recording(uuid, uuid);

-- Recreate function to unlock the next recording in sequence for a user
CREATE FUNCTION public.unlock_next_recording(p_user_id uuid, p_current_recording_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  curr_order integer;
  curr_title text;
  next_rec_id uuid;
BEGIN
  -- Get current recording order and title
  SELECT COALESCE(sequence_order, 999), COALESCE(recording_title, '')
  INTO curr_order, curr_title
  FROM public.available_lessons
  WHERE id = p_current_recording_id;

  IF curr_order IS NULL THEN
    RETURN;
  END IF;

  -- Find the next recording in the global sequence
  SELECT al.id INTO next_rec_id
  FROM public.available_lessons al
  WHERE 
    COALESCE(al.sequence_order, 999) > curr_order
    OR (
      COALESCE(al.sequence_order, 999) = curr_order 
      AND COALESCE(al.recording_title, '') > curr_title
    )
  ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LIMIT 1;

  -- If no next recording, nothing to unlock
  IF next_rec_id IS NULL THEN
    RETURN;
  END IF;

  -- Upsert-like behavior without requiring unique constraint
  IF EXISTS (
    SELECT 1 FROM public.user_unlocks 
    WHERE user_id = p_user_id AND recording_id = next_rec_id
  ) THEN
    UPDATE public.user_unlocks
    SET is_unlocked = true, unlocked_at = now()
    WHERE user_id = p_user_id AND recording_id = next_rec_id;
  ELSE
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, next_rec_id, true, now());
  END IF;
END;
$$;

-- Ensure submissions trigger calls the approval handler
DROP TRIGGER IF EXISTS trg_submission_approval ON public.submissions;
CREATE TRIGGER trg_submission_approval
AFTER UPDATE ON public.submissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_submission_approval();