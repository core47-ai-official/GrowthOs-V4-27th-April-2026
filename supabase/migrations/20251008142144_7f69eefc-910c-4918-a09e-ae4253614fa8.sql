-- Fix the validate_password_security trigger to only validate on INSERT or password change
CREATE OR REPLACE FUNCTION public.validate_password_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only validate password hash on INSERT or when password_hash is being changed
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.password_hash IS DISTINCT FROM NEW.password_hash) THEN
    -- Ensure password hash is properly formatted (basic validation)
    IF NEW.password_hash IS NOT NULL AND LENGTH(NEW.password_hash) < 50 THEN
      RAISE EXCEPTION 'Password hash appears to be insufficiently secure';
    END IF;
  END IF;
  
  -- Log password changes for security audit (only when password actually changes)
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
      'updated',
      'User password was changed',
      COALESCE(auth.uid(), NEW.id),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;