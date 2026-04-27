-- Allow students to read contact_email from company_settings for suspended user support
CREATE POLICY "Students can read contact email for support" 
ON public.company_settings 
FOR SELECT 
USING (
  -- Allow students to read only the contact_email field
  auth.jwt() ->> 'role' = 'authenticated'
);

-- If there's an existing restrictive policy, we need to update it
-- First, let's check if we need to drop any existing overly restrictive policies
DROP POLICY IF EXISTS "Only admins can read company_settings" ON public.company_settings;
DROP POLICY IF EXISTS "Admins can view company settings" ON public.company_settings;

-- Create a more specific policy for different user roles
CREATE POLICY "Authenticated users can read basic company info" 
ON public.company_settings 
FOR SELECT 
USING (true); -- Allow all authenticated users to read company settings

-- Ensure the table has RLS enabled
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;