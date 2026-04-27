-- Create installment_payments table to track individual installment payments
CREATE TABLE public.installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  installment_number INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  amount DECIMAL(10,2),
  payment_date TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'paid' CHECK (status IN ('paid', 'pending', 'failed')),
  invoice_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own installment payments" 
ON public.installment_payments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all installment payments" 
ON public.installment_payments 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can insert installment payments" 
ON public.installment_payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Admins can update installment payments" 
ON public.installment_payments 
FOR UPDATE 
USING (true);

-- Create index for better performance
CREATE INDEX idx_installment_payments_user_id ON public.installment_payments(user_id);
CREATE INDEX idx_installment_payments_status ON public.installment_payments(status);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_installment_payments_updated_at
BEFORE UPDATE ON public.installment_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();