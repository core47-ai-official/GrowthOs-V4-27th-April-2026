-- Add discount columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS final_fee_amount NUMERIC(10,2);

-- Add comment for documentation
COMMENT ON COLUMN public.students.discount_amount IS 'Fixed discount amount applied (admin/superadmin only)';
COMMENT ON COLUMN public.students.discount_percentage IS 'Percentage discount applied (admin/superadmin only)';
COMMENT ON COLUMN public.students.final_fee_amount IS 'Final fee amount after discount applied';