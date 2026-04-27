-- Update advance_pathway to handle choice point transitions gracefully
CREATE OR REPLACE FUNCTION public.advance_pathway(p_user_id uuid, p_pathway_id uuid, p_selected_course_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_first_choice_course_id uuid;
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
      -- NEW BEHAVIOR: Instead of returning error, move to choice point
      -- Get first course in choice group as temporary placeholder
      SELECT pc.course_id INTO v_first_choice_course_id
      FROM pathway_courses pc
      WHERE pc.pathway_id = p_pathway_id 
        AND pc.choice_group = v_choice_group
      ORDER BY pc.course_id
      LIMIT 1;
      
      -- Move enrollment to the choice point step
      UPDATE course_enrollments
      SET course_id = v_first_choice_course_id, updated_at = NOW()
      WHERE id = v_enrollment_id;
      
      -- Return success with awaiting_choice flag
      RETURN jsonb_build_object(
        'success', true, 
        'awaiting_choice', true, 
        'choice_group', v_choice_group,
        'next_step', v_next_step
      );
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
$function$;