-- Update company_settings to include SMTP configuration
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS smtp_host text,
ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_username text,
ADD COLUMN IF NOT EXISTS smtp_password text,
ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS lms_from_email text DEFAULT 'noreply@yourdomain.com',
ADD COLUMN IF NOT EXISTS lms_from_name text DEFAULT 'LMS Team',
ADD COLUMN IF NOT EXISTS invoice_from_email text DEFAULT 'billing@yourdomain.com',
ADD COLUMN IF NOT EXISTS invoice_from_name text DEFAULT 'Billing Team';

-- Create email_queue table for better email management
CREATE TABLE IF NOT EXISTS public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email_type text NOT NULL, -- 'welcome_student', 'welcome_staff', 'invoice'
  recipient_email text NOT NULL,
  recipient_name text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'sending', 'sent', 'failed'
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  error_message text,
  scheduled_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on email_queue
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_queue
CREATE POLICY "Admins can manage email queue" ON public.email_queue
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "System can manage email queue" ON public.email_queue
FOR ALL USING (auth.role() = 'service_role');

-- Create function to enqueue welcome emails
CREATE OR REPLACE FUNCTION public.enqueue_welcome_email(
  p_user_id uuid,
  p_user_role text,
  p_recipient_email text,
  p_recipient_name text,
  p_template_data jsonb DEFAULT '{}'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  email_id uuid;
  email_type text;
BEGIN
  -- Determine email type based on role
  email_type := CASE 
    WHEN p_user_role = 'student' THEN 'welcome_student'
    ELSE 'welcome_staff'
  END;
  
  -- Insert email into queue
  INSERT INTO public.email_queue (
    user_id,
    email_type,
    recipient_email,
    recipient_name,
    template_data
  ) VALUES (
    p_user_id,
    email_type,
    p_recipient_email,
    p_recipient_name,
    p_template_data
  ) RETURNING id INTO email_id;
  
  RETURN email_id;
END;
$$;

-- Update the student welcome trigger to use the new email system
CREATE OR REPLACE FUNCTION public.fn_send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Fire for both students and staff
  IF TG_OP = 'INSERT' AND NEW.role IN ('student', 'admin', 'mentor', 'enrollment_manager') THEN
    -- Generate one-time password if missing
    IF NEW.temp_password IS NULL THEN
      UPDATE public.users
         SET temp_password = encode(gen_random_bytes(12), 'hex')
       WHERE id = NEW.id;
      
      -- Get the updated temp_password for NEW record
      SELECT temp_password INTO NEW.temp_password 
      FROM public.users WHERE id = NEW.id;
    END IF;

    -- Enqueue welcome email
    PERFORM public.enqueue_welcome_email(
      NEW.id,
      NEW.role,
      NEW.email,
      NEW.full_name,
      jsonb_build_object(
        'email', NEW.email,
        'full_name', NEW.full_name,
        'temp_password', NEW.temp_password,
        'user_id', NEW.id,
        'student_id', NEW.student_id,
        'role', NEW.role,
        'lms_user_id', NEW.lms_user_id
      )
    );

    -- For students, also enqueue invoice email
    IF NEW.role = 'student' THEN
      INSERT INTO public.email_queue (
        user_id,
        email_type,
        recipient_email,
        recipient_name,
        template_data
      ) VALUES (
        NEW.id,
        'invoice',
        NEW.email,
        NEW.full_name,
        jsonb_build_object(
          'email', NEW.email,
          'full_name', NEW.full_name,
          'user_id', NEW.id,
          'student_id', NEW.student_id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trigger_send_welcome_email ON public.users;
CREATE TRIGGER trigger_send_welcome_email
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_send_welcome_email();

-- Create updated_at trigger for email_queue
CREATE TRIGGER update_email_queue_updated_at
  BEFORE UPDATE ON public.email_queue
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();