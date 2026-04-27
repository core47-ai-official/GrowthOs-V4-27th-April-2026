-- Add mentor assignment tracking to assignment_submissions
-- This will help mentors see only submissions assigned to them

-- First add a mentor_id column to assignment table to track which mentor assigned the assignment
ALTER TABLE public.assignment ADD COLUMN IF NOT EXISTS assigned_by uuid;

-- Add foreign key constraint to reference the mentor who assigned it (without IF NOT EXISTS)
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_assignment_assigned_by'
    ) THEN
        ALTER TABLE public.assignment 
        ADD CONSTRAINT fk_assignment_assigned_by 
        FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Update RLS policies for assignment_submissions to allow mentors to see their assigned submissions
-- First, let's drop the existing policies if they exist
DROP POLICY IF EXISTS "Mentors can view their assigned submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Mentors can update their assigned submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Admins and superadmins can view all submissions" ON public.assignment_submissions;
DROP POLICY IF EXISTS "Admins and superadmins can update all submissions" ON public.assignment_submissions;

-- Create new policies for assignment submissions
-- Mentors can view submissions for assignments they assigned OR students assigned to them
CREATE POLICY "Mentors can view their assigned submissions" 
ON public.assignment_submissions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'mentor'
    AND (
      -- Mentor assigned this assignment
      EXISTS (
        SELECT 1 FROM public.assignment a 
        WHERE a.assignment_id = assignment_submissions.assignment_id 
        AND a.assigned_by = auth.uid()
      )
      OR
      -- Student is assigned to this mentor
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = assignment_submissions.user_id 
        AND u.mentor_id = auth.uid()
      )
    )
  )
);

-- Admins and superadmins can view all submissions
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

-- Mentors can update submissions for assignments they assigned OR students assigned to them
CREATE POLICY "Mentors can update their assigned submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role = 'mentor'
    AND (
      -- Mentor assigned this assignment
      EXISTS (
        SELECT 1 FROM public.assignment a 
        WHERE a.assignment_id = assignment_submissions.assignment_id 
        AND a.assigned_by = auth.uid()
      )
      OR
      -- Student is assigned to this mentor
      EXISTS (
        SELECT 1 FROM public.users u 
        WHERE u.id = assignment_submissions.user_id 
        AND u.mentor_id = auth.uid()
      )
    )
  )
);

-- Admins and superadmins can update all submissions
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