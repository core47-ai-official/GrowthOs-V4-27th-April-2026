-- Align audit function with current admin_logs schema
CREATE OR REPLACE FUNCTION public.audit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_entity uuid;
  v_desc text;
  v_data jsonb;
BEGIN
  -- Determine action and entity
  IF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_entity := OLD.id;
    v_desc := 'User row deleted';
    v_data := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_entity := NEW.id;
    v_desc := 'User row created';
    v_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_entity := NEW.id;
    v_desc := 'User row updated';
    v_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  BEGIN
    INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
    VALUES ('user', v_entity, v_action, v_desc, v_actor, now(), v_data);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit_user log failed: %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$$;