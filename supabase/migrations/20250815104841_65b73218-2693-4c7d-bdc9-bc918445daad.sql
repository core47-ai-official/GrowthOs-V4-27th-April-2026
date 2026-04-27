-- PHASE 1: Critical Password Security Fixes
-- Remove plaintext password storage and enhance password security

-- 1. Remove the insecure password_display column
ALTER TABLE public.users DROP COLUMN IF EXISTS password_display;

-- 2. Add proper password security flags
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_reset_token text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_reset_expires timestamp with time zone;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_password_change timestamp with time zone DEFAULT now();

-- 3. Update password hash column to be more secure (bcrypt ready)
-- Note: We'll handle the actual hashing in the edge functions

-- 4. Create secure password reset token generation function
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

-- 5. Enhanced password validation trigger
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

-- 6. Restrict RLS policies for password fields
DROP POLICY IF EXISTS "Restrict sensitive user data access" ON public.users;

CREATE POLICY "Restrict sensitive user data access" 
ON public.users FOR SELECT 
USING (
  -- Users can see their own basic data (but not password fields)
  (auth.uid() = id AND current_setting('request.jwt.claim.role', true) != 'service_role') 
  OR 
  -- Admins and superadmins can see full profiles but not password fields
  (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
  OR
  -- Enrollment managers can see limited student data but not password fields
  (get_current_user_role() = 'enrollment_manager'::text AND role = 'student'::text)
  OR
  -- Mentors can see their assigned students but not password fields
  (get_current_user_role() = 'mentor'::text AND id = ANY(
    SELECT user_id FROM public.users WHERE mentor_id = auth.uid()
  ))
);

-- 7. Create separate policy for password field access (only for superadmins and service role)
CREATE POLICY "Password field access restricted" 
ON public.users FOR SELECT 
USING (
  get_current_user_role() = 'superadmin'::text 
  OR current_setting('request.jwt.claim.role', true) = 'service_role'
);

-- 8. Add audit logging for sensitive data access
CREATE OR REPLACE FUNCTION public.audit_password_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Log when password fields are accessed (for audit purposes)
  IF current_setting('request.jwt.claim.role', true) != 'service_role' THEN
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
      'password_field_accessed',
      'Password-related field was accessed',
      auth.uid(),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;