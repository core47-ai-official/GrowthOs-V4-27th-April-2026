-- PHASE 1: Critical Password Security Fixes (Fixed)
-- Remove plaintext password storage and enhance password security

-- 1. Remove the insecure password_display column
ALTER TABLE public.users DROP COLUMN IF EXISTS password_display;

-- 2. Add proper password security flags
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_reset_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_reset_expires timestamp with time zone;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_password_change timestamp with time zone DEFAULT now();

-- 3. Create secure password reset token generation function
CREATE OR REPLACE FUNCTION public.generate_password_reset_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  token text;
BEGIN
  -- Generate a cryptographically secure random token
  token := encode(gen_random_bytes(32), 'hex');
  RETURN token;
END;
$$;

-- 4. Enhanced password validation trigger (updated existing function)
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
  
  -- Update last password change timestamp
  IF TG_OP = 'UPDATE' AND OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
    NEW.last_password_change := now();
    
    -- Clear reset token if password is changed
    NEW.password_reset_token := NULL;
    NEW.password_reset_expires := NULL;
    
    -- Log password changes for security audit
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

-- 5. Restrict RLS policies for sensitive data
DROP POLICY IF EXISTS "Restrict sensitive user data access" ON public.users;

CREATE POLICY "Restrict sensitive user data access" 
ON public.users FOR SELECT 
USING (
  -- Users can see their own basic data
  (auth.uid() = id) 
  OR 
  -- Admins and superadmins can see profiles 
  (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  OR
  -- Enrollment managers can see student data
  (get_current_user_role() = 'enrollment_manager'::text AND role = 'student'::text)
  OR
  -- Mentors can see their assigned students
  (get_current_user_role() = 'mentor'::text AND mentor_id = auth.uid())
);

-- 6. Add secure integration credentials policies
CREATE POLICY "Secure integration credentials" 
ON public.integrations FOR SELECT 
USING (
  -- Users can only see their own integration data
  (auth.uid() = user_id)
  OR
  -- Admins can see all for support purposes
  (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
);

-- 7. Audit logging for credential access
CREATE OR REPLACE FUNCTION public.log_credential_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log access to sensitive credential fields
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at,
    data
  ) VALUES (
    'credential_access',
    COALESCE(NEW.user_id, OLD.user_id),
    'accessed',
    'Integration credentials accessed',
    auth.uid(),
    now(),
    jsonb_build_object(
      'source', COALESCE(NEW.source, OLD.source),
      'operation', TG_OP
    )
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for credential access logging
DROP TRIGGER IF EXISTS trigger_log_credential_access ON public.integrations;
CREATE TRIGGER trigger_log_credential_access
  AFTER SELECT ON public.integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.log_credential_access();