-- Add course_id and pathway_id to invoices table for per-enrollment tracking
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS pathway_id UUID REFERENCES public.learning_pathways(id) ON DELETE SET NULL;

-- Add payment tracking columns to course_enrollments
ALTER TABLE public.course_enrollments
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_invoices_course_id ON public.invoices(course_id);
CREATE INDEX IF NOT EXISTS idx_invoices_pathway_id ON public.invoices(pathway_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_payment_status ON public.course_enrollments(payment_status);

-- Add comment for documentation
COMMENT ON COLUMN public.invoices.course_id IS 'Links invoice to specific course enrollment';
COMMENT ON COLUMN public.invoices.pathway_id IS 'Links invoice to specific pathway enrollment';
COMMENT ON COLUMN public.course_enrollments.payment_status IS 'Payment status: pending, partial, paid, waived';
COMMENT ON COLUMN public.course_enrollments.total_amount IS 'Total fee amount for this enrollment';
COMMENT ON COLUMN public.course_enrollments.amount_paid IS 'Amount paid so far for this enrollment';