-- Add enrollment_details column to invoices table for storing course/pathway names
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS enrollment_details jsonb DEFAULT NULL;

-- Comment explaining the column
COMMENT ON COLUMN public.invoices.enrollment_details IS 'Stores course and pathway names associated with this invoice';