-- Update get_course_sequential_unlock_status to preserve access to already-watched videos
-- When a batch is assigned later, videos the student already watched remain unlocked

CREATE OR REPLACE FUNCTION public.get_course_sequential_unlock_status(
  p_user_id UUID,
  p_course_id UUID
)
RETURNS TABLE (
  recording_id UUID,
  recording_title TEXT,
  is_unlocked BOOLEAN,
  unlock_reason TEXT,
  sequence_position INTEGER,
  lock_reason TEXT,
  drip_unlock_date TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sequential_enabled BOOLEAN;
  v_drip_enabled BOOLEAN;
  v_drip_base_date TIMESTAMPTZ; -- The date from which drip days are calculated
  v_fees_cleared BOOLEAN;
  v_student_id UUID;
  v_enrollment_date TIMESTAMPTZ;
  v_batch_id UUID;
  v_batch_start_date DATE;
  v_first_installment_paid BOOLEAN;
  v_pathway_id UUID;
BEGIN
  -- Get student info
  SELECT s.id, s.fees_cleared, s.enrollment_date
  INTO v_student_id, v_fees_cleared, v_enrollment_date
  FROM students s
  WHERE s.user_id = p_user_id;

  -- Get batch_id and pathway_id from enrollment if exists
  SELECT ce.batch_id, ce.pathway_id
  INTO v_batch_id, v_pathway_id
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id AND ce.course_id = p_course_id
  LIMIT 1;

  -- If batch is assigned, get batch start_date
  IF v_batch_id IS NOT NULL THEN
    SELECT b.start_date
    INTO v_batch_start_date
    FROM batches b
    WHERE b.id = v_batch_id;
  END IF;

  -- Check if first installment is paid for this course or pathway
  -- This allows access even if later installments are pending
  IF v_pathway_id IS NOT NULL THEN
    -- Check pathway's first invoice
    SELECT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.student_id = v_student_id 
        AND i.pathway_id = v_pathway_id
        AND i.installment_number = 1
        AND i.status = 'paid'
    ) INTO v_first_installment_paid;
  ELSE
    -- Check course's first invoice
    SELECT EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.student_id = v_student_id 
        AND i.course_id = p_course_id
        AND i.installment_number = 1
        AND i.status = 'paid'
    ) INTO v_first_installment_paid;
  END IF;

  -- Use first installment paid status OR global fees_cleared (for backward compatibility)
  v_fees_cleared := COALESCE(v_first_installment_paid, false) OR COALESCE(v_fees_cleared, false);

  -- Determine the base date for drip calculation
  -- Priority: batch start_date > student enrollment_date > now()
  IF v_batch_start_date IS NOT NULL THEN
    v_drip_base_date := v_batch_start_date::timestamptz;
  ELSIF v_enrollment_date IS NOT NULL THEN
    v_drip_base_date := v_enrollment_date;
  ELSE
    v_drip_base_date := now();
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
      -- NEW: Check if THIS (current) lesson was already watched
      COALESCE(curr_rv.watched, false) as current_watched,
      -- Check previous assignment status
      prev_sub.status as prev_assignment_status,
      -- Check if this lesson's assignment exists and its status
      sub.status as current_assignment_status,
      -- Calculate drip unlock date using batch start_date or enrollment_date
      CASE 
        WHEN v_drip_enabled AND pls.drip_days IS NOT NULL THEN
          v_drip_base_date + (pls.drip_days || ' days')::interval
        ELSE NULL
      END as calculated_drip_date
    FROM prev_lesson_status pls
    LEFT JOIN user_unlocks uu ON uu.recording_id = pls.id AND uu.user_id = p_user_id
    LEFT JOIN recording_views rv ON rv.recording_id = pls.prev_lesson_id AND rv.user_id = p_user_id
    -- NEW: Join for current recording's watch status
    LEFT JOIN recording_views curr_rv ON curr_rv.recording_id = pls.id AND curr_rv.user_id = p_user_id
    LEFT JOIN submissions sub ON sub.assignment_id = pls.assignment_id AND sub.student_id = p_user_id
    LEFT JOIN submissions prev_sub ON prev_sub.assignment_id = pls.prev_assignment_id AND prev_sub.student_id = p_user_id
  )
  SELECT 
    fs.id as recording_id,
    fs.recording_title::text,
    -- Determine if unlocked (NEW: current_watched always unlocks)
    (
      fs.current_watched OR  -- NEW: Already watched = always unlocked (preserves progress)
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
    -- Unlock reason (NEW: 'already_watched' takes highest priority)
    CASE 
      WHEN fs.current_watched THEN 'already_watched'
      WHEN fs.manually_unlocked THEN 'manually_unlocked'
      WHEN NOT v_sequential_enabled THEN 'sequential_disabled'
      WHEN fs.seq_pos = 1 AND COALESCE(v_fees_cleared, false) THEN 'first_lesson'
      WHEN fs.seq_pos > 1 AND COALESCE(v_fees_cleared, false) AND fs.prev_watched 
           AND (fs.prev_assignment_id IS NULL OR fs.prev_assignment_status = 'approved')
           AND (fs.calculated_drip_date IS NULL OR fs.calculated_drip_date <= now()) THEN 'requirements_met'
      ELSE 'locked'
    END::text as unlock_reason,
    fs.seq_pos::integer as sequence_position,
    -- Lock reason (more specific)
    CASE
      WHEN fs.current_watched THEN NULL  -- NEW: No lock reason if already watched
      WHEN fs.manually_unlocked THEN NULL
      WHEN NOT v_sequential_enabled THEN NULL
      WHEN fs.seq_pos = 1 AND NOT COALESCE(v_fees_cleared, false) THEN 'fees_not_cleared'
      WHEN fs.seq_pos > 1 AND NOT COALESCE(v_fees_cleared, false) THEN 'fees_not_cleared'
      WHEN fs.seq_pos > 1 AND NOT fs.prev_watched THEN 'previous_lesson_not_watched'
      WHEN fs.seq_pos > 1 AND fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status IS NULL THEN 'previous_assignment_not_submitted'
      WHEN fs.seq_pos > 1 AND fs.prev_assignment_id IS NOT NULL AND fs.prev_assignment_status != 'approved' THEN 'previous_assignment_not_approved'
      WHEN fs.calculated_drip_date IS NOT NULL AND fs.calculated_drip_date > now() THEN 'drip_locked'
      ELSE NULL
    END::text as lock_reason,
    fs.calculated_drip_date as drip_unlock_date
  FROM full_status fs
  ORDER BY fs.seq_pos;
END;
$$;

-- Add updated comment
COMMENT ON FUNCTION public.get_course_sequential_unlock_status(uuid, uuid) IS 'Returns sequential unlock status for course recordings. Videos already watched remain unlocked even if batch is assigned later with a newer start date. Drip calculation uses batch start_date if assigned, otherwise falls back to enrollment_date.';