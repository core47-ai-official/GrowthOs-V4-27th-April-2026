-- Ensure invoices.status supports all used statuses
-- Drop existing constraint if present
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

-- Recreate with expanded allowed values
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('pending', 'paid', 'due', 'cancelled', 'scheduled', 'issued')) NOT VALID;

-- Optionally validate (will fail if legacy rows have other statuses)
-- ALTER TABLE public.invoices VALIDATE CONSTRAINT invoices_status_check;