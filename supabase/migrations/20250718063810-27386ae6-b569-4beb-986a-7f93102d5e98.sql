-- Add RLS policy to allow superadmins to view all support tickets
CREATE POLICY "Superadmins can view all support tickets" 
  ON public.support_tickets 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
    )
  );

-- Add RLS policy to allow superadmins to view all ticket replies  
CREATE POLICY "Superadmins can view all ticket replies" 
  ON public.ticket_replies 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
    )
  );

-- Add RLS policy to allow superadmins to reply to any ticket
CREATE POLICY "Superadmins can reply to any ticket" 
  ON public.ticket_replies 
  FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
    )
  );

-- Add RLS policy to allow superadmins to update any support ticket
CREATE POLICY "Superadmins can update any support ticket" 
  ON public.support_tickets 
  FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
    )
  );