-- Phase 1: Critical Safety Database Fixes
-- Complete the remaining security fixes while preserving all functionality

-- 1. Enable leaked password protection (configuration level - documented for admin)
-- Note: This needs to be enabled in Supabase Auth settings manually

-- 2. Move extensions out of public schema (if any exist)
-- Check for extensions in public schema and move them
DO $$
DECLARE
    ext_record RECORD;
BEGIN
    -- Move any extensions from public to extensions schema
    FOR ext_record IN 
        SELECT extname FROM pg_extension 
        JOIN pg_namespace ON pg_extension.extnamespace = pg_namespace.oid 
        WHERE pg_namespace.nspname = 'public'
    LOOP
        -- Create extensions schema if it doesn't exist
        CREATE SCHEMA IF NOT EXISTS extensions;
        
        -- Note: Extensions cannot be moved after installation
        -- This is documented for admin to reinstall extensions in correct schema
        RAISE NOTICE 'Extension % found in public schema. Manual reinstallation required in extensions schema.', ext_record.extname;
    END LOOP;
END $$;

-- 3. Fix remaining functions without proper search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT role FROM public.users WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.get_user_lms_status(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(lms_status, 'inactive') FROM public.users WHERE id = user_id;
$function$;

-- 4. Add comprehensive RLS policies for data protection
-- Ensure all tables have proper access controls

-- For tenants table (if not already secured)
DROP POLICY IF EXISTS "Superadmins can manage tenants" ON public.tenants;
CREATE POLICY "Superadmins can manage tenants" 
ON public.tenants 
FOR ALL
USING (get_current_user_role() = 'superadmin')
WITH CHECK (get_current_user_role() = 'superadmin');

-- For course_tracks table
DROP POLICY IF EXISTS "Everyone can view course tracks" ON public.course_tracks;
CREATE POLICY "Everyone can view course tracks" 
ON public.course_tracks 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage course tracks" 
ON public.course_tracks 
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

-- 5. Add database constraints for data integrity
-- Add NOT NULL constraints where appropriate for security
ALTER TABLE public.users 
ALTER COLUMN role SET NOT NULL,
ALTER COLUMN email SET NOT NULL,
ALTER COLUMN full_name SET NOT NULL;

-- 6. Create indexes for performance on frequently queried columns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_admin_logs_performed_by ON public.admin_logs(performed_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_views_user_recording ON public.recording_views(user_id, recording_id);

-- 7. Add data validation triggers for critical tables
CREATE OR REPLACE FUNCTION public.validate_user_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role NOT IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student') THEN
    RAISE EXCEPTION 'Invalid role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

DROP TRIGGER IF EXISTS validate_user_role_trigger ON public.users;
CREATE TRIGGER validate_user_role_trigger
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.validate_user_role();

-- 8. Secure function permissions
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_lms_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_lms_status(uuid) TO authenticated;