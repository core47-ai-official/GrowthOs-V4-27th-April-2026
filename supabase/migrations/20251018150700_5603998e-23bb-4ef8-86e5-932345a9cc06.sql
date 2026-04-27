
-- Fix security definer views by making them security invoker
-- This ensures RLS policies are enforced for the querying user, not the view creator

-- Fix user_security_summary view
ALTER VIEW user_security_summary SET (security_invoker = true);

-- Fix users_safe_view
ALTER VIEW users_safe_view SET (security_invoker = true);

-- Add comment explaining the change
COMMENT ON VIEW user_security_summary IS 'View with security_invoker enabled - RLS enforced for querying user';
COMMENT ON VIEW users_safe_view IS 'View with security_invoker enabled - RLS enforced for querying user';
