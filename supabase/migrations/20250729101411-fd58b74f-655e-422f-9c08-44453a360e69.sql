-- Fix the ambiguous column reference in the RLS policy
DROP POLICY IF EXISTS "Users can update their own unreviewed submissions" ON public.assignment_submissions;

CREATE POLICY "Users can update their own unreviewed submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (
  (user_id = auth.uid()) 
  AND (status = 'submitted'::text) 
  AND (EXISTS (
    SELECT 1
    FROM public.assignment a
    WHERE (a.assignment_id = assignment_submissions.assignment_id) 
    AND (a.assignment_title IS NOT NULL)
  ))
);