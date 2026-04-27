-- Remove mentor INSERT and DELETE permissions on recordings
DROP POLICY IF EXISTS "Mentors can insert recordings" ON public.available_lessons;
DROP POLICY IF EXISTS "Mentors can delete recordings" ON public.available_lessons;

-- Remove mentor DELETE and INSERT permissions on modules
DROP POLICY IF EXISTS "Mentors can delete modules" ON public.modules;
DROP POLICY IF EXISTS "Mentors can insert modules" ON public.modules;

-- Remove mentor DELETE and INSERT permissions on assignments
DROP POLICY IF EXISTS "Mentors can delete assignments" ON public.assignments;
DROP POLICY IF EXISTS "Mentors can insert assignments" ON public.assignments;

-- Mentors can still UPDATE recordings (except URL which is protected by trigger)
-- Mentors can still UPDATE modules
-- Mentors can still UPDATE assignments
-- Mentors can still VIEW all three tables