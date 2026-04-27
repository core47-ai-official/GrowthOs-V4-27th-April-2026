-- Drop the problematic trigger and view that's causing the error
DROP TRIGGER IF EXISTS success_session_sync_trigger ON public.success_sessions;
DROP FUNCTION IF EXISTS public.handle_success_session_sync() CASCADE;

-- Drop the segmented table if it exists (it's causing issues)
DROP TABLE IF EXISTS public.segmented_weekly_success_sessions CASCADE;
DROP TABLE IF EXISTS public.segmented_weekly_success_sessions_backup CASCADE;

-- Ensure success_sessions table has all required columns
-- No changes needed to table structure, just making sure it's clean

-- Create session_attendance table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.success_sessions(id) ON DELETE CASCADE,
  attended_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, session_id)
);

-- Enable RLS on session_attendance
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

-- RLS policies for session_attendance
CREATE POLICY "Users can view their own attendance"
  ON public.session_attendance
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can record their own attendance"
  ON public.session_attendance
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all attendance"
  ON public.session_attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
    )
  );

-- Update the success_sessions RLS policies to ensure proper access
-- Drop existing policies first
DROP POLICY IF EXISTS "Authenticated users can view success sessions" ON public.success_sessions;
DROP POLICY IF EXISTS "Enrolled users can view success sessions" ON public.success_sessions;
DROP POLICY IF EXISTS "Staff can manage success sessions" ON public.success_sessions;
DROP POLICY IF EXISTS "Staff can delete success sessions" ON public.success_sessions;
DROP POLICY IF EXISTS "Staff can delete success sessions (definer)" ON public.success_sessions;

-- Create clean RLS policies for success_sessions
CREATE POLICY "All authenticated users can view success sessions"
  ON public.success_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff can insert success sessions"
  ON public.success_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin', 'mentor')
    )
  );

CREATE POLICY "Staff can update success sessions"
  ON public.success_sessions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin', 'mentor')
    )
  );

CREATE POLICY "Staff can delete success sessions"
  ON public.success_sessions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin', 'mentor')
    )
  );

-- Create a simple trigger for notifications when sessions are created/updated
CREATE OR REPLACE FUNCTION public.notify_session_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    notification_title := 'New Success Session';
    notification_message := 'A new session "' || NEW.title || '" has been scheduled.';
    
    -- Notify all students
    INSERT INTO public.notifications (user_id, type, channel, status, sent_at, payload)
    SELECT 
      u.id,
      'success_session',
      'in_app',
      'sent',
      now(),
      jsonb_build_object(
        'title', notification_title,
        'message', notification_message,
        'session_id', NEW.id,
        'action', 'added'
      )
    FROM public.users u
    WHERE u.role = 'student' AND u.status = 'active';
    
    -- Notify assigned mentor if any
    IF NEW.mentor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, channel, status, sent_at, payload)
      VALUES (
        NEW.mentor_id,
        'success_session',
        'in_app',
        'sent',
        now(),
        jsonb_build_object(
          'title', 'You have been assigned to a session',
          'message', 'You have been assigned to host "' || NEW.title || '"',
          'session_id', NEW.id,
          'action', 'assigned'
        )
      );
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    notification_title := 'Success Session Updated';
    notification_message := 'The session "' || NEW.title || '" has been updated.';
    
    -- Notify all students
    INSERT INTO public.notifications (user_id, type, channel, status, sent_at, payload)
    SELECT 
      u.id,
      'success_session',
      'in_app',
      'sent',
      now(),
      jsonb_build_object(
        'title', notification_title,
        'message', notification_message,
        'session_id', NEW.id,
        'action', 'updated'
      )
    FROM public.users u
    WHERE u.role = 'student' AND u.status = 'active';
    
    -- Notify mentor if changed or still assigned
    IF NEW.mentor_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, channel, status, sent_at, payload)
      VALUES (
        NEW.mentor_id,
        'success_session',
        'in_app',
        'sent',
        now(),
        jsonb_build_object(
          'title', 'Session updated',
          'message', 'Your assigned session "' || NEW.title || '" has been updated',
          'session_id', NEW.id,
          'action', 'updated'
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach the notification trigger
DROP TRIGGER IF EXISTS success_session_notification_trigger ON public.success_sessions;
CREATE TRIGGER success_session_notification_trigger
  AFTER INSERT OR UPDATE ON public.success_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_session_changes();