-- Phase 1: Critical Security Fixes

-- Fix RLS policies for recording_attachments table
DROP POLICY IF EXISTS "Everyone can view recording attachments" ON public.recording_attachments;

CREATE POLICY "Authenticated users can view recording attachments" 
ON public.recording_attachments 
FOR SELECT 
USING (auth.role() = 'authenticated');

-- Fix RLS policies for modules table  
DROP POLICY IF EXISTS "Everyone can view modules" ON public.modules;

CREATE POLICY "Authenticated users can view modules"
ON public.modules 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage modules"
ON public.modules 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

-- Fix RLS policies for badges table
DROP POLICY IF EXISTS "Everyone can view badges" ON public.badges;

CREATE POLICY "Authenticated users can view badges"
ON public.badges 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage badges"
ON public.badges 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

-- Fix database functions with mutable search paths
-- Update functions that don't have SET search_path TO ''

CREATE OR REPLACE FUNCTION public.update_onboarding_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

-- Update interpolate_template function to be more secure
CREATE OR REPLACE FUNCTION public.interpolate_template(t text, vars jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  k text;
  v text;
  out text := coalesce(t,'');
begin
  if vars is null then
    return out;
  end if;

  for k in select jsonb_object_keys(vars)
  loop
    v := coalesce(vars->>k, '');
    -- Sanitize output to prevent injection
    v := replace(v, '<', '&lt;');
    v := replace(v, '>', '&gt;');
    v := replace(v, '"', '&quot;');
    out := replace(out, '{'||k||'}', v);
  end loop;

  return out;
end;
$function$;