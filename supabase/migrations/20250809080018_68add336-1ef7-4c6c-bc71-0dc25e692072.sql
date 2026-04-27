
-- 1) Tables -------------------------------------------------------------------

-- notification_templates: config-driven templates
create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title_md text not null,
  body_md text not null,
  variables text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_templates enable row level security;

-- Admins/superadmins can manage templates
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='notification_templates' and policyname='Admins can manage notification templates'
  ) then
    create policy "Admins can manage notification templates"
      on public.notification_templates
      for all
      using (public.get_current_user_role() in ('admin','superadmin'))
      with check (public.get_current_user_role() in ('admin','superadmin'));
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='notification_templates' and policyname='Admins can read notification templates'
  ) then
    create policy "Admins can read notification templates"
      on public.notification_templates
      for select
      using (public.get_current_user_role() in ('admin','superadmin'));
  end if;
end$$;

-- Audit template changes into admin_logs
create or replace function public.audit_notification_templates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'template_created';
    v_entity_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_action := 'template_updated';
    v_entity_id := new.id;
    new.updated_at := now();
  elsif tg_op = 'DELETE' then
    v_action := 'template_deleted';
    v_entity_id := old.id;
  end if;

  begin
    insert into public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
    values ('notification_template', v_entity_id, v_action, 'Notification template change', v_actor, now(),
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else to_jsonb(old) end);
  exception when others then
    raise notice 'audit log failed: %', sqlerrm;
  end;

  return case when tg_op='DELETE' then old else new end;
end;
$fn$;

drop trigger if exists trg_audit_notification_templates on public.notification_templates;
create trigger trg_audit_notification_templates
after insert or update or delete on public.notification_templates
for each row execute procedure public.audit_notification_templates();


-- notification_settings: per-user mutes { "template_key": true }
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  mutes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

-- Policies: users manage their own settings; admins/superadmins manage all
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='notification_settings' and policyname='Users can manage their own notification settings'
  ) then
    create policy "Users can manage their own notification settings"
      on public.notification_settings
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies 
    where schemaname='public' and tablename='notification_settings' and policyname='Admins can manage notification settings'
  ) then
    create policy "Admins can manage notification settings"
      on public.notification_settings
      for all
      using (public.get_current_user_role() in ('admin','superadmin'))
      with check (public.get_current_user_role() in ('admin','superadmin'));
  end if;
end$$;


-- 2) Extend existing notifications table -------------------------------------

-- Add columns for template mode + idempotency
alter table public.notifications
  add column if not exists template_key text,
  add column if not exists read_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists payload_hash text;

-- Status compatibility note:
-- We retain status='sent' as "unread" to avoid breaking existing UI.
-- We'll continue to set status='sent' on insert and update to 'read' when read.

-- Helpful indexes
create index if not exists idx_notifications_user_created_at
  on public.notifications (user_id, created_at desc);

create index if not exists idx_notifications_template_key
  on public.notifications (template_key);

-- Partial index for unread (status='sent')
create index if not exists idx_notifications_unread
  on public.notifications (user_id)
  where status = 'sent';


-- 3) Helper functions ---------------------------------------------------------

-- Simple {var} interpolation for markdown templates
create or replace function public.interpolate_template(t text, vars jsonb)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $fn$
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
    out := replace(out, '{'||k||'}', v);
  end loop;

  return out;
end;
$fn$;


-- Resolve users by role (from public.users.role)
create or replace function public.get_users_by_role(role_code text)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id::uuid
  from public.users
  where role = role_code
$$;


-- Insert notifications for explicit user ids (respects mutes + idempotency)
create or replace function public.notify_users(user_ids uuid[], template_key text, payload jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  tpl record;
  uid uuid;
  inserted_ids uuid[] := '{}';
  now_ts timestamptz := now();
  p_hash text := md5(coalesce(payload::text,''));
  muted boolean;
  rendered_title text;
  rendered_body text;
  existing_id uuid;
begin
  -- Fetch active template
  select * into tpl
  from public.notification_templates
  where key = template_key and active = true
  limit 1;

  if tpl is null then
    -- No active template; nothing to do
    return inserted_ids;
  end if;

  -- Render strings using simple interpolation
  rendered_title := public.interpolate_template(tpl.title_md, payload);
  rendered_body  := public.interpolate_template(tpl.body_md,  payload);

  -- Loop over user ids
  foreach uid in array user_ids
  loop
    -- Check mutes
    select coalesce((ns.mutes ->> template_key)::boolean, false)
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
      and coalesce(n.template_key, '') = coalesce(template_key,'')
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
      (uid, template_key, 'in_app', 'sent', now_ts,
       jsonb_build_object(
         'title', rendered_title,
         'message', rendered_body,
         'template_key', template_key,
         'data', payload
       ),
       template_key,
       p_hash
      )
    returning id into existing_id;

    inserted_ids := inserted_ids || existing_id;
  end loop;

  return inserted_ids;
end;
$fn$;


-- Insert notifications by role(s)
create or replace function public.notify_roles(role_codes text[], template_key text, payload jsonb)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  uids uuid[];
  out_ids uuid[] := '{}';
  role text;
  tmp_ids uuid[];
begin
  uids := '{}';
  foreach role in array role_codes
  loop
    uids := uids || array(select public.get_users_by_role(role));
  end loop;

  if array_length(uids, 1) is null then
    return out_ids;
  end if;

  tmp_ids := public.notify_users(uids, template_key, payload);
  out_ids := out_ids || tmp_ids;
  return out_ids;
end;
$fn$;


-- Mark all notifications as read for current user
create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  affected integer;
begin
  update public.notifications
  set status = 'read',
      read_at = now()
  where user_id = auth.uid()
    and status <> 'read';

  get diagnostics affected = row_count;
  return affected;
end;
$fn$;


-- Developer helper to send a test notification to current user
create or replace function public.send_test_notification(template_key text, payload jsonb)
returns uuid[]
language sql
security definer
set search_path = ''
as $$
  select public.notify_users(array[auth.uid()], template_key, payload)
$$;


-- 4) Seed the requested templates --------------------------------------------

insert into public.notification_templates (key, title_md, body_md, variables, active)
values
  ('student_added',
   'New student added',
   '{added_by_name} added **{student_name}** to **{program_name}**.',
   array['added_by_name','student_name','program_name','student_id'],
   true),
  ('learning_item_changed',
   'Content update',
   '{changed_by_name} **{action}** {item_type}: **{item_title}**.',
   array['changed_by_name','action','item_type','item_title','item_id'],
   true),
  ('invoice_issued',
   'Invoice issued',
   'Invoice **{invoice_number}** for **{student_name}** is issued: **{amount}** due **{due_date}**.',
   array['invoice_number','student_name','amount','due_date','invoice_id','student_user_id'],
   true),
  ('invoice_due',
   'Invoice due soon',
   'Invoice **{invoice_number}** for **{student_name}** is due on **{due_date}**.',
   array['invoice_number','student_name','due_date','invoice_id','student_user_id'],
   true),
  ('ticket_updated',
   'Support ticket update',
   'Ticket **{ticket_number}** updated: **{status}** — {action_summary}.',
   array['ticket_number','status','action_summary','ticket_id','student_user_id'],
   true)
on conflict (key) do update
set title_md = excluded.title_md,
    body_md  = excluded.body_md,
    variables = excluded.variables,
    active = excluded.active,
    updated_at = now();


-- 5) Event triggers -----------------------------------------------------------
-- Notes:
-- - We use best-effort actor name via auth.uid(); fallback to 'System'.
-- - We keep existing triggers intact; idempotency avoids duplicates.

-- A) Student added -> admins + superadmins
create or replace function public.notify_on_student_added()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor_name text;
  student_name text;
  payload jsonb;
begin
  select full_name into actor_name from public.users where id = auth.uid();
  select full_name into student_name from public.users where id = new.user_id;

  payload := jsonb_build_object(
    'added_by_name', coalesce(actor_name, 'System'),
    'student_name',  coalesce(student_name, 'New student'),
    'program_name',  coalesce((select company_name from public.company_settings where id = 1), 'Program'),
    'student_id',    coalesce(new.id::text, null)
  );

  perform public.notify_roles(array['admin','superadmin'], 'student_added', payload);
  return new;
end;
$fn$;

drop trigger if exists trg_notify_on_student_added on public.students;
create trigger trg_notify_on_student_added
after insert on public.students
for each row execute procedure public.notify_on_student_added();


-- B) Learning items (recordings, assignments, success_sessions)
create or replace function public.notify_on_learning_item_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  actor_name text;
  action text;
  item_type text;
  item_title text;
  item_id uuid;
  payload jsonb;
begin
  select full_name into actor_name from public.users where id = auth.uid();
  action := lower(tg_op);

  if tg_table_name = 'available_lessons' then
    item_type := 'recording';
    item_title := coalesce(new.recording_title, old.recording_title);
    item_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'assignments' then
    item_type := 'assignment';
    item_title := coalesce(new.name, old.name);
    item_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'success_sessions' then
    item_type := 'success_session';
    item_title := coalesce(new.title, old.title);
    item_id := coalesce(new.id, old.id);
  else
    return coalesce(new, old);
  end if;

  payload := jsonb_build_object(
    'changed_by_name', coalesce(actor_name, 'System'),
    'action', action,
    'item_type', item_type,
    'item_title', coalesce(item_title, 'Item'),
    'item_id', item_id
  );

  perform public.notify_roles(array['admin','superadmin'], 'learning_item_changed', payload);
  return coalesce(new, old);
end;
$fn$;

-- Attach to the three tables
drop trigger if exists trg_notify_learning_on_available_lessons on public.available_lessons;
create trigger trg_notify_learning_on_available_lessons
after insert or update or delete on public.available_lessons
for each row execute procedure public.notify_on_learning_item_changed();

drop trigger if exists trg_notify_learning_on_assignments on public.assignments;
create trigger trg_notify_learning_on_assignments
after insert or update or delete on public.assignments
for each row execute procedure public.notify_on_learning_item_changed();

drop trigger if exists trg_notify_learning_on_success_sessions on public.success_sessions;
create trigger trg_notify_learning_on_success_sessions
after insert or update or delete on public.success_sessions
for each row execute procedure public.notify_on_learning_item_changed();


-- C) Invoice issued -> admins + superadmins + student
create or replace function public.notify_on_invoice_issued()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  student_user_id uuid;
  student_name text;
  payload jsonb;
begin
  -- Only when newly issued or status changed to issued
  if not (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from new.status)) then
    return coalesce(new, old);
  end if;

  if new.status <> 'issued' then
    return new;
  end if;

  select s.user_id, u.full_name
    into student_user_id, student_name
  from public.students s
  join public.users u on u.id = s.user_id
  where s.id = new.student_id
  limit 1;

  payload := jsonb_build_object(
    'invoice_number', coalesce(new.installment_number::text, new.id::text),
    'student_name', coalesce(student_name, 'Student'),
    'amount', coalesce(new.amount::text,''),
    'due_date', coalesce(new.due_date::text,''),
    'invoice_id', new.id,
    'student_user_id', student_user_id
  );

  perform public.notify_roles(array['admin','superadmin'], 'invoice_issued', payload);
  if student_user_id is not null then
    perform public.notify_users(array[student_user_id], 'invoice_issued', payload);
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_notify_on_invoice_issued on public.invoices;
create trigger trg_notify_on_invoice_issued
after insert or update on public.invoices
for each row execute procedure public.notify_on_invoice_issued();


-- E) Support tickets (create, reply, status change)
-- Ticket create/update
create or replace function public.notify_on_ticket_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  ticket_number text;
  status text;
  action_summary text;
  student_user_id uuid;
  payload jsonb;
begin
  ticket_number := (coalesce(new.id::text, old.id::text));
  status := coalesce(new.status, old.status);
  action_summary := case 
    when tg_op = 'INSERT' then 'created'
    when tg_op = 'UPDATE' then 'updated'
    else 'updated'
  end;

  student_user_id := coalesce(new.user_id, old.user_id);

  payload := jsonb_build_object(
    'ticket_number', ticket_number,
    'status', coalesce(status,''),
    'action_summary', action_summary,
    'ticket_id', coalesce(new.id, old.id),
    'student_user_id', student_user_id
  );

  perform public.notify_roles(array['admin','superadmin'], 'ticket_updated', payload);
  if student_user_id is not null then
    perform public.notify_users(array[student_user_id], 'ticket_updated', payload);
  end if;

  return coalesce(new, old);
end;
$fn$;

drop trigger if exists trg_notify_on_ticket_create_update on public.support_tickets;
create trigger trg_notify_on_ticket_create_update
after insert or update on public.support_tickets
for each row execute procedure public.notify_on_ticket_update();


-- Ticket reply
create or replace function public.notify_on_ticket_reply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  ticket_owner uuid;
  payload jsonb;
begin
  select user_id into ticket_owner 
  from public.support_tickets 
  where id = new.ticket_id;

  payload := jsonb_build_object(
    'ticket_number', coalesce(new.ticket_id::text,''),
    'status', 'replied',
    'action_summary', 'new reply',
    'ticket_id', new.ticket_id,
    'student_user_id', ticket_owner
  );

  perform public.notify_roles(array['admin','superadmin'], 'ticket_updated', payload);
  if ticket_owner is not null then
    perform public.notify_users(array[ticket_owner], 'ticket_updated', payload);
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_notify_on_ticket_reply on public.support_ticket_replies;
create trigger trg_notify_on_ticket_reply
after insert on public.support_ticket_replies
for each row execute procedure public.notify_on_ticket_reply();


-- 6) Optional: ensure settings row exists for each user on demand (no-op policy-wise)
-- (Skip auto-seeding to avoid expensive cross-table operations.)

