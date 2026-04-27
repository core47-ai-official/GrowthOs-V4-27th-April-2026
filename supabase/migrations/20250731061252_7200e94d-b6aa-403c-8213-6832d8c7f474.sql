-- Drop existing policy first, then recreate
DROP POLICY IF EXISTS "Admins can view all unlocks" ON public.user_unlocks;

-- Add RLS policies for user_unlocks
CREATE POLICY "Admins can view all unlocks" 
ON public.user_unlocks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
));

-- Ensure the new functions are in the types
COMMENT ON FUNCTION public.update_company_branding(jsonb) IS 'Updates company branding settings';
COMMENT ON FUNCTION public.get_user_lms_status(uuid) IS 'Gets user LMS status';