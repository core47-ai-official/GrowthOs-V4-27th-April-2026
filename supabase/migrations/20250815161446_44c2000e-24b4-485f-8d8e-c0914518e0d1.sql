-- Fix the sync function with proper schema reference
CREATE OR REPLACE FUNCTION public.sync_user_unlock_progress(p_user_id uuid)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recording_record RECORD;
  should_unlock BOOLEAN;
  unlock_reason TEXT;
BEGIN
  -- Clear existing unlock records for this user
  DELETE FROM user_unlocks WHERE user_id = p_user_id;
  
  -- Loop through all recordings in sequence order
  FOR recording_record IN 
    SELECT al.id, al.recording_title, COALESCE(al.sequence_order, 999) as seq_order
    FROM available_lessons al
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LOOP
    -- Use the get_student_unlock_sequence function to determine if this recording should be unlocked
    SELECT is_unlocked, unlock_reason 
    INTO should_unlock, unlock_reason
    FROM get_student_unlock_sequence(p_user_id) 
    WHERE recording_id = recording_record.id;
    
    -- Insert the unlock record
    INSERT INTO user_unlocks (
      user_id, 
      recording_id, 
      is_unlocked, 
      unlocked_at,
      created_at
    ) VALUES (
      p_user_id,
      recording_record.id,
      COALESCE(should_unlock, false),
      CASE WHEN COALESCE(should_unlock, false) THEN now() ELSE NULL END,
      now()
    );
  END LOOP;
END;
$function$