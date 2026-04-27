-- Fix ambiguous column reference by aliasing function parameters in notify_users
CREATE OR REPLACE FUNCTION public.notify_users(user_ids uuid[], template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  -- Parameter aliases to avoid ambiguity with column names
  v_user_ids alias for $1;
  v_template_key alias for $2;
  v_payload alias for $3;

  tpl record;
  uid uuid;
  inserted_ids uuid[] := '{}';
  now_ts timestamptz := now();
  p_hash text := md5(coalesce(v_payload::text,''));
  muted boolean;
  rendered_title text;
  rendered_body text;
  existing_id uuid;
begin
  -- Fetch active template
  select * into tpl
  from public.notification_templates
  where key = v_template_key and active = true
  limit 1;

  if tpl is null then
    -- No active template; nothing to do
    return inserted_ids;
  end if;

  -- Render strings using simple interpolation
  rendered_title := public.interpolate_template(tpl.title_md, v_payload);
  rendered_body  := public.interpolate_template(tpl.body_md,  v_payload);

  -- Loop over user ids
  foreach uid in array v_user_ids
  loop
    -- Check mutes
    select coalesce((ns.mutes ->> v_template_key)::boolean, false)
      into muted
      from public.notification_settings ns
      where ns.user_id = uid;

    if muted then
      continue;
    end if;

    -- Idempotency: skip if an identical payload for same template was created within last 1s
    select n.id into existing_id
    from public.notifications n
    where n.user_id = uid
      and coalesce(n.template_key, '') = coalesce(v_template_key,'')
      and coalesce(n.payload_hash, '') = coalesce(p_hash,'')
      and n.created_at > (now_ts - interval '1 second')
    limit 1;

    if existing_id is not null then
      continue;
    end if;

    -- Insert
    insert into public.notifications
      (user_id, type, channel, status, sent_at, payload, template_key, payload_hash)
    values
      (uid, v_template_key, 'in_app', 'sent', now_ts,
       jsonb_build_object(
         'title', rendered_title,
         'message', rendered_body,
         'template_key', v_template_key,
         'data', v_payload
       ),
       v_template_key,
       p_hash
      )
    returning id into existing_id;

    inserted_ids := inserted_ids || existing_id;
  end loop;

  return inserted_ids;
end;
$function$;