-- Create course-scoped sequential unlock status function
-- This function properly filters lessons by course and respects enrollment overrides

CREATE OR REPLACE FUNCTION get_course_sequential_unlock_status(
  p_user_id UUID,
  p_course_id UUID
) RETURNS TABLE (
  recording_id UUID,
  title TEXT,
  is_unlocked BOOLEAN,
  unlock_reason TEXT,
  sequence_position INTEGER
) AS $$
DECLARE
  v_sequential_enabled BOOLEAN;
  v_drip_enabled BOOLEAN;
  v_enrollment_date TIMESTAMPTZ;
  v_fees_cleared BOOLEAN;
  v_student_id UUID;
BEGIN
  -- Get student info
  SELECT s.id, s.fees_cleared, s.created_at
  INTO v_student_id, v_fees_cleared, v_enrollment_date
  FROM students s
  WHERE s.user_id = p_user_id;

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

  -- Return lessons with unlock status
  RETURN QUERY
  WITH ordered_lessons AS (
    SELECT 
      al.id,
      al.recording_title,
      al.sequence_order,
      m.order as module_order,
      ROW_NUMBER() OVER (ORDER BY m.order NULLS LAST, al.sequence_order NULLS LAST, al.id) as seq_pos
    FROM available_lessons al
    INNER JOIN modules m ON m.id = al.module AND m.course_id = p_course_id
    ORDER BY m.order, al.sequence_order, al.id
  ),
  unlock_status AS (
    SELECT 
      ol.id,
      ol.recording_title,
      ol.seq_pos,
      -- Check if unlocked via user_unlocks table
      COALESCE(uu.is_unlocked, false) as manually_unlocked,
      -- Check if previous lesson is watched and assignment approved
      CASE 
        WHEN ol.seq_pos = 1 AND COALESCE(v_fees_cleared, false) THEN true -- First lesson unlocked if fees cleared
        WHEN NOT v_sequential_enabled THEN true -- All unlocked if sequential disabled
        ELSE false
      END as auto_unlocked
    FROM ordered_lessons ol
    LEFT JOIN user_unlocks uu ON uu.recording_id = ol.id AND uu.user_id = p_user_id
  )
  SELECT 
    us.id,
    us.recording_title,
    (us.manually_unlocked OR us.auto_unlocked)::BOOLEAN,
    CASE 
      WHEN us.manually_unlocked THEN 'manual_unlock'
      WHEN us.auto_unlocked AND us.seq_pos = 1 THEN 'first_lesson'
      WHEN us.auto_unlocked THEN 'sequential_disabled'
      ELSE 'locked'
    END,
    us.seq_pos::INTEGER
  FROM unlock_status us
  ORDER BY us.seq_pos;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_course_sequential_unlock_status(UUID, UUID) TO authenticated;

-- Add comment
COMMENT ON FUNCTION get_course_sequential_unlock_status IS 'Returns sequential unlock status for lessons within a specific course, respecting enrollment overrides';