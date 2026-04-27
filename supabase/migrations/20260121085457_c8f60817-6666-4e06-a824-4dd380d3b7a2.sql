-- Drop the problematic policy that causes infinite recursion
DROP POLICY IF EXISTS "Mentors can view students in their courses" ON public.users;

-- Create a security definer function to check if a user is a mentor's student
-- This avoids the infinite recursion by using SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.is_mentor_student(_mentor_id uuid, _student_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM course_enrollments ce
    JOIN students s ON ce.student_id = s.id
    JOIN mentor_course_assignments mca ON (
      mca.course_id = ce.course_id OR mca.is_global = true
    )
    WHERE s.user_id = _student_user_id
    AND mca.mentor_id = _mentor_id
  );
$$;

-- Create a security definer function to check if current user is a mentor
CREATE OR REPLACE FUNCTION public.current_user_is_mentor()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'mentor'
  );
$$;

-- Create the RLS policy using the security definer functions
CREATE POLICY "Mentors can view students in their courses"
ON public.users
FOR SELECT
TO authenticated
USING (
  current_user_is_mentor() 
  AND is_mentor_student(auth.uid(), users.id)
);