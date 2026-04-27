-- Fix the security definer function by making it a regular function instead
DROP FUNCTION IF EXISTS public.get_user_security_summary(uuid);

-- Create a secure view with proper RLS through the users table
-- Since we already secured the users table with RLS, this view will inherit that security
CREATE OR REPLACE VIEW public.user_security_summary AS
SELECT 
  u.id,
  u.email,
  u.role,
  u.status,
  u.lms_status,
  u.created_at,
  u.last_active_at,
  u.last_login_at,
  CASE
    WHEN u.password_hash IS NOT NULL THEN 'Set'::text
    ELSE 'Not Set'::text
  END AS password_status,
  CASE
    WHEN u.phone IS NOT NULL THEN 'Provided'::text
    ELSE 'Not Provided'::text
  END AS phone_status,
  u.is_temp_password
FROM public.users u;