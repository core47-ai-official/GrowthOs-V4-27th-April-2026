-- Create student recovery messages table to track recovery attempts and success
CREATE TABLE public.student_recovery_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  message_type TEXT NOT NULL DEFAULT 'whatsapp_inactive',
  days_inactive INTEGER NOT NULL,
  recovery_successful BOOLEAN DEFAULT NULL,
  recovered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  message_content TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_recovery_messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view all recovery messages" 
ON public.student_recovery_messages 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]));

CREATE POLICY "System can insert recovery messages" 
ON public.student_recovery_messages 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update recovery messages" 
ON public.student_recovery_messages 
FOR UPDATE 
USING (true);

-- Create indexes for better performance
CREATE INDEX idx_recovery_messages_user_id ON public.student_recovery_messages(user_id);
CREATE INDEX idx_recovery_messages_sent_at ON public.student_recovery_messages(message_sent_at);
CREATE INDEX idx_recovery_messages_recovery_successful ON public.student_recovery_messages(recovery_successful);

-- Create trigger for updated_at
CREATE TRIGGER update_recovery_messages_updated_at
BEFORE UPDATE ON public.student_recovery_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get inactive students (for N8N integration)
CREATE OR REPLACE FUNCTION public.get_inactive_students(days_threshold INTEGER DEFAULT 3)
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  full_name TEXT,
  last_active_at TIMESTAMP WITH TIME ZONE,
  days_inactive INTEGER,
  phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.last_active_at,
    EXTRACT(DAYS FROM (now() - u.last_active_at))::INTEGER as days_inactive,
    u.phone
  FROM public.users u
  WHERE u.role = 'student'
    AND u.status = 'active'
    AND u.lms_status = 'active'
    AND u.last_active_at IS NOT NULL
    AND u.last_active_at < (now() - INTERVAL '1 day' * days_threshold)
    AND NOT EXISTS (
      SELECT 1 FROM public.student_recovery_messages srm
      WHERE srm.user_id = u.id
        AND srm.message_sent_at > (now() - INTERVAL '1 day')
    );
END;
$function$;

-- Create function to record recovery message
CREATE OR REPLACE FUNCTION public.record_recovery_message(
  p_user_id UUID,
  p_message_type TEXT DEFAULT 'whatsapp_inactive',
  p_days_inactive INTEGER DEFAULT 3,
  p_message_content TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  message_id UUID;
BEGIN
  INSERT INTO public.student_recovery_messages (
    user_id,
    message_type,
    days_inactive,
    message_content
  ) VALUES (
    p_user_id,
    p_message_type,
    p_days_inactive,
    p_message_content
  ) RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$function$;

-- Create function to mark recovery as successful
CREATE OR REPLACE FUNCTION public.mark_recovery_successful(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  updated_count INTEGER;
BEGIN
  -- Update the most recent recovery message for this user that hasn't been marked successful yet
  UPDATE public.student_recovery_messages
  SET recovery_successful = true,
      recovered_at = now(),
      updated_at = now()
  WHERE user_id = p_user_id
    AND recovery_successful IS NULL
    AND id = (
      SELECT id FROM public.student_recovery_messages
      WHERE user_id = p_user_id AND recovery_successful IS NULL
      ORDER BY message_sent_at DESC
      LIMIT 1
    );
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count > 0;
END;
$function$;

-- Create function to get recovery statistics
CREATE OR REPLACE FUNCTION public.get_recovery_statistics()
RETURNS TABLE(
  total_messages_sent BIGINT,
  successful_recoveries BIGINT,
  pending_recoveries BIGINT,
  failed_recoveries BIGINT,
  recovery_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_messages_sent,
    COUNT(*) FILTER (WHERE recovery_successful = true) as successful_recoveries,
    COUNT(*) FILTER (WHERE recovery_successful IS NULL) as pending_recoveries,
    COUNT(*) FILTER (WHERE recovery_successful = false) as failed_recoveries,
    CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE recovery_successful = true) * 100.0 / COUNT(*))::NUMERIC, 2)
      ELSE 0
    END as recovery_rate
  FROM public.student_recovery_messages;
END;
$function$;