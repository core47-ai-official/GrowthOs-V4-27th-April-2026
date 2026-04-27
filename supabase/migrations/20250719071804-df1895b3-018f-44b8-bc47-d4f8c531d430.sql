-- Drop the existing problematic policies
DROP POLICY IF EXISTS "Superadmins and admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Superadmins and admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Superadmins and admins can update users" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Superadmins and admins can delete users" ON public.users;

-- Create a security definer function to get current user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = '';

-- Create simple and safe RLS policies
-- Allow superadmins and admins to see all users
CREATE POLICY "Superadmins and admins can view all users" 
ON public.users 
FOR SELECT 
USING (public.get_current_user_role() IN ('superadmin', 'admin'));

-- Allow users to see their own profile
CREATE POLICY "Users can view their own profile" 
ON public.users 
FOR SELECT 
USING (auth.uid() = id);

-- Allow superadmins and admins to insert users
CREATE POLICY "Superadmins and admins can insert users" 
ON public.users 
FOR INSERT 
WITH CHECK (public.get_current_user_role() IN ('superadmin', 'admin'));

-- Allow superadmins and admins to update any user
CREATE POLICY "Superadmins and admins can update users" 
ON public.users 
FOR UPDATE 
USING (public.get_current_user_role() IN ('superadmin', 'admin'));

-- Allow users to update their own profile
CREATE POLICY "Users can update their own profile" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id);

-- Allow superadmins and admins to delete users
CREATE POLICY "Superadmins and admins can delete users" 
ON public.users 
FOR DELETE 
USING (public.get_current_user_role() IN ('superadmin', 'admin'));