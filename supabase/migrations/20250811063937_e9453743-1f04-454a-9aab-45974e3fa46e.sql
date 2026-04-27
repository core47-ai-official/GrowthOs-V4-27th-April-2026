-- Enable audit triggers (idempotent) and backfill admin_logs for existing data
-- so historical student and invoice records are visible in Activity Logs

begin;

-- 1) Ensure audit triggers exist (create if missing)
-- Invoice audit trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_invoice_changes'
  ) THEN
    CREATE TRIGGER trg_audit_invoice_changes
    AFTER INSERT OR UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_invoice_changes();
  END IF;
END$$;

-- User status/LMS audit trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_audit_user_status_changes'
  ) THEN
    CREATE TRIGGER trg_audit_user_status_changes
    AFTER UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_user_status_changes_to_logs();
  END IF;
END$$;

-- 2) Backfill admin_logs for existing STUDENT users (idempotent)
-- Insert a creation/backfill record for each existing student user
INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
SELECT 
  'user'::text            AS entity_type,
  u.id                    AS entity_id,
  'user_created'          AS action,
  'Backfill: existing student user record' AS description,
  u.created_by            AS performed_by,
  COALESCE(u.created_at, now()) AS created_at,
  jsonb_build_object(
    'email', u.email,
    'full_name', u.full_name,
    'status', u.status,
    'lms_status', u.lms_status
  )                       AS data
FROM public.users u
WHERE u.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_logs al
    WHERE al.entity_type = 'user'
      AND al.entity_id = u.id
      AND al.action IN ('user_created')
  );

-- Optional: snapshot current LMS/status for visibility even without prior changes
INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
SELECT 
  'user',
  u.id,
  'status_snapshot',
  'Backfill: current status snapshot',
  u.created_by,
  COALESCE(u.updated_at, u.created_at, now()),
  jsonb_build_object(
    'status', u.status,
    'lms_status', u.lms_status
  )
FROM public.users u
WHERE u.role = 'student'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_logs al
    WHERE al.entity_type = 'user'
      AND al.entity_id = u.id
      AND al.action = 'status_snapshot'
  );

-- 3) Backfill admin_logs for existing INVOICES (idempotent)
WITH inv AS (
  SELECT i.*, s.user_id AS student_user_id
  FROM public.invoices i
  LEFT JOIN public.students s ON s.id = i.student_id
)
-- a) Backfill payment records for paid invoices
INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
SELECT
  'invoice',
  inv.id,
  'payment_recorded',
  'Backfill: Invoice marked as paid',
  NULL::uuid,
  COALESCE(inv.paid_at, inv.updated_at, inv.created_at, now()),
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
WHERE inv.status = 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_logs al
    WHERE al.entity_type = 'invoice'
      AND al.entity_id = inv.id
      AND al.action = 'payment_recorded'
  );

-- b) Backfill creation/snapshot for non-paid invoices
WITH inv AS (
  SELECT i.*, s.user_id AS student_user_id
  FROM public.invoices i
  LEFT JOIN public.students s ON s.id = i.student_id
)
INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
SELECT
  'invoice',
  inv.id,
  'invoice_created',
  'Backfill: existing invoice record',
  NULL::uuid,
  COALESCE(inv.created_at, now()),
  jsonb_build_object(
    'student_id', inv.student_id,
    'student_user_id', inv.student_user_id,
    'installment_number', inv.installment_number,
    'amount', inv.amount,
    'due_date', inv.due_date,
    'status_new', inv.status
  )
FROM inv
WHERE inv.status <> 'paid'
  AND NOT EXISTS (
    SELECT 1 FROM public.admin_logs al
    WHERE al.entity_type = 'invoice'
      AND al.entity_id = inv.id
  );

commit;