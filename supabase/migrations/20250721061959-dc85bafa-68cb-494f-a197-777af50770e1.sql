-- First, drop the existing foreign key constraint that points to auth.users
ALTER TABLE public.support_tickets 
DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;

-- Add new foreign key constraint pointing to public.users instead
ALTER TABLE public.support_tickets 
ADD CONSTRAINT support_tickets_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Do the same for ticket_replies
ALTER TABLE public.ticket_replies 
DROP CONSTRAINT IF EXISTS ticket_replies_user_id_fkey;

ALTER TABLE public.ticket_replies 
ADD CONSTRAINT ticket_replies_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Add RLS policies for support_tickets to allow admins and superadmins to view all tickets
DROP POLICY IF EXISTS "Admins and superadmins can view all support tickets" ON public.support_tickets;
CREATE POLICY "Admins and superadmins can view all support tickets" 
ON public.support_tickets 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Add RLS policies for ticket_replies to allow admins and superadmins to view all replies
DROP POLICY IF EXISTS "Admins and superadmins can view all ticket replies" ON public.ticket_replies;
CREATE POLICY "Admins and superadmins can view all ticket replies" 
ON public.ticket_replies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Allow admins and superadmins to insert replies
DROP POLICY IF EXISTS "Admins and superadmins can reply to tickets" ON public.ticket_replies;
CREATE POLICY "Admins and superadmins can reply to tickets" 
ON public.ticket_replies 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Allow admins and superadmins to update ticket status
DROP POLICY IF EXISTS "Admins and superadmins can update ticket status" ON public.support_tickets;
CREATE POLICY "Admins and superadmins can update ticket status" 
ON public.support_tickets 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);