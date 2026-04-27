-- Add extended_due_date column to invoices table for manual fee extensions
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS extended_due_date TIMESTAMPTZ NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.invoices.extended_due_date IS 'Manually set extension date. If set, LMS suspension and overdue logic use this date instead of due_date.';