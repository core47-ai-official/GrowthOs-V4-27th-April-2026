
-- Add RLS policies for available_lessons table to allow superadmins and admins to manage recordings
CREATE POLICY "Superadmins and admins can insert recordings" 
  ON public.available_lessons 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "Superadmins and admins can update recordings" 
  ON public.available_lessons 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "Superadmins and admins can delete recordings" 
  ON public.available_lessons 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );
