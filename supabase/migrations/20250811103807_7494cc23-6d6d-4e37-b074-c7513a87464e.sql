-- 1) Create recording_ratings table for student video ratings
CREATE TABLE IF NOT EXISTS public.recording_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  lesson_title text,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_recording_ratings_unique UNIQUE (recording_id, student_id)
);

-- Enable RLS
ALTER TABLE public.recording_ratings ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recording_ratings_recording_id ON public.recording_ratings(recording_id);
CREATE INDEX IF NOT EXISTS idx_recording_ratings_student_id ON public.recording_ratings(student_id);
CREATE INDEX IF NOT EXISTS idx_recording_ratings_created_at ON public.recording_ratings(created_at DESC);

-- Update timestamp trigger
DO $$ BEGIN
  CREATE TRIGGER trg_update_recording_ratings_updated_at
  BEFORE UPDATE ON public.recording_ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN
  -- trigger already exists
  NULL;
END $$;

-- RLS policies for recording_ratings
DROP POLICY IF EXISTS "Students can insert their own recording ratings" ON public.recording_ratings;
CREATE POLICY "Students can insert their own recording ratings"
ON public.recording_ratings
FOR INSERT
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Students can update their own recording ratings" ON public.recording_ratings;
CREATE POLICY "Students can update their own recording ratings"
ON public.recording_ratings
FOR UPDATE
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "Users can view their own recording ratings" ON public.recording_ratings;
CREATE POLICY "Users can view their own recording ratings"
ON public.recording_ratings
FOR SELECT
USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "Staff can view all recording ratings" ON public.recording_ratings;
CREATE POLICY "Staff can view all recording ratings"
ON public.recording_ratings
FOR SELECT
USING (public.get_current_user_role() = ANY (ARRAY['admin','superadmin','mentor','enrollment_manager']));

DROP POLICY IF EXISTS "Admins can delete any recording rating" ON public.recording_ratings;
CREATE POLICY "Admins can delete any recording rating"
ON public.recording_ratings
FOR DELETE
USING (public.get_current_user_role() = ANY (ARRAY['admin','superadmin']));

-- 2) Allow Admin/Superadmin to manage available_lessons (recordings)
DROP POLICY IF EXISTS "Admins can manage available lessons" ON public.available_lessons;
CREATE POLICY "Admins can manage available lessons"
ON public.available_lessons
FOR ALL
USING (public.get_current_user_role() = ANY (ARRAY['admin','superadmin']))
WITH CHECK (public.get_current_user_role() = ANY (ARRAY['admin','superadmin']));

-- 3) Safe server-side completion check and limited self-update policy for users.status
CREATE OR REPLACE FUNCTION public.has_completed_all_modules(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  incomplete_count int;
BEGIN
  -- If there are no lessons, do not allow completion
  IF (SELECT COUNT(*) FROM public.available_lessons) = 0 THEN
    RETURN false;
  END IF;

  -- All recordings must be watched
  SELECT COUNT(*) INTO incomplete_count
  FROM public.available_lessons al
  WHERE NOT public.is_recording_watched(_user_id, al.id);

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  -- All linked assignments must be approved
  SELECT COUNT(*) INTO incomplete_count
  FROM public.assignments a
  WHERE a.recording_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.assignment_id = a.id
        AND s.student_id = _user_id
        AND s.status = 'approved'
    );

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Policy to allow students to set status to Completed only when eligible
DROP POLICY IF EXISTS "Students can set status completed when eligible" ON public.users;
CREATE POLICY "Students can set status completed when eligible"
ON public.users
FOR UPDATE
USING (
  auth.uid() = id
  AND public.has_completed_all_modules(auth.uid())
)
WITH CHECK (
  auth.uid() = id
  AND status = 'Passed out / Completed'
  AND public.has_completed_all_modules(auth.uid())
);
