-- Add drip_enabled column to courses table (for consistency with pathways)
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS drip_enabled boolean DEFAULT null;

-- Add student-level override columns to course_enrollments table
ALTER TABLE public.course_enrollments 
ADD COLUMN IF NOT EXISTS drip_override boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS drip_enabled boolean DEFAULT null,
ADD COLUMN IF NOT EXISTS sequential_override boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS sequential_enabled boolean DEFAULT null,
ADD COLUMN IF NOT EXISTS discount_amount numeric DEFAULT null,
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT null;

-- Update get_student_unlock_sequence to respect student-level overrides
DROP FUNCTION IF EXISTS public.get_student_unlock_sequence(uuid);

CREATE OR REPLACE FUNCTION public.get_student_unlock_sequence(p_user_id uuid)
RETURNS TABLE(
  recording_id uuid,
  recording_title text,
  sequence_order integer,
  module_id uuid,
  module_title text,
  is_unlocked boolean,
  is_watched boolean,
  assignment_id uuid,
  assignment_completed boolean,
  unlock_reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequential_enabled boolean := false;
  v_fees_cleared boolean := false;
  v_student_override boolean := false;
  v_student_sequential boolean := null;
BEGIN
  -- Check company-level sequential unlock setting
  SELECT COALESCE(lms_sequential_unlock, false) INTO v_sequential_enabled
  FROM company_settings LIMIT 1;
  
  -- Check if student has fees cleared
  SELECT COALESCE(s.fees_cleared, false) INTO v_fees_cleared
  FROM students s WHERE s.user_id = p_user_id;
  
  -- Check for student-level sequential override in any enrollment
  SELECT ce.sequential_override, ce.sequential_enabled 
  INTO v_student_override, v_student_sequential
  FROM course_enrollments ce
  JOIN students s ON s.id = ce.student_id
  WHERE s.user_id = p_user_id
    AND ce.sequential_override = true
  LIMIT 1;
  
  -- Apply student override if present
  IF v_student_override AND v_student_sequential IS NOT NULL THEN
    v_sequential_enabled := v_student_sequential;
  END IF;
  
  -- If sequential unlock is disabled, return all as unlocked
  IF NOT v_sequential_enabled THEN
    RETURN QUERY
    SELECT 
      al.id as recording_id,
      al.recording_title,
      COALESCE(al.sequence_order, 0)::integer as sequence_order,
      m.id as module_id,
      m.title as module_title,
      true as is_unlocked,
      EXISTS(SELECT 1 FROM recording_views rv WHERE rv.recording_id = al.id AND rv.user_id = p_user_id) as is_watched,
      al.assignment_id,
      COALESCE(
        EXISTS(
          SELECT 1 FROM submissions sub 
          WHERE sub.assignment_id = al.assignment_id 
            AND sub.student_id = p_user_id 
            AND sub.status = 'approved'
        ), 
        false
      ) as assignment_completed,
      'sequential_disabled'::text as unlock_reason
    FROM available_lessons al
    LEFT JOIN modules m ON al.module = m.id
    ORDER BY COALESCE(m.order, 0), COALESCE(al.sequence_order, 0);
    RETURN;
  END IF;
  
  -- Sequential unlock is enabled
  RETURN QUERY
  WITH ordered_recordings AS (
    SELECT 
      al.id as recording_id,
      al.recording_title,
      COALESCE(al.sequence_order, 0) as sequence_order,
      m.id as module_id,
      m.title as module_title,
      al.assignment_id,
      COALESCE(m.order, 0) as module_order,
      ROW_NUMBER() OVER (ORDER BY COALESCE(m.order, 0), COALESCE(al.sequence_order, 0)) as global_order
    FROM available_lessons al
    LEFT JOIN modules m ON al.module = m.id
  ),
  recording_status AS (
    SELECT 
      orec.*,
      EXISTS(
        SELECT 1 FROM recording_views rv 
        WHERE rv.recording_id = orec.recording_id AND rv.user_id = p_user_id
      ) as is_watched,
      COALESCE(
        EXISTS(
          SELECT 1 FROM submissions sub 
          WHERE sub.assignment_id = orec.assignment_id 
            AND sub.student_id = p_user_id 
            AND sub.status = 'approved'
        ),
        false
      ) as assignment_completed,
      EXISTS(
        SELECT 1 FROM user_unlocks uu 
        WHERE uu.recording_id = orec.recording_id AND uu.user_id = p_user_id
      ) as explicitly_unlocked
    FROM ordered_recordings orec
  ),
  unlock_calculation AS (
    SELECT 
      rs.*,
      CASE
        WHEN rs.global_order = 1 AND v_fees_cleared THEN true
        WHEN rs.explicitly_unlocked THEN true
        WHEN EXISTS (
          SELECT 1 FROM recording_status prev
          WHERE prev.global_order = rs.global_order - 1
            AND prev.is_watched
            AND (prev.assignment_id IS NULL OR prev.assignment_completed)
        ) THEN true
        ELSE false
      END as is_unlocked,
      CASE
        WHEN rs.global_order = 1 AND v_fees_cleared THEN 'first_recording'
        WHEN rs.explicitly_unlocked THEN 'manually_unlocked'
        WHEN EXISTS (
          SELECT 1 FROM recording_status prev
          WHERE prev.global_order = rs.global_order - 1
            AND prev.is_watched
            AND (prev.assignment_id IS NULL OR prev.assignment_completed)
        ) THEN 'previous_completed'
        WHEN NOT v_fees_cleared THEN 'fees_not_cleared'
        ELSE 'previous_not_completed'
      END as unlock_reason
    FROM recording_status rs
  )
  SELECT 
    uc.recording_id,
    uc.recording_title,
    uc.sequence_order::integer,
    uc.module_id,
    uc.module_title,
    uc.is_unlocked,
    uc.is_watched,
    uc.assignment_id,
    uc.assignment_completed,
    uc.unlock_reason
  FROM unlock_calculation uc
  ORDER BY uc.global_order;
END;
$$;