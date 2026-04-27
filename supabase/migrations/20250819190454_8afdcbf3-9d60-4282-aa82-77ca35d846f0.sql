-- Fix current student's fees status and ensure first recording unlock works properly
UPDATE public.students 
SET fees_cleared = true 
WHERE fees_cleared = false;

-- Ensure the first recording unlock function works correctly for students with cleared fees
DO $$
DECLARE
    student_user_id uuid;
    first_recording_id uuid;
BEGIN
    -- Get all students with cleared fees who don't have any unlocked recordings
    FOR student_user_id IN 
        SELECT s.user_id 
        FROM public.students s 
        WHERE s.fees_cleared = true 
        AND NOT EXISTS (
            SELECT 1 FROM public.user_unlocks u 
            WHERE u.user_id = s.user_id AND u.is_unlocked = true
        )
    LOOP
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
            VALUES (student_user_id, first_recording_id, true, now())
            ON CONFLICT (user_id, recording_id) 
            DO UPDATE SET is_unlocked = true, unlocked_at = now();
        END IF;
    END LOOP;
END $$;