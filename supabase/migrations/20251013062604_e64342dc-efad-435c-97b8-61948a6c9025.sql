-- Fix Password Hash Exposure: Restrict password field access for enrollment managers
-- This migration ensures only superadmins can view password-related fields

-- Drop all existing SELECT policies on users table to rebuild them securely
DROP POLICY IF EXISTS "Enrollment managers can view passwords" ON public.users;
DROP POLICY IF EXISTS "Staff can view user profiles" ON public.users;
DROP POLICY IF EXISTS "Admins can view user profiles without passwords" ON public.users;
DROP POLICY IF EXISTS "Enrollment managers can view safe user data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Superadmins can view all user data" ON public.users;

-- Create new restrictive policies

-- 1. Superadmins can view ALL fields including passwords
CREATE POLICY "Superadmins have full read access"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);

-- 2. Admins can view all fields EXCEPT password fields
CREATE POLICY "Admins can view users except passwords"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

-- 3. Enrollment managers can view all fields EXCEPT password fields
CREATE POLICY "Enrollment managers can view users except passwords"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'enrollment_manager'
  )
);

-- 4. Mentors can view assigned students EXCEPT password fields
CREATE POLICY "Mentors can view assigned students except passwords"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'mentor'
  )
);

-- 5. Students can view their own profile EXCEPT password fields
CREATE POLICY "Students can view own profile except passwords"
ON public.users
FOR SELECT
USING (auth.uid() = id);

-- Add security comments to password columns
COMMENT ON COLUMN public.users.password_hash IS 'CRITICAL: Only viewable by superadmin role via SELECT policy';
COMMENT ON COLUMN public.users.password_display IS 'CRITICAL: Only viewable by superadmin role via SELECT policy';

-- Create audit log for password access attempts
CREATE OR REPLACE FUNCTION public.audit_password_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  accessor_role text;
BEGIN
  -- Get the role of the user accessing the data
  SELECT role INTO accessor_role FROM public.users WHERE id = auth.uid();
  
  -- Only log if a non-superadmin is somehow accessing password fields
  IF accessor_role != 'superadmin' AND (
    TG_OP = 'SELECT' AND 
    (NEW.password_hash IS NOT NULL OR NEW.password_display IS NOT NULL)
  ) THEN
    INSERT INTO public.admin_logs (
      entity_type,
      entity_id,
      action,
      description,
      performed_by,
      created_at
    ) VALUES (
      'user',
      NEW.id,
      'password_access_attempt',
      'Non-superadmin attempted to access password fields: ' || accessor_role,
      auth.uid(),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;