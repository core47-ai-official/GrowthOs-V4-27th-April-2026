-- Allow students to update their own onboarding fields safely
-- Ensure RLS is enabled (it already is, but keep for idempotency)
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to UPDATE their own student row (for onboarding completion)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'students' AND policyname = 'Students can update their own onboarding status'
  ) THEN
    CREATE POLICY "Students can update their own onboarding status"
    ON public.students
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Optional but recommended: ensure updated_at is maintained automatically on updates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_students_updated_at'
  ) THEN
    CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Ensure the authenticated role can perform UPDATEs (RLS still enforces row ownership)
DO $$
BEGIN
  -- This grant is idempotent; repeating it is harmless
  GRANT UPDATE ON public.students TO authenticated;
EXCEPTION WHEN others THEN
  -- Ignore if role/privilege already set by platform defaults
  NULL;
END $$;