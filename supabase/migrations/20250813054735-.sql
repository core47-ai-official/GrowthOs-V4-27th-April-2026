-- Allow admins and superadmins to manage assignments
-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy for admins and superadmins to perform all actions
CREATE POLICY "Admins and superadmins can manage assignments"
ON public.assignments
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin','superadmin']))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin','superadmin']));