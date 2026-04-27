-- Fix user_security_summary issue - simplified approach

-- Step 1: Drop the problematic trigger (if it exists)
DROP TRIGGER IF EXISTS sync_user_security_summary_trigger ON public.users;

-- Step 2: Drop the sync function (if it exists)  
DROP FUNCTION IF EXISTS public.handle_user_security_sync();

-- Step 3: Drop the existing table (if it exists)
DROP TABLE IF EXISTS public.user_security_summary;

-- Step 4: Create a simple view that provides the same data
-- Note: Views inherit RLS from underlying tables, so no need to set RLS on view
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
    WHEN u.password_hash IS NOT NULL THEN 'Set'::text 
    ELSE 'Not Set'::text 
  END as password_status,
  CASE 
    WHEN u.phone IS NOT NULL THEN 'Provided'::text 
    ELSE 'Not Provided'::text 
  END as phone_status,
  u.is_temp_password
FROM public.users u;