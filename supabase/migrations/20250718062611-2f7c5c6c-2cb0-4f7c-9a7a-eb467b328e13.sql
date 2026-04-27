
-- Add RLS policies for modules table to allow superadmins and admins to manage modules
CREATE POLICY "Superadmins and admins can insert modules" 
  ON public.modules 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "Superadmins and admins can update modules" 
  ON public.modules 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "Superadmins and admins can delete modules" 
  ON public.modules 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );
