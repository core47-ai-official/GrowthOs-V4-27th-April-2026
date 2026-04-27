-- Enhance student_recovery_messages table
ALTER TABLE student_recovery_messages 
ADD COLUMN IF NOT EXISTS recovery_cycle integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS message_status text DEFAULT 'pending' 
  CHECK (message_status IN ('pending', 'sent', 'recovered', 'failed')),
ADD COLUMN IF NOT EXISTS last_check_date date DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS last_login_check timestamp with time zone;

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_recovery_status_user 
  ON student_recovery_messages(user_id, message_status);
CREATE INDEX IF NOT EXISTS idx_recovery_check_date 
  ON student_recovery_messages(last_check_date);

-- Create daily check log table
CREATE TABLE IF NOT EXISTS student_recovery_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  students_checked integer DEFAULT 0,
  newly_inactive integer DEFAULT 0,
  recovered integer DEFAULT 0,
  still_inactive integer DEFAULT 0,
  check_completed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(check_date)
);

-- RLS Policies for student_recovery_checks
ALTER TABLE student_recovery_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view recovery checks"
ON student_recovery_checks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
  )
);

CREATE POLICY "System can insert recovery checks"
ON student_recovery_checks FOR INSERT
WITH CHECK (true);

-- Function: Get Currently Tracked Students
CREATE OR REPLACE FUNCTION get_tracked_inactive_students()
RETURNS TABLE (
  recovery_message_id uuid,
  user_id uuid,
  full_name text,
  email text,
  phone text,
  days_inactive integer,
  recovery_cycle integer,
  message_status text,
  last_check_date date,
  message_sent_at timestamp with time zone
) 
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    srm.id as recovery_message_id,
    srm.user_id,
    u.full_name,
    u.email,
    u.phone,
    srm.days_inactive,
    srm.recovery_cycle,
    srm.message_status,
    srm.last_check_date,
    srm.message_sent_at
  FROM student_recovery_messages srm
  JOIN users u ON u.id = srm.user_id
  WHERE srm.message_status IN ('pending', 'sent')
  AND u.lms_status = 'active'
  ORDER BY srm.message_sent_at DESC;
$$;

-- Function: Check if Student Logged In
CREATE OR REPLACE FUNCTION has_student_logged_in_since(
  p_user_id uuid,
  p_since_date timestamp with time zone
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_activity_logs
    WHERE user_id = p_user_id
    AND activity_type IN ('login', 'page_view', 'recording_watched')
    AND occurred_at > p_since_date
    LIMIT 1
  );
$$;

-- Function: Mark Student as Recovered
CREATE OR REPLACE FUNCTION mark_student_recovered(
  p_recovery_message_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE student_recovery_messages
  SET 
    recovery_successful = true,
    message_status = 'recovered',
    recovered_at = now(),
    updated_at = now()
  WHERE id = p_recovery_message_id;
END;
$$;

-- Function: Create Recovery Record
CREATE OR REPLACE FUNCTION create_recovery_record(
  p_user_id uuid,
  p_days_inactive integer,
  p_recovery_cycle integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recovery_id uuid;
BEGIN
  INSERT INTO student_recovery_messages (
    user_id,
    days_inactive,
    recovery_cycle,
    message_status,
    message_type,
    last_check_date
  ) VALUES (
    p_user_id,
    p_days_inactive,
    p_recovery_cycle,
    'pending',
    'whatsapp_inactive',
    CURRENT_DATE
  )
  RETURNING id INTO v_recovery_id;
  
  RETURN v_recovery_id;
END;
$$;