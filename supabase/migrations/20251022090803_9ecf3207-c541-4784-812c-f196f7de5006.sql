-- Add UPDATE policies for users table to allow status changes
-- Drop existing restrictive policies if any
DROP POLICY IF EXISTS "Superadmins can update users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;
DROP POLICY IF EXISTS "Enrollment managers can update students" ON public.users;

-- Create comprehensive UPDATE policies
CREATE POLICY "Superadmins can update any user"
ON public.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'superadmin'
  )
)
WITH CHECK (true);

CREATE POLICY "Admins can update non-superadmin users"
ON public.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = users.id AND role = 'superadmin'
  )
)
WITH CHECK (true);

CREATE POLICY "Enrollment managers can update student users"
ON public.users
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'enrollment_manager'
  )
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = users.id AND role = 'student'
  )
)
WITH CHECK (true);