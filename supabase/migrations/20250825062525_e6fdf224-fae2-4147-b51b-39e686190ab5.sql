-- Create success_partner_credits table to track daily message usage
CREATE TABLE public.success_partner_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  credits_used INTEGER NOT NULL DEFAULT 0,
  daily_limit INTEGER NOT NULL DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.success_partner_credits ENABLE ROW LEVEL SECURITY;

-- Users can view their own credits
CREATE POLICY "Users can view their own credits" 
ON public.success_partner_credits 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own credits
CREATE POLICY "Users can insert their own credits" 
ON public.success_partner_credits 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own credits
CREATE POLICY "Users can update their own credits" 
ON public.success_partner_credits 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Staff can view all credits for admin purposes
CREATE POLICY "Staff can view all credits" 
ON public.success_partner_credits 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]));

-- Add trigger for updated_at
CREATE TRIGGER update_success_partner_credits_updated_at
BEFORE UPDATE ON public.success_partner_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();