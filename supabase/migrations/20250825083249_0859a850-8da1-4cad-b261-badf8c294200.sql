-- Phase 1: Create checkpoint documentation
-- Document current working edge functions and create installment_payments table

-- Create installment_payments table to fix cleanup-inactive-students function
CREATE TABLE IF NOT EXISTS public.installment_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  payment_method TEXT,
  transaction_id TEXT,
  status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for installment_payments
CREATE POLICY "Admins can manage installment payments" 
ON public.installment_payments 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'enrollment_manager'::text]));

CREATE POLICY "Students can view their own payments" 
ON public.installment_payments 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE TRIGGER update_installment_payments_updated_at
  BEFORE UPDATE ON public.installment_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_installment_payments_user_id ON public.installment_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_student_id ON public.installment_payments(student_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_status ON public.installment_payments(status);