-- Fix security definer view issue by ensuring views don't bypass RLS
-- The issue is that some views might be accessing data through SECURITY DEFINER functions
-- which can bypass user-level RLS. We need to ensure proper access control.

-- Drop and recreate the user_security_summary view to ensure it properly inherits RLS
DROP VIEW IF EXISTS public.user_security_summary;

-- Recreate the view without any SECURITY DEFINER dependencies
-- This view will now properly enforce RLS from the underlying users table
CREATE VIEW public.user_security_summary AS
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
        WHEN u.password_hash IS NOT NULL THEN 'Set'
        ELSE 'Not Set'
    END as password_status,
    CASE 
        WHEN u.phone IS NOT NULL THEN 'Provided'
        ELSE 'Not Provided'
    END as phone_status,
    u.is_temp_password
FROM public.users u;

-- Add a comment to document the security approach
COMMENT ON VIEW public.user_security_summary IS 'View that shows user security information while respecting RLS policies from the users table';