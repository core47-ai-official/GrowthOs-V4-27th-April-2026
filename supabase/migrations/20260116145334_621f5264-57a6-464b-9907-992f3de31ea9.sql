-- Fix the is_course_fully_completed function to use correct table names
CREATE OR REPLACE FUNCTION public.is_course_fully_completed(p_user_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_recordings integer;
  v_watched_recordings integer;
  v_required_assignments integer;
  v_approved_assignments integer;
  v_student_id uuid;
BEGIN
  -- Get student_id from students table
  SELECT id INTO v_student_id
  FROM students
  WHERE user_id = p_user_id;
  
  IF v_student_id IS NULL THEN
    RETURN false;
  END IF;

  -- Count total recordings in the course (via modules)
  SELECT COUNT(*) INTO v_total_recordings
  FROM available_lessons al
  JOIN modules m ON al.module = m.id
  WHERE m.course_id = p_course_id;

  -- Count watched recordings (using recording_views table)
  SELECT COUNT(DISTINCT rv.recording_id) INTO v_watched_recordings
  FROM recording_views rv
  JOIN available_lessons al ON rv.recording_id = al.id
  JOIN modules m ON al.module = m.id
  WHERE rv.user_id = p_user_id
    AND m.course_id = p_course_id;

  -- If not all recordings watched, course is not complete
  IF v_total_recordings > 0 AND v_watched_recordings < v_total_recordings THEN
    RETURN false;
  END IF;

  -- Count required assignments for this course
  SELECT COUNT(*) INTO v_required_assignments
  FROM assignments
  WHERE course_id = p_course_id;

  -- If no assignments, only check recordings
  IF v_required_assignments = 0 THEN
    RETURN v_total_recordings > 0 AND v_watched_recordings >= v_total_recordings;
  END IF;

  -- Count approved assignment submissions (using submissions table)
  SELECT COUNT(DISTINCT s.assignment_id) INTO v_approved_assignments
  FROM submissions s
  JOIN assignments a ON s.assignment_id = a.id
  WHERE s.student_id = v_student_id
    AND a.course_id = p_course_id
    AND s.status = 'approved';

  -- Course is complete if all recordings watched AND all assignments approved
  RETURN v_watched_recordings >= v_total_recordings 
     AND v_approved_assignments >= v_required_assignments;
END;
$$;

-- Fix get_student_active_pathway to use correct table references
CREATE OR REPLACE FUNCTION public.get_student_active_pathway(p_user_id uuid)
RETURNS TABLE(
  pathway_id uuid,
  pathway_name text,
  current_course_id uuid,
  current_course_title text,
  current_step_number integer,
  total_steps integer,
  has_pending_choice boolean,
  choice_group integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
BEGIN
  -- Get student_id
  SELECT id INTO v_student_id
  FROM students
  WHERE user_id = p_user_id;
  
  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH active_pathway_enrollment AS (
    -- Find the active pathway enrollment (enrollment_source = 'pathway')
    SELECT ce.pathway_id, ce.course_id as current_course_id
    FROM course_enrollments ce
    WHERE ce.student_id = v_student_id
      AND ce.pathway_id IS NOT NULL
      AND ce.status = 'active'
      AND ce.enrollment_source = 'pathway'
    LIMIT 1
  ),
  pathway_info AS (
    SELECT 
      lp.id as pathway_id,
      lp.name as pathway_name,
      ape.current_course_id,
      (SELECT COUNT(*) FROM pathway_courses pc WHERE pc.pathway_id = lp.id) as total_steps
    FROM active_pathway_enrollment ape
    JOIN learning_pathways lp ON lp.id = ape.pathway_id
  ),
  current_step AS (
    SELECT 
      pi.*,
      c.title as current_course_title,
      pc.step_number as current_step_number,
      pc.choice_group,
      pc.is_choice_point
    FROM pathway_info pi
    JOIN courses c ON c.id = pi.current_course_id
    JOIN pathway_courses pc ON pc.pathway_id = pi.pathway_id AND pc.course_id = pi.current_course_id
  )
  SELECT 
    cs.pathway_id,
    cs.pathway_name,
    cs.current_course_id,
    cs.current_course_title,
    cs.current_step_number::integer,
    cs.total_steps::integer,
    -- Check if current step is a choice point and choice hasn't been made
    (cs.is_choice_point = true AND NOT EXISTS (
      SELECT 1 FROM pathway_choice_selections pcs 
      WHERE pcs.student_id = v_student_id 
        AND pcs.pathway_id = cs.pathway_id 
        AND pcs.choice_group = cs.choice_group
    ))::boolean as has_pending_choice,
    cs.choice_group::integer
  FROM current_step cs;
END;
$$;

-- Fix get_student_pathway_course_map to use correct tables
CREATE OR REPLACE FUNCTION public.get_student_pathway_course_map(p_user_id uuid, p_pathway_id uuid)
RETURNS TABLE(
  course_id uuid,
  course_title text,
  step_number integer,
  choice_group integer,
  is_available boolean,
  is_completed boolean,
  is_current boolean,
  requires_choice boolean,
  choice_options jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_current_course_id uuid;
  v_current_step integer;
BEGIN
  -- Get student_id
  SELECT id INTO v_student_id
  FROM students
  WHERE user_id = p_user_id;
  
  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  -- Get current course from the pathway enrollment
  SELECT ce.course_id INTO v_current_course_id
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id
    AND ce.pathway_id = p_pathway_id
    AND ce.status = 'active'
    AND ce.enrollment_source = 'pathway'
  LIMIT 1;

  -- Get current step number
  SELECT pc.step_number INTO v_current_step
  FROM pathway_courses pc
  WHERE pc.pathway_id = p_pathway_id AND pc.course_id = v_current_course_id;

  RETURN QUERY
  WITH course_completion AS (
    SELECT 
      pc.course_id,
      public.is_course_fully_completed(p_user_id, pc.course_id) as completed
    FROM pathway_courses pc
    WHERE pc.pathway_id = p_pathway_id
  ),
  choice_selections AS (
    SELECT pcs.choice_group, pcs.selected_course_id
    FROM pathway_choice_selections pcs
    WHERE pcs.student_id = v_student_id AND pcs.pathway_id = p_pathway_id
  )
  SELECT 
    pc.course_id,
    c.title as course_title,
    pc.step_number::integer,
    pc.choice_group::integer,
    -- Available if: step <= current step, or is the current course, or previous step completed
    (pc.step_number <= v_current_step OR pc.course_id = v_current_course_id)::boolean as is_available,
    COALESCE(cc.completed, false)::boolean as is_completed,
    (pc.course_id = v_current_course_id)::boolean as is_current,
    -- Requires choice if it's a choice point and this specific course hasn't been selected
    (pc.is_choice_point = true AND pc.choice_group IS NOT NULL AND 
     NOT EXISTS (SELECT 1 FROM choice_selections cs WHERE cs.choice_group = pc.choice_group))::boolean as requires_choice,
    -- Get choice options for choice points
    CASE 
      WHEN pc.is_choice_point = true AND pc.choice_group IS NOT NULL THEN
        (SELECT jsonb_agg(jsonb_build_object('course_id', pc2.course_id, 'course_title', c2.title))
         FROM pathway_courses pc2
         JOIN courses c2 ON c2.id = pc2.course_id
         WHERE pc2.pathway_id = p_pathway_id AND pc2.choice_group = pc.choice_group)
      ELSE NULL
    END as choice_options
  FROM pathway_courses pc
  JOIN courses c ON c.id = pc.course_id
  LEFT JOIN course_completion cc ON cc.course_id = pc.course_id
  -- Filter out non-selected choice courses
  WHERE (pc.choice_group IS NULL 
         OR NOT EXISTS (SELECT 1 FROM choice_selections cs WHERE cs.choice_group = pc.choice_group)
         OR pc.course_id IN (SELECT cs.selected_course_id FROM choice_selections cs))
  ORDER BY pc.step_number;
END;
$$;

-- Fix advance_pathway to use correct tables
CREATE OR REPLACE FUNCTION public.advance_pathway(
  p_user_id uuid, 
  p_pathway_id uuid, 
  p_selected_course_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_current_course_id uuid;
  v_current_step integer;
  v_next_step integer;
  v_next_course_id uuid;
  v_is_choice_point boolean;
  v_choice_group integer;
  v_total_steps integer;
  v_enrollment_id uuid;
BEGIN
  -- Get student_id
  SELECT id INTO v_student_id
  FROM students
  WHERE user_id = p_user_id;
  
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found');
  END IF;

  -- Get current enrollment
  SELECT ce.id, ce.course_id INTO v_enrollment_id, v_current_course_id
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id
    AND ce.pathway_id = p_pathway_id
    AND ce.status = 'active'
    AND ce.enrollment_source = 'pathway'
  LIMIT 1;
  
  IF v_enrollment_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active pathway enrollment found');
  END IF;

  -- Check if current course is completed
  IF NOT public.is_course_fully_completed(p_user_id, v_current_course_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current course not completed');
  END IF;

  -- Get current step info
  SELECT pc.step_number, pc.choice_group, pc.is_choice_point
  INTO v_current_step, v_choice_group, v_is_choice_point
  FROM pathway_courses pc
  WHERE pc.pathway_id = p_pathway_id AND pc.course_id = v_current_course_id;

  -- Get total steps
  SELECT COUNT(DISTINCT step_number) INTO v_total_steps
  FROM pathway_courses
  WHERE pathway_id = p_pathway_id;

  -- Calculate next step
  v_next_step := v_current_step + 1;

  -- Check if pathway is complete
  IF v_next_step > v_total_steps THEN
    -- Mark enrollment as completed
    UPDATE course_enrollments
    SET status = 'completed', completed_at = NOW(), updated_at = NOW()
    WHERE id = v_enrollment_id;
    
    RETURN jsonb_build_object('success', true, 'completed', true, 'message', 'Pathway completed!');
  END IF;

  -- Check if next step has choice points
  SELECT pc.course_id, pc.is_choice_point, pc.choice_group
  INTO v_next_course_id, v_is_choice_point, v_choice_group
  FROM pathway_courses pc
  WHERE pc.pathway_id = p_pathway_id AND pc.step_number = v_next_step
  LIMIT 1;

  -- If next step is a choice point
  IF v_is_choice_point AND v_choice_group IS NOT NULL THEN
    -- Check if a selection was provided
    IF p_selected_course_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Choice required', 'choice_group', v_choice_group);
    END IF;
    
    -- Validate the selection belongs to this choice group
    IF NOT EXISTS (
      SELECT 1 FROM pathway_courses pc
      WHERE pc.pathway_id = p_pathway_id 
        AND pc.choice_group = v_choice_group 
        AND pc.course_id = p_selected_course_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid course selection for choice group');
    END IF;
    
    -- Record the choice
    INSERT INTO pathway_choice_selections (student_id, pathway_id, choice_group, selected_course_id)
    VALUES (v_student_id, p_pathway_id, v_choice_group, p_selected_course_id)
    ON CONFLICT (student_id, pathway_id, choice_group) 
    DO UPDATE SET selected_course_id = p_selected_course_id;
    
    v_next_course_id := p_selected_course_id;
  END IF;

  -- Update enrollment to next course
  UPDATE course_enrollments
  SET course_id = v_next_course_id, updated_at = NOW()
  WHERE id = v_enrollment_id;

  RETURN jsonb_build_object(
    'success', true, 
    'next_course_id', v_next_course_id,
    'next_step', v_next_step,
    'completed', false
  );
END;
$$;