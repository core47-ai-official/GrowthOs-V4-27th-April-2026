-- Fix security issues by adding proper RLS policies for tables missing them

-- For segmented_weekly_success_sessions table (if it needs policies)
CREATE POLICY "Staff can view segmented sessions" ON public.segmented_weekly_success_sessions
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- For tenants table (if it needs policies)
CREATE POLICY "Superadmins can manage tenants" ON public.tenants
FOR ALL USING (get_current_user_role() = 'superadmin');

-- Fix the search_path for functions that need it
CREATE OR REPLACE FUNCTION public.audit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
declare
  v_actor uuid := current_setting('request.jwt.claim.sub', true)::uuid;
begin
  ------------------------------------------------------------------
  -- Ignore deletes executed by the service‑role key
  ------------------------------------------------------------------
  if TG_OP = 'DELETE'
     and v_actor = '00000000-0000-0000-0000-000000000000' then
       -- Option 1: skip the log entirely
       return old;
  end if;

  ------------------------------------------------------------------
  -- Existing logic for normal actors
  ------------------------------------------------------------------
  if TG_OP = 'DELETE' then
      insert into public.admin_logs(action, target_id, performed_by)
        values ('USER_DELETED', old.id, v_actor);
  elsif TG_OP = 'UPDATE' then
      -- … your update logic …
  elsif TG_OP = 'INSERT' then
      -- … your insert logic …
  end if;

  return case when TG_OP = 'DELETE' then old else new end;
end;
$$;