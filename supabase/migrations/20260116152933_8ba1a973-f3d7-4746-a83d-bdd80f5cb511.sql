-- Drop and recreate the RPC to include detailed lock reasons
DROP FUNCTION IF EXISTS public.get_course_sequential_unlock_status(uuid, uuid);

CREATE OR REPLACE FUNCTION public.get_course_sequential_unlock_status(
  p_user_id uuid,
  p_course_id uuid
)
RETURNS TABLE (
  recording_id uuid,
  recording_title text,
  is_unlocked boolean,
  unlock_reason text,
  sequence_position integer,
  lock_reason text,
  drip_unlock_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequential_enabled BOOLEAN;
  v_drip_enabled BOOLEAN;
  v_enrollment_date TIMESTAMPTZ;
  v_fees_cleared BOOLEAN;
  v_student_id UUID;
BEGIN
  -- Get student info
  SELECT s.id, s.fees_cleared, s.enrollment_date
  INTO v_student_id, v_fees_cleared, v_enrollment_date
  FROM students s
  WHERE s.user_id = p_user_id;

  -- Default enrollment date to now if not set
  IF v_enrollment_date IS NULL THEN
    v_enrollment_date := now();
  END IF;

  -- Check enrollment overrides for sequential unlock
  SELECT 
    COALESCE(
      CASE WHEN ce.sequential_override = true THEN ce.sequential_enabled ELSE NULL END,
      c.drip_enabled,
      (SELECT lms_sequential_unlock FROM company_settings LIMIT 1),
      true
    ),
    COALESCE(
      CASE WHEN ce.drip_override = true THEN ce.drip_enabled ELSE NULL END,
      c.drip_enabled,
      (SELECT drip_enabled_default FROM company_settings LIMIT 1),
      false
    )
  INTO v_sequential_enabled, v_drip_enabled
  FROM courses c
  LEFT JOIN course_enrollments ce ON ce.course_id = c.id AND ce.student_id = v_student_id
  WHERE c.id = p_course_id;

  -- Return lessons with unlock status and lock reasons
  RETURN QUERY
  WITH ordered_lessons AS (
    SELECT 
      al.id,
      al.recording_title,
      al.sequence_order,
      al.drip_days,
      al.assignment_id,
      m.order as module_order,
      ROW_NUMBER() OVER (ORDER BY m.order NULLS LAST, al.sequence_order NULLS LAST, al.id) as seq_pos
    FROM available_lessons al
    INNER JOIN modules m ON m.id = al.module AND m.course_id = p_course_id
    ORDER BY m.order, al.sequence_order, al.id
  ),
  prev_lesson_status AS (
    SELECT 
      ol.id,
      ol.recording_title,
      ol.seq_pos,
      ol.drip_days,
      ol.assignment_id,
      -- Get previous lesson info
      LAG(ol.id) OVER (ORDER BY ol.seq_pos) as prev_lesson_id,
      LAG(ol.assignment_id) OVER (ORDER BY ol.seq_pos) as prev_assignment_id
    FROM ordered_lessons ol
  ),
  full_status AS (
    SELECT 
      pls.id,
      pls.recording_title,
      pls.seq_pos,
      pls.drip_days,
      pls.assignment_id,
      pls.prev_lesson_id,
      pls.prev_assignment_id,
      -- Check if manually unlocked
      COALESCE(uu.is_unlocked, false) as manually_unlocked,
      -- Check if previous lesson was watched
      COALESCE(rv.watched, false) as prev_watched,
      -- Check previous assignment status
      prev_sub.status as prev_assignment_status,
      -- Check if this lesson's assignment exists and its status
      sub.status as current_assignment_status,
      -- Calculate drip unlock date
      CASE 
        WHEN v_drip_enabled AND pls.drip_days IS NOT NULL THEN
          v_enrollment_date + (pls.drip_days || ' days')::interval
        ELSE NULL
      END as calculated_drip_date
    FROM prev_lesson_status pls
    LEFT JOIN user_unlocks uu ON uu.recording_id = pls.id AND uu.user_id = p_user_id
    LEFT JOIN recording_views rv ON rv.recording_id = pls.prev_lesson_id AND rv.user_id = p_user_id
    LEFT JOIN submissions sub ON sub.assignment_id = pls.assignment_id AND sub.student_id = p_user_id
    LEFT JOIN submissions prev_sub ON prev_sub.assignment_id = pls.prev_assignment_id AND prev_sub.student_id = p_user_id
  )
  SELECT 
    fs.id as recording_id,
    fs.recording_title::text,
    -- Determine if unlocked
    (
      fs.manually_unlocked OR 
      NOT v_sequential_enabled OR 
      (fs.seq_pos = 1 AND COALESCE(v_fees_cleared, false)) OR
      (
        fs.seq_pos > 1 AND
        COALESCE(v_fees_cleared, false) AND
        fs.prev_watched AND
        (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved') AND
        (fs.calculated_drip_date IS NULL OR fs.calculated_drip_date <= now())
      )
    )::BOOLEAN as is_unlocked,
    -- Unlock reason
    CASE 
      WHEN fs.manually_unlocked THEN 'manual_unlock'
      WHEN NOT v_sequential_enabled THEN 'sequential_disabled'
      WHEN fs.seq_pos = 1 AND COALESCE(v_fees_cleared, false) THEN 'first_lesson'
      WHEN fs.seq_pos > 1 AND fs.prev_watched AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved') AND (fs.calculated_drip_date IS NULL OR fs.calculated_drip_date <= now()) THEN 'completed_requirements'
      ELSE 'locked'
    END::text as unlock_reason,
    fs.seq_pos::INTEGER as sequence_position,
    -- Detailed lock reason
    CASE
      WHEN fs.manually_unlocked OR NOT v_sequential_enabled THEN NULL
      WHEN NOT COALESCE(v_fees_cleared, false) THEN 'fees_not_cleared'
      WHEN fs.seq_pos = 1 THEN NULL -- First lesson unlocked if fees cleared
      WHEN NOT fs.prev_watched THEN 'previous_lesson_not_watched'
      WHEN fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status IS NULL THEN 'previous_assignment_not_submitted'
      WHEN fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status NOT IN ('approved') THEN 'previous_assignment_not_approved'
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      ELSE NULL
    END::text as lock_reason,
    fs.calculated_drip_date as drip_unlock_date
  FROM full_status fs
  ORDER BY fs.seq_pos;
END;
$$;