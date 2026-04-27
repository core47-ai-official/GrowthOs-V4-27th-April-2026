-- Update audit_integration_access function to use allowed entity_type
CREATE OR REPLACE FUNCTION public.audit_integration_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Log access to integration credentials for audit purposes
  -- Use 'user' entity_type since 'integration' is not in the allowed list
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at
  ) VALUES (
    'user', -- Use 'user' instead of 'integration' to match check constraint
    NEW.user_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    'Integration credentials accessed for ' || NEW.source,
    auth.uid(),
    now()
  );
  
  RETURN NEW;
END;
$function$