-- Drop the existing insecure view
DROP VIEW IF EXISTS public.user_security_summary;

-- Create a secure function to get user security summary
CREATE OR REPLACE FUNCTION public.get_user_security_summary(target_user_id uuid DEFAULT NULL)
RETURNS TABLE(
  id uuid,
  email text,
  role text,
  status text,
  lms_status text,
  created_at timestamp with time zone,
  last_active_at timestamp with time zone,
  last_login_at timestamp with time zone,
  password_status text,
  phone_status text,
  is_temp_password boolean
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
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
  FROM public.users u
  WHERE 
    -- Security check: Only allow access if user is authorized
    (
      -- User can see their own data
      (target_user_id IS NULL AND u.id = auth.uid()) OR
      (target_user_id IS NOT NULL AND target_user_id = auth.uid() AND u.id = auth.uid()) OR
      -- Admins and superadmins can see all data
      (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]) AND 
       (target_user_id IS NULL OR u.id = target_user_id))
    );
$$;