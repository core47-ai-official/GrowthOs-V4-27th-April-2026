-- Fix infinite recursion in users table RLS policies
-- Use security definer function to check user role without recursion

-- Drop problematic policies
DROP POLICY IF EXISTS "Superadmins have full read access" ON public.users;
DROP POLICY IF EXISTS "Admins can view users except passwords" ON public.users;
DROP POLICY IF EXISTS "Enrollment managers can view users except passwords" ON public.users;
DROP POLICY IF EXISTS "Mentors can view assigned students except passwords" ON public.users;
DROP POLICY IF EXISTS "Students can view own profile except passwords" ON public.users;

-- Create or replace security definer function to get current user's role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Create new non-recursive RLS policies using the security definer function

-- 1. Superadmins can view ALL fields including passwords
CREATE POLICY "Superadmins full access"
ON public.users
FOR SELECT
USING (public.get_my_role() = 'superadmin');

-- 2. Admins can view all users (password fields handled at application level)
CREATE POLICY "Admins can view users"
ON public.users
FOR SELECT
USING (public.get_my_role() = 'admin');

-- 3. Enrollment managers can view users  
CREATE POLICY "Enrollment managers can view users"
ON public.users
FOR SELECT
USING (public.get_my_role() = 'enrollment_manager');

-- 4. Mentors can view users
CREATE POLICY "Mentors can view users"
ON public.users
FOR SELECT
USING (public.get_my_role() = 'mentor');

-- 5. Students can view their own profile
CREATE POLICY "Students can view own profile"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- Add security comments
COMMENT ON FUNCTION public.get_my_role() IS 'Security definer function to get current user role without recursion';
COMMENT ON COLUMN public.users.password_hash IS 'SENSITIVE: Should be filtered at application layer for non-superadmin users';
COMMENT ON COLUMN public.users.password_display IS 'SENSITIVE: Should be filtered at application layer for non-superadmin users';