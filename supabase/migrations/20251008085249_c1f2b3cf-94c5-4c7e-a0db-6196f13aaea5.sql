-- Allow mentors to insert assignments
CREATE POLICY "Mentors can insert assignments" ON public.assignments
FOR INSERT 
WITH CHECK (get_current_user_role() = 'mentor');