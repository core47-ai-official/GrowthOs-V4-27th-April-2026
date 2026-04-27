-- Add RLS policy to allow mentors to view students in their assigned courses
CREATE POLICY "Mentors can view students in their courses"
ON public.users
FOR SELECT
TO authenticated
USING (
  -- Check if current user is a mentor
  (SELECT role FROM public.users WHERE id = auth.uid()) = 'mentor'
  AND
  -- Check if target user is a student in mentor's courses
  EXISTS (
    SELECT 1 FROM course_enrollments ce
    JOIN students s ON ce.student_id = s.id
    JOIN mentor_course_assignments mca ON (
      mca.course_id = ce.course_id OR mca.is_global = true
    )
    WHERE s.user_id = users.id
    AND mca.mentor_id = auth.uid()
  )
);