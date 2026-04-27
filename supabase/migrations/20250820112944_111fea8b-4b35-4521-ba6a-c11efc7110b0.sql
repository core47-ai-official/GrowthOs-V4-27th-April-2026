-- Fix audit_integration_access function to handle bigint IDs properly
CREATE OR REPLACE FUNCTION public.audit_integration_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Log access to integration credentials for audit purposes
  -- Use user_id (uuid) instead of integration id (bigint) to avoid type mismatch
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at
  ) VALUES (
    'integration',
    NEW.user_id, -- Use user_id (uuid) instead of NEW.id (bigint)
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    'Integration credentials accessed for ' || NEW.source,
    auth.uid(),
    now()
  );
  
  RETURN NEW;
END;
$function$