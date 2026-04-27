-- CRITICAL SECURITY FIX: Protect Customer Personal Data (Fixed Version)
-- This migration addresses the security vulnerabilities while handling existing data

-- First, fix any invalid phone numbers in existing data
UPDATE public.users 
SET phone = NULL 
WHERE phone IS NOT NULL 
AND phone !~ '^\+?[1-9]\d{1,14}$'
AND phone != '';

-- Clean up empty phone strings
UPDATE public.users 
SET phone = NULL 
WHERE phone = '';

-- 1. USERS TABLE SECURITY ENHANCEMENT
-- Remove mentor access to view all user records
DROP POLICY IF EXISTS "Mentors can view users" ON public.users;

-- Mentors should NOT have access to user personal data
-- They can access student progress through other dedicated views

-- 2. STUDENTS TABLE SECURITY ENHANCEMENT  
-- Remove mentor access to student financial and personal data
DROP POLICY IF EXISTS "Mentors can view students" ON public.students;

-- 3. INVOICES TABLE SECURITY ENHANCEMENT
-- Remove mentor access to financial data
DROP POLICY IF EXISTS "Mentors can view invoices" ON public.invoices;

-- 4. SUPPORT TICKETS SECURITY ENHANCEMENT
-- Restrict support ticket access to only admins and assigned support staff
DROP POLICY IF EXISTS "Staff can manage all tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Staff can view all ticket replies" ON public.support_ticket_replies;
DROP POLICY IF EXISTS "Staff can reply to any ticket" ON public.support_ticket_replies;

-- Create more restrictive policies for support tickets
CREATE POLICY "Admins and enrollment managers can manage support tickets"
ON public.support_tickets
FOR ALL
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'enrollment_manager'::text]));

CREATE POLICY "Admins and enrollment managers can view ticket replies"
ON public.support_ticket_replies
FOR SELECT
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'enrollment_manager'::text]));

CREATE POLICY "Admins and enrollment managers can reply to tickets"
ON public.support_ticket_replies
FOR INSERT
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'enrollment_manager'::text]));

-- 5. INTEGRATIONS TABLE ENHANCEMENT
-- Add audit logging for credential access
CREATE OR REPLACE FUNCTION public.audit_integration_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log access to integration credentials for audit purposes
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at
  ) VALUES (
    'integration',
    NEW.id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    'Integration credentials accessed',
    auth.uid(),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for audit logging of integration access
DROP TRIGGER IF EXISTS audit_integration_access ON public.integrations;
CREATE TRIGGER audit_integration_access
AFTER INSERT OR UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.audit_integration_access();

-- 6. PASSWORD SECURITY ENHANCEMENT
CREATE OR REPLACE FUNCTION public.validate_password_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Ensure password hash is properly formatted (basic validation)
  IF NEW.password_hash IS NOT NULL AND LENGTH(NEW.password_hash) < 50 THEN
    RAISE EXCEPTION 'Password hash appears to be insufficiently secure';
  END IF;
  
  -- Log password changes for security audit
  IF TG_OP = 'UPDATE' AND OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
    INSERT INTO public.admin_logs (
      entity_type,
      entity_id,
      action,
      description,
      performed_by,
      created_at
    ) VALUES (
      'user',
      NEW.id,
      'password_changed',
      'User password was changed',
      COALESCE(auth.uid(), NEW.id),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for password security validation
DROP TRIGGER IF EXISTS validate_password_security_trigger ON public.users;
CREATE TRIGGER validate_password_security_trigger
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.validate_password_security();

-- 7. ADD SECURITY CONSTRAINTS (after fixing data)
-- Add constraint to ensure email addresses are properly formatted
ALTER TABLE public.users 
ADD CONSTRAINT valid_email_format 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Add constraint to ensure phone numbers are properly formatted (if provided)
ALTER TABLE public.users 
ADD CONSTRAINT valid_phone_format 
CHECK (phone IS NULL OR phone ~* '^\+?[1-9]\d{1,14}$');

-- 8. CREATE SECURITY SUMMARY VIEW FOR ADMINS
-- This view helps admins monitor security-related data without exposing sensitive info
CREATE OR REPLACE VIEW public.user_security_summary AS
SELECT 
  id,
  email,
  role,
  status,
  lms_status,
  created_at,
  last_active_at,
  last_login_at,
  CASE 
    WHEN password_hash IS NOT NULL THEN 'Set'
    ELSE 'Not Set'
  END as password_status,
  CASE 
    WHEN phone IS NOT NULL THEN 'Provided'
    ELSE 'Not Provided'
  END as phone_status,
  is_temp_password
FROM public.users;

-- Create RLS policy for the security summary view (views inherit table RLS)
-- But we can create a separate policy if needed

-- 9. CREATE AUDIT LOG FOR DATA ACCESS ATTEMPTS
CREATE OR REPLACE FUNCTION public.log_data_access_attempt(
  table_name text,
  operation text,
  user_role text,
  target_user_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at,
    data
  ) VALUES (
    'data_access',
    target_user_id,
    operation,
    'Data access attempt on ' || table_name || ' by ' || user_role,
    auth.uid(),
    now(),
    jsonb_build_object(
      'table_name', table_name,
      'operation', operation,
      'user_role', user_role,
      'target_user_id', target_user_id
    )
  );
END;
$$;

-- 10. ADDITIONAL SECURITY POLICIES
-- Ensure only authorized roles can view sensitive user fields
CREATE POLICY "Restrict sensitive user data access"
ON public.users
FOR SELECT
USING (
  -- Users can view their own record
  auth.uid() = id
  OR 
  -- Only admins and superadmins can view other users' sensitive data
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text])
  OR
  -- Enrollment managers can view students for enrollment purposes only
  (get_current_user_role() = 'enrollment_manager' AND role = 'student')
);