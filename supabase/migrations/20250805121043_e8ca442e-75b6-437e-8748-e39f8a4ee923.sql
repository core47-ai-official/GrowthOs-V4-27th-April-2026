-- Add installment_count field to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS installment_count integer DEFAULT 1;

-- Add password_display field to users table if not exists (for showing generated passwords to admins)
-- This field is already present based on the schema, so we'll just ensure it exists

-- Create email_queue table for tracking credential emails
CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  email_type text NOT NULL CHECK (email_type IN ('student_credentials', 'team_member_credentials')),
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  credentials jsonb NOT NULL, -- Will store password, lms_password, etc.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamp with time zone,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on email_queue
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Policy for admins and superadmins to manage email queue
CREATE POLICY "Admins can manage email queue" ON public.email_queue
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin'));

-- Add updated_at trigger for email_queue
CREATE TRIGGER update_email_queue_updated_at
BEFORE UPDATE ON public.email_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();