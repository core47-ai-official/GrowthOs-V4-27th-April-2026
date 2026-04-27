-- Drop the incorrect policies
DROP POLICY IF EXISTS "Staff can view all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff can update all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff can view all ticket replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Staff can reply to any ticket" ON public.ticket_replies;

-- Create correct policies referencing public.users table
CREATE POLICY "Staff can view all tickets" 
ON public.support_tickets 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'mentor')
  )
);

CREATE POLICY "Staff can update all tickets" 
ON public.support_tickets 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'mentor')
  )
);

CREATE POLICY "Staff can view all ticket replies" 
ON public.ticket_replies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'mentor')
  )
);

CREATE POLICY "Staff can reply to any ticket" 
ON public.ticket_replies 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'mentor')
  )
);