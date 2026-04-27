-- Add missing fields to company_settings table for billing configuration and company logo
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS company_logo TEXT,
ADD COLUMN IF NOT EXISTS invoice_notes TEXT,
ADD COLUMN IF NOT EXISTS invoice_overdue_days INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS invoice_send_gap_days INTEGER NOT NULL DEFAULT 7;

-- Add comments for documentation
COMMENT ON COLUMN public.company_settings.company_logo IS 'Base64 encoded company logo or URL';
COMMENT ON COLUMN public.company_settings.invoice_notes IS 'Default notes to include in all invoices';
COMMENT ON COLUMN public.company_settings.invoice_overdue_days IS 'Days after creation to mark invoice as overdue';
COMMENT ON COLUMN public.company_settings.invoice_send_gap_days IS 'Days to wait before sending invoice to customer';