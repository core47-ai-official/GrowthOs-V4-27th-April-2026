-- Fix assignment_submissions RLS policies completely
-- First enable RLS if not already enabled
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Users can insert their own submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Users can update their own unreviewed submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Mentors can view their assigned submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Mentors can update their assigned submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Admins and superadmins can view all submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Admins and superadmins can update all submissions" ON public.assignment_submissions;

-- Create simplified, working policies
CREATE POLICY "Users can view their own submissions" 
ON public.assignment_submissions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own submissions" 
ON public.assignment_submissions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own unreviewed submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (
  auth.uid() = user_id 
  AND status = 'submitted'
);

CREATE POLICY "Admins and superadmins can view all submissions" 
ON public.assignment_submissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admins and superadmins can update all submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Mentors can view assigned submissions" 
ON public.assignment_submissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() 
    AND u.role = 'mentor'
  )
  AND (
    -- Mentor assigned to student
    EXISTS (
      SELECT 1 FROM public.users student
      WHERE student.id = assignment_submissions.user_id 
      AND student.mentor_id = auth.uid()
    )
    OR
    -- Mentor created the assignment
    EXISTS (
      SELECT 1 FROM public.assignment a
      WHERE a.assignment_id = assignment_submissions.assignment_id 
      AND a.assigned_by = auth.uid()
    )
  )
);

CREATE POLICY "Mentors can update assigned submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users student
    WHERE student.id = assignment_submissions.user_id 
    AND student.mentor_id = auth.uid()
  )
);