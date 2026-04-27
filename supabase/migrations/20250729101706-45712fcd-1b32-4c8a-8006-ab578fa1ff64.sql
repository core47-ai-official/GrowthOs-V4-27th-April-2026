-- Fix all ambiguous column references in assignment_submissions RLS policies
-- Drop all existing policies that might have ambiguous references
DROP POLICY IF EXISTS "Users can update their own unreviewed submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Mentors can view their assigned submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Mentors can update their assigned submissions" ON public.assignment_submissions;

-- Recreate policies with proper table aliases to avoid ambiguous column references
CREATE POLICY "Users can update their own unreviewed submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (
  (user_id = auth.uid()) 
  AND (status = 'submitted'::text)
);

CREATE POLICY "Mentors can view their assigned submissions" 
ON public.assignment_submissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid() 
    AND u.role = 'mentor'
    AND (
      EXISTS (
        SELECT 1
        FROM public.assignment a
        WHERE a.assignment_id = assignment_submissions.assignment_id 
        AND a.assigned_by = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1
        FROM public.users student
        WHERE student.id = assignment_submissions.user_id 
        AND student.mentor_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "Mentors can update their assigned submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1
    FROM public.users student
    WHERE student.id = assignment_submissions.user_id 
    AND student.mentor_id = auth.uid()
  )
);