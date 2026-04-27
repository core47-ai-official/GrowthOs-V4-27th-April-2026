-- Create security definer helper function to check user roles
-- This bypasses RLS on public.users to prevent policy evaluation failures
CREATE OR REPLACE FUNCTION public.has_any_role(role_codes text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role = ANY(role_codes)
  )
$$;

-- Add additional DELETE policy using security definer function
CREATE POLICY "Staff can delete success sessions (definer)"
ON public.success_sessions
FOR DELETE
TO authenticated
USING (
  public.has_any_role(ARRAY['admin', 'superadmin', 'mentor'])
);