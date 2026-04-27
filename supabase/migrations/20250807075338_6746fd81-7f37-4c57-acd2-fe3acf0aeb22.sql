-- Phase 1: Critical Safety Database Fixes (Part 1)
-- Complete the remaining security fixes while preserving all functionality

-- 1. Fix remaining functions without proper search_path
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

-- 2. Add comprehensive RLS policies for data protection
-- For tenants table (if not already secured)
DROP POLICY IF EXISTS "Superadmins can manage tenants" ON public.tenants;
CREATE POLICY "Superadmins can manage tenants" 
ON public.tenants 
FOR ALL
USING (get_current_user_role() = 'superadmin')
WITH CHECK (get_current_user_role() = 'superadmin');

-- For course_tracks table
DROP POLICY IF EXISTS "Admins can manage course tracks" ON public.course_tracks;
CREATE POLICY "Admins can manage course tracks" 
ON public.course_tracks 
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

-- 3. Add data validation triggers for critical tables
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

-- 4. Secure function permissions
REVOKE ALL ON FUNCTION public.get_current_user_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;

REVOKE ALL ON FUNCTION public.get_user_lms_status(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_lms_status(uuid) TO authenticated;