-- Backfill: ensure unpaid issued invoices are set to pending
UPDATE public.invoices
SET status = 'pending', updated_at = now()
WHERE status = 'issued'
  AND paid_at IS NULL;