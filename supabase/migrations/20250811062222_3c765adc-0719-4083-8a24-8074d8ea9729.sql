
-- 1) Allow Enrollment Managers to view admin logs
create policy "Enrollment managers can view admin logs"
  on public.admin_logs
  for select
  using (public.get_current_user_role() = 'enrollment_manager');

-- 2) Audit trigger for invoices: log creation, status changes, and payments
create or replace function public.audit_invoice_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_desc   text;
  v_entity uuid;
  v_student_user_id uuid;
  v_student_id uuid;
  v_data   jsonb;
begin
  v_entity := coalesce(new.id, old.id);
  v_student_id := coalesce(new.student_id, old.student_id);

  -- Determine action/description
  if tg_op = 'INSERT' then
    v_action := 'invoice_created';
    v_desc   := 'Invoice created';
  elsif tg_op = 'UPDATE' then
    if coalesce(old.status,'') <> coalesce(new.status,'') then
      if new.status = 'paid' then
        v_action := 'payment_recorded';
        v_desc   := 'Payment recorded and invoice marked as paid';
      else
        v_action := 'invoice_status_changed';
        v_desc   := 'Invoice status changed from '||coalesce(old.status,'')||' to '||coalesce(new.status,'');
      end if;
    elsif (old.paid_at is distinct from new.paid_at) and new.paid_at is not null then
      v_action := 'payment_recorded';
      v_desc   := 'Payment timestamp set';
    else
      v_action := 'invoice_updated';
      v_desc   := 'Invoice details updated';
    end if;
  end if;

  -- Resolve student_user_id (from students -> users)
  if v_student_id is not null then
    select u.id
      into v_student_user_id
    from public.students s
    join public.users u on u.id = s.user_id
    where s.id = v_student_id
    limit 1;
  end if;

  v_data := jsonb_build_object(
    'student_id', v_student_id,
    'student_user_id', v_student_user_id,
    'installment_number', coalesce(new.installment_number, old.installment_number),
    'amount', coalesce(new.amount, old.amount),
    'due_date', coalesce(new.due_date, old.due_date),
    'status_old', old.status,
    'status_new', new.status,
    'paid_at', coalesce(new.paid_at, old.paid_at)
  );

  begin
    insert into public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
    values ('invoice', v_entity, v_action, v_desc, v_actor, now(), v_data);
  exception when others then
    raise notice 'audit_invoice_changes failed: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_audit_invoice_changes'
      and n.nspname = 'public'
      and c.relname = 'invoices'
  ) then
    create trigger trg_audit_invoice_changes
      after insert or update on public.invoices
      for each row
      execute function public.audit_invoice_changes();
  end if;
end;
$$;

-- 3) Audit trigger for user status/LMS status changes (suspensions, restores, etc.)
create or replace function public.audit_user_status_changes_to_logs()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_desc   text;
  v_data   jsonb;
begin
  if tg_op = 'UPDATE' then
    if old.lms_status is distinct from new.lms_status then
      v_action := 'lms_status_change';
      v_desc   := 'LMS status changed from '||coalesce(old.lms_status,'')||' to '||coalesce(new.lms_status,'');
    elsif old.status is distinct from new.status then
      v_action := 'user_status_change';
      v_desc   := 'User status changed from '||coalesce(old.status,'')||' to '||coalesce(new.status,'');
    else
      return new;
    end if;

    v_data := jsonb_build_object(
      'status_old', old.status,
      'status_new', new.status,
      'lms_status_old', old.lms_status,
      'lms_status_new', new.lms_status
    );

    begin
      insert into public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
      values ('user', new.id, v_action, v_desc, v_actor, now(), v_data);
    exception when others then
      raise notice 'audit_user_status_changes_to_logs failed: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'trg_audit_user_status_changes_to_logs'
      and n.nspname = 'public'
      and c.relname = 'users'
  ) then
    create trigger trg_audit_user_status_changes_to_logs
      after update on public.users
      for each row
      when (old.lms_status is distinct from new.lms_status or old.status is distinct from new.status)
      execute function public.audit_user_status_changes_to_logs();
  end if;
end;
$$;
