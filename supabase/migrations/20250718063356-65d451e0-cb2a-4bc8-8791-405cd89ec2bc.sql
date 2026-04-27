-- Add RLS policies for success_sessions table to allow superadmins and admins to manage sessions
CREATE POLICY "Superadmins and admins can insert success sessions" 
  ON public.success_sessions 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "Superadmins and admins can update success sessions" 
  ON public.success_sessions 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );

CREATE POLICY "Superadmins and admins can delete success sessions" 
  ON public.success_sessions 
  FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('superadmin', 'admin')
    )
  );