-- Create smtp_configs table for centralized SMTP configuration
CREATE TABLE public.smtp_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  config_type TEXT NOT NULL DEFAULT 'all' CHECK (config_type IN ('all')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 587,
  username TEXT NOT NULL,
  password TEXT NOT NULL, -- Will be encrypted
  from_email TEXT NOT NULL,
  from_name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.smtp_configs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies - only superadmins can access
CREATE POLICY "Superadmins can manage SMTP configs" 
ON public.smtp_configs 
FOR ALL 
USING (get_current_user_role() = 'superadmin')
WITH CHECK (get_current_user_role() = 'superadmin');

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_smtp_configs_updated_at
BEFORE UPDATE ON public.smtp_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create audit trigger for SMTP configuration changes
CREATE OR REPLACE FUNCTION public.audit_smtp_configs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_entity_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_entity_id := OLD.id;
  END IF;

  BEGIN
    INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
    VALUES ('smtp_config', v_entity_id, v_action, 'SMTP configuration change', v_actor, now(),
            CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN 
              jsonb_build_object('host', NEW.host, 'port', NEW.port, 'from_email', NEW.from_email, 'is_active', NEW.is_active)
            ELSE 
              jsonb_build_object('host', OLD.host, 'port', OLD.port, 'from_email', OLD.from_email, 'is_active', OLD.is_active)
            END);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit log failed: %', SQLERRM;
  END;

  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$function$;

-- Create audit trigger
CREATE TRIGGER audit_smtp_configs_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.smtp_configs
FOR EACH ROW
EXECUTE FUNCTION public.audit_smtp_configs();