-- Add RLS policies for assignment table to allow INSERT and UPDATE operations
CREATE POLICY "Authenticated users can insert assignments" 
ON public.assignment 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update assignments" 
ON public.assignment 
FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete assignments" 
ON public.assignment 
FOR DELETE 
TO authenticated 
USING (true);