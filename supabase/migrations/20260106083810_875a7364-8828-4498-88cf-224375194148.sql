-- Drop existing function to allow return type change
DROP FUNCTION IF EXISTS get_sequential_unlock_status(uuid);

-- Recreate the function with drip logic
CREATE OR REPLACE FUNCTION get_sequential_unlock_status(p_user_id uuid)
RETURNS TABLE (
  recording_id uuid,
  sequence_order integer,
  is_unlocked boolean,
  unlock_reason text,
  assignment_required boolean,
  assignment_completed boolean,
  recording_watched boolean,
  drip_locked boolean,
  drip_unlock_date timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fees_cleared boolean;
  v_sequential_enabled boolean;
  v_drip_enabled_default boolean;
  v_student_course_id uuid;
  v_student_pathway_id uuid;
  v_enrolled_at timestamp with time zone;
BEGIN
  -- Check if student has fees cleared
  SELECT s.fees_cleared INTO v_fees_cleared
  FROM students s
  WHERE s.user_id = p_user_id;

  -- If no student record or fees not cleared, return all locked
  IF v_fees_cleared IS NULL OR v_fees_cleared = false THEN
    RETURN QUERY
    SELECT 
      al.id::uuid as recording_id,
      COALESCE(al.sequence_order, 0)::integer as sequence_order,
      false as is_unlocked,
      'Fees not cleared'::text as unlock_reason,
      (al.assignment_id IS NOT NULL) as assignment_required,
      false as assignment_completed,
      false as recording_watched,
      false as drip_locked,
      NULL::timestamp with time zone as drip_unlock_date
    FROM available_lessons al
    ORDER BY al.sequence_order NULLS LAST;
    RETURN;
  END IF;

  -- Get sequential unlock and drip default settings
  SELECT 
    COALESCE(cs.lms_sequential_unlock, false),
    COALESCE(cs.drip_enabled_default, false)
  INTO v_sequential_enabled, v_drip_enabled_default
  FROM company_settings cs
  WHERE cs.id = 1;

  -- Get student's course enrollment info (use first active enrollment)
  SELECT ce.course_id, ce.pathway_id, ce.enrolled_at
  INTO v_student_course_id, v_student_pathway_id, v_enrolled_at
  FROM course_enrollments ce
  JOIN students s ON s.id = ce.student_id
  WHERE s.user_id = p_user_id
    AND ce.status = 'active'
  ORDER BY ce.enrolled_at ASC
  LIMIT 1;

  -- Default enrolled_at to now if no enrollment found
  IF v_enrolled_at IS NULL THEN
    v_enrolled_at := now();
  END IF;

  RETURN QUERY
  WITH recording_status AS (
    SELECT 
      al.id as rec_id,
      COALESCE(al.sequence_order, 0) as seq_order,
      al.assignment_id,
      COALESCE(al.drip_days, 0) as drip_days,
      -- Check if recording is watched
      EXISTS (
        SELECT 1 FROM recording_views rv 
        WHERE rv.recording_id = al.id 
          AND rv.user_id = p_user_id 
          AND rv.watched = true
      ) as is_watched,
      -- Check if assignment is completed (approved)
      EXISTS (
        SELECT 1 FROM submissions sub
        WHERE sub.assignment_id = al.assignment_id
          AND sub.student_id = p_user_id
          AND sub.status = 'approved'
      ) as is_assignment_done,
      -- Check if manually unlocked
      EXISTS (
        SELECT 1 FROM user_unlocks uu
        WHERE uu.user_id = p_user_id
          AND uu.recording_id = al.id
          AND uu.is_unlocked = true
      ) as is_manually_unlocked,
      -- Get course/pathway drip settings
      COALESCE(
        (SELECT c.drip_enabled FROM courses c WHERE c.id = v_student_course_id),
        (SELECT lp.drip_enabled FROM learning_pathways lp WHERE lp.id = v_student_pathway_id),
        v_drip_enabled_default
      ) as effective_drip_enabled
    FROM available_lessons al
  ),
  ordered_recordings AS (
    SELECT 
      rs.*,
      ROW_NUMBER() OVER (ORDER BY rs.seq_order NULLS LAST) as row_num,
      LAG(rs.is_watched) OVER (ORDER BY rs.seq_order NULLS LAST) as prev_watched,
      LAG(rs.is_assignment_done) OVER (ORDER BY rs.seq_order NULLS LAST) as prev_assignment_done,
      LAG(rs.assignment_id) OVER (ORDER BY rs.seq_order NULLS LAST) as prev_assignment_id,
      -- Calculate drip unlock date
      v_enrolled_at + (rs.drip_days || ' days')::interval as calc_drip_unlock_date,
      -- Check if drip timing is met
      CASE 
        WHEN rs.effective_drip_enabled = true THEN
          now() >= v_enrolled_at + (rs.drip_days || ' days')::interval
        ELSE true
      END as drip_timing_met
    FROM recording_status rs
  )
  SELECT 
    orr.rec_id::uuid as recording_id,
    orr.seq_order::integer as sequence_order,
    -- Determine if unlocked
    CASE
      -- Manually unlocked always wins
      WHEN orr.is_manually_unlocked THEN true
      -- First recording is unlocked if drip timing is met
      WHEN orr.row_num = 1 THEN orr.drip_timing_met
      -- Sequential logic: previous must be watched and assignment completed (if required)
      WHEN v_sequential_enabled THEN
        CASE
          WHEN orr.prev_assignment_id IS NOT NULL THEN
            orr.prev_watched AND orr.prev_assignment_done AND orr.drip_timing_met
          ELSE
            orr.prev_watched AND orr.drip_timing_met
        END
      -- Non-sequential: just check drip timing
      ELSE orr.drip_timing_met
    END as is_unlocked,
    -- Determine unlock reason
    CASE
      WHEN orr.is_manually_unlocked THEN 'Manually unlocked'
      WHEN orr.row_num = 1 AND NOT orr.drip_timing_met THEN 
        'Available on ' || to_char(orr.calc_drip_unlock_date, 'Mon DD, YYYY')
      WHEN orr.row_num = 1 THEN 'First recording'
      WHEN NOT orr.drip_timing_met THEN 
        'Available on ' || to_char(orr.calc_drip_unlock_date, 'Mon DD, YYYY')
      WHEN v_sequential_enabled AND orr.prev_assignment_id IS NOT NULL AND NOT orr.prev_watched THEN
        'Watch previous recording first'
      WHEN v_sequential_enabled AND orr.prev_assignment_id IS NOT NULL AND NOT orr.prev_assignment_done THEN
        'Complete previous assignment first'
      WHEN v_sequential_enabled AND NOT orr.prev_watched THEN
        'Watch previous recording first'
      ELSE 'Unlocked'
    END::text as unlock_reason,
    (orr.assignment_id IS NOT NULL) as assignment_required,
    orr.is_assignment_done as assignment_completed,
    orr.is_watched as recording_watched,
    (orr.effective_drip_enabled = true AND NOT orr.drip_timing_met) as drip_locked,
    CASE 
      WHEN orr.effective_drip_enabled = true AND NOT orr.drip_timing_met 
      THEN orr.calc_drip_unlock_date 
      ELSE NULL 
    END as drip_unlock_date
  FROM ordered_recordings orr
  ORDER BY orr.seq_order NULLS LAST;
END;
$$;