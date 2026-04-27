-- Initialize unlocks for all existing students
INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
SELECT 
  u.id as user_id,
  (SELECT id FROM public.available_lessons 
   WHERE sequence_order IS NOT NULL 
   ORDER BY sequence_order ASC 
   LIMIT 1) as recording_id,
  true as is_unlocked,
  now() as unlocked_at
FROM public.users u
WHERE u.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_unlocks ul 
    WHERE ul.user_id = u.id
  )
  AND (SELECT id FROM public.available_lessons WHERE sequence_order IS NOT NULL ORDER BY sequence_order ASC LIMIT 1) IS NOT NULL;