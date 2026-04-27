
-- Drop existing function and recreate with new return columns
DROP FUNCTION IF EXISTS public.get_student_pathway_course_map(uuid, uuid);

-- Recreate with new columns for choice handling
CREATE OR REPLACE FUNCTION public.get_student_pathway_course_map(
  p_user_id uuid,
  p_pathway_id uuid
)
RETURNS TABLE (
  course_id uuid,
  course_title text,
  step_number integer,
  choice_group integer,
  is_available boolean,
  is_completed boolean,
  is_current boolean,
  requires_choice boolean,
  choice_options jsonb,
  is_choice_point boolean,
  is_selected_choice boolean
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
    END as choice_options,
    -- Is this a choice point course?
    COALESCE(pc.is_choice_point, false)::boolean as is_choice_point,
    -- Is this course the selected choice for its group?
    (pc.choice_group IS NOT NULL AND 
     pc.course_id IN (SELECT cs.selected_course_id FROM choice_selections cs WHERE cs.choice_group = pc.choice_group))::boolean as is_selected_choice
  FROM pathway_courses pc
  JOIN courses c ON c.id = pc.course_id
  LEFT JOIN course_completion cc ON cc.course_id = pc.course_id
  -- Include all courses - let the UI handle filtering/display
  ORDER BY pc.step_number, pc.choice_group NULLS FIRST, c.title;
END;
$$;
