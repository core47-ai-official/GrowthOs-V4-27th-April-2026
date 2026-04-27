begin;

-- Align audit functions to allowed admin_logs.action values
-- Allowed by check: created, updated, deleted, auth_deleted, creation_failed, deletion_failed

-- 1) Invoices audit -> use 'created'/'updated'
CREATE OR REPLACE FUNCTION public.audit_invoice_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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

  -- Determine action/description using allowed actions
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_desc   := 'Invoice created';
  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    if coalesce(old.status,'') <> coalesce(new.status,'') then
      if new.status = 'paid' then
        v_desc := 'Payment recorded and invoice marked as paid';
      else
        v_desc := 'Invoice status changed from '||coalesce(old.status,'')||' to '||coalesce(new.status,'');
      end if;
    elsif (old.paid_at is distinct from new.paid_at) and new.paid_at is not null then
      v_desc := 'Payment timestamp set';
    else
      v_desc := 'Invoice details updated';
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

-- 2) Notification templates audit -> use 'created'/'updated'/'deleted'
CREATE OR REPLACE FUNCTION public.audit_notification_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_entity_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    v_entity_id := new.id;
    new.updated_at := now();
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
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
$$;

-- 3) User status/LMS changes -> use 'updated'
CREATE OR REPLACE FUNCTION public.audit_user_status_changes_to_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_desc   text;
  v_data   jsonb;
begin
  if tg_op = 'UPDATE' then
    v_action := 'updated';
    if old.lms_status is distinct from new.lms_status then
      v_desc   := 'LMS status changed from '||coalesce(old.lms_status,'')||' to '||coalesce(new.lms_status,'');
    elsif old.status is distinct from new.status then
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

-- 4) Cascade deletion log -> use 'deleted'
CREATE OR REPLACE FUNCTION public.handle_user_cascade_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  student_record_id uuid;
BEGIN
  IF current_setting('request.jwt.claim.sub', true) = '00000000-0000-0000-0000-000000000000' THEN
    SELECT id INTO student_record_id FROM public.students WHERE user_id = OLD.id;
    IF student_record_id IS NOT NULL THEN
      DELETE FROM public.invoices WHERE student_id = student_record_id;
    END IF;
    DELETE FROM public.submissions WHERE student_id = OLD.id;
    DELETE FROM public.students WHERE user_id = OLD.id;
    DELETE FROM public.user_activity_logs WHERE user_id = OLD.id;
    DELETE FROM public.user_badges WHERE user_id = OLD.id;
    DELETE FROM public.user_unlocks WHERE user_id = OLD.id;
    DELETE FROM public.recording_views WHERE user_id = OLD.id;
    DELETE FROM public.notifications WHERE user_id = OLD.id;
    DELETE FROM public.support_ticket_replies WHERE user_id = OLD.id;
    DELETE FROM public.support_tickets WHERE user_id = OLD.id;
    DELETE FROM public.email_queue WHERE user_id = OLD.id;
    DELETE FROM public.admin_logs WHERE performed_by = OLD.id;
    DELETE FROM public.users WHERE id = OLD.id;
    RETURN OLD;
  END IF;

  BEGIN
    SELECT id INTO student_record_id FROM public.students WHERE user_id = OLD.id;
    IF student_record_id IS NOT NULL THEN
      DELETE FROM public.invoices WHERE student_id = student_record_id;
    END IF;
    DELETE FROM public.submissions WHERE student_id = OLD.id;
    DELETE FROM public.students WHERE user_id = OLD.id;
    DELETE FROM public.user_activity_logs WHERE user_id = OLD.id;
    DELETE FROM public.user_badges WHERE user_id = OLD.id;
    DELETE FROM public.user_unlocks WHERE user_id = OLD.id;
    DELETE FROM public.recording_views WHERE user_id = OLD.id;
    DELETE FROM public.notifications WHERE user_id = OLD.id;
    DELETE FROM public.support_ticket_replies WHERE user_id = OLD.id;
    DELETE FROM public.support_tickets WHERE user_id = OLD.id;
    DELETE FROM public.email_queue WHERE user_id = OLD.id;
    DELETE FROM public.admin_logs WHERE performed_by = OLD.id;
    DELETE FROM public.users WHERE id = OLD.id;

    INSERT INTO public.admin_logs (
      entity_type, entity_id, action, description, performed_by, created_at
    ) VALUES (
      'user', OLD.id, 'deleted', 'User and related records cascade-deleted', OLD.id, now()
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Failed to cascade delete for user %: %', OLD.id, SQLERRM;
  END;

  RETURN OLD;
END;
$$;

-- 5) Ensure triggers exist (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_invoice_changes') THEN
    CREATE TRIGGER trg_audit_invoice_changes
    AFTER INSERT OR UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.audit_invoice_changes();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_user_status_changes') THEN
    CREATE TRIGGER trg_audit_user_status_changes
    AFTER UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.audit_user_status_changes_to_logs();
  END IF;
END$$;

-- 6) Backfill with allowed actions only
-- a) Students -> created
INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
SELECT 'user', u.id, 'created', 'Backfill: existing student user record', u.created_by,
       COALESCE(u.created_at, now()),
       jsonb_build_object('email', u.email, 'full_name', u.full_name, 'status', u.status, 'lms_status', u.lms_status)
FROM public.users u
WHERE u.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_logs al
    WHERE al.entity_type = 'user' AND al.entity_id = u.id AND al.action = 'created'
  );

-- b) Invoices -> paid = updated (payment), else created
WITH inv AS (
  SELECT i.*, s.user_id AS student_user_id
  FROM public.invoices i
  LEFT JOIN public.students s ON s.id = i.student_id
)
INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
SELECT 'invoice', inv.id,
       CASE WHEN inv.status = 'paid' THEN 'updated' ELSE 'created' END AS action,
       CASE WHEN inv.status = 'paid' THEN 'Backfill: payment recorded' ELSE 'Backfill: existing invoice record' END AS description,
       NULL::uuid,
       CASE WHEN inv.status = 'paid' THEN COALESCE(inv.paid_at, inv.updated_at, inv.created_at, now()) ELSE COALESCE(inv.created_at, now()) END AS created_at,
       jsonb_build_object(
         'student_id', inv.student_id,
         'student_user_id', inv.student_user_id,
         'installment_number', inv.installment_number,
         'amount', inv.amount,
         'due_date', inv.due_date,
         'status_new', inv.status,
         'paid_at', inv.paid_at
       )
FROM inv
WHERE NOT EXISTS (
  SELECT 1 FROM public.admin_logs al
  WHERE al.entity_type = 'invoice' AND al.entity_id = inv.id
);

commit;