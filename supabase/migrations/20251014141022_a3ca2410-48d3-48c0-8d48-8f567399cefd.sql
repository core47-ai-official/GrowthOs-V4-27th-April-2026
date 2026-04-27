-- Create table for Success Partner conversation messages
CREATE TABLE public.success_partner_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add index for efficient querying by user and date
CREATE INDEX idx_success_partner_messages_user_date ON public.success_partner_messages(user_id, date DESC);

-- Enable RLS
ALTER TABLE public.success_partner_messages ENABLE ROW LEVEL SECURITY;

-- Students can view their own messages
CREATE POLICY "Users can view their own messages"
ON public.success_partner_messages
FOR SELECT
USING (auth.uid() = user_id);

-- Students can insert their own messages
CREATE POLICY "Users can insert their own messages"
ON public.success_partner_messages
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Staff can view all messages
CREATE POLICY "Staff can view all messages"
ON public.success_partner_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
  )
);