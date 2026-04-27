-- Add explicit DELETE policy for success_sessions
-- Supplements existing "FOR ALL" policy to ensure DELETE operations work
CREATE POLICY "Staff can delete success sessions"
ON public.success_sessions
FOR DELETE
TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin', 'superadmin', 'mentor'])
);