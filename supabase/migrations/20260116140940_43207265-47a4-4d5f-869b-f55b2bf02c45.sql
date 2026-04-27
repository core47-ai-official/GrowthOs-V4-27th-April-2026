-- Phase 1: Add enrollment_source to distinguish direct vs pathway access
ALTER TABLE public.course_enrollments 
ADD COLUMN IF NOT EXISTS enrollment_source text NOT NULL DEFAULT 'direct';

-- Add check constraint for valid values
ALTER TABLE public.course_enrollments 
ADD CONSTRAINT course_enrollments_enrollment_source_check 
CHECK (enrollment_source IN ('direct', 'pathway'));

-- Update existing pathway enrollments to have correct source
UPDATE public.course_enrollments 
SET enrollment_source = 'pathway' 
WHERE pathway_id IS NOT NULL;

-- Phase 1: Create pathway_choice_selections table for choice points
CREATE TABLE IF NOT EXISTS public.pathway_choice_selections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  pathway_id uuid NOT NULL REFERENCES public.learning_pathways(id) ON DELETE CASCADE,
  choice_group integer NOT NULL,
  selected_course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pathway_choice_selections_unique UNIQUE (student_id, pathway_id, choice_group)
);

-- Enable RLS
ALTER TABLE public.pathway_choice_selections ENABLE ROW LEVEL SECURITY;

-- RLS policies for pathway_choice_selections
CREATE POLICY "Students can view their own choices"
ON public.pathway_choice_selections FOR SELECT
USING (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);

CREATE POLICY "Students can insert their own choices"
ON public.pathway_choice_selections FOR INSERT
WITH CHECK (
  student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);

CREATE POLICY "Admins can manage all choices"
ON public.pathway_choice_selections FOR ALL
USING (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('superadmin', 'admin', 'mentor'))
);

-- Phase 2: Function to check if a course is fully completed (videos watched + assignments approved)
CREATE OR REPLACE FUNCTION public.is_course_fully_completed(p_user_id uuid, p_course_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id uuid;
  v_total_lessons integer;
  v_watched_lessons integer;
  v_total_required_assignments integer;
  v_approved_assignments integer;
BEGIN
  -- Get student_id from user_id
  SELECT id INTO v_student_id FROM students WHERE user_id = p_user_id;
  IF v_student_id IS NULL THEN
    RETURN false;
  END IF;

  -- Count total lessons in the course (via modules)
  SELECT COUNT(*) INTO v_total_lessons
  FROM available_lessons al
  JOIN modules m ON al.module = m.id
  WHERE m.course_id = p_course_id;

  -- If no lessons, consider complete
  IF v_total_lessons = 0 THEN
    RETURN true;
  END IF;

  -- Count watched lessons
  SELECT COUNT(DISTINCT sr.recording_id) INTO v_watched_lessons
  FROM student_recordings sr
  JOIN available_lessons al ON sr.recording_id = al.id
  JOIN modules m ON al.module = m.id
  WHERE sr.student_id = v_student_id
    AND m.course_id = p_course_id
    AND sr.watched = true;

  -- Check if all lessons are watched
  IF v_watched_lessons < v_total_lessons THEN
    RETURN false;
  END IF;

  -- Count required assignments (lessons with assignment_id)
  SELECT COUNT(*) INTO v_total_required_assignments
  FROM available_lessons al
  JOIN modules m ON al.module = m.id
  WHERE m.course_id = p_course_id
    AND al.assignment_id IS NOT NULL;

  -- If no assignments required, course is complete
  IF v_total_required_assignments = 0 THEN
    RETURN true;
  END IF;

  -- Count approved assignments (latest version must be approved)
  SELECT COUNT(DISTINCT sa.assignment_id) INTO v_approved_assignments
  FROM student_assignments sa
  JOIN available_lessons al ON sa.assignment_id = al.assignment_id
  JOIN modules m ON al.module = m.id
  WHERE sa.student_id = v_student_id
    AND m.course_id = p_course_id
    AND sa.status = 'approved'
    AND sa.version = (
      SELECT MAX(sa2.version) 
      FROM student_assignments sa2 
      WHERE sa2.student_id = sa.student_id 
        AND sa2.assignment_id = sa.assignment_id
    );

  RETURN v_approved_assignments >= v_total_required_assignments;
END;
$$;

-- Phase 1 & 2: Function to get student's active pathway and current course
CREATE OR REPLACE FUNCTION public.get_student_active_pathway(p_user_id uuid)
RETURNS TABLE (
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
  v_pathway_id uuid;
  v_current_step integer;
  v_has_choice boolean := false;
  v_choice_group integer := null;
BEGIN
  -- Get student_id
  SELECT id INTO v_student_id FROM students WHERE user_id = p_user_id;
  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  -- Find active pathway enrollment
  SELECT ce.pathway_id INTO v_pathway_id
  FROM course_enrollments ce
  WHERE ce.student_id = v_student_id
    AND ce.pathway_id IS NOT NULL
    AND ce.status = 'active'
    AND ce.enrollment_source = 'pathway'
  ORDER BY ce.enrolled_at DESC
  LIMIT 1;

  IF v_pathway_id IS NULL THEN
    RETURN;
  END IF;

  -- Find the current step: highest step_number where course is enrolled and not yet fully completed
  -- Or the next step after the last completed one
  WITH enrolled_courses AS (
    SELECT pc.course_id, pc.step_number, pc.choice_group,
           COALESCE(is_course_fully_completed(p_user_id, pc.course_id), false) as is_completed
    FROM pathway_courses pc
    JOIN course_enrollments ce ON ce.course_id = pc.course_id 
      AND ce.student_id = v_student_id 
      AND ce.pathway_id = v_pathway_id
    WHERE pc.pathway_id = v_pathway_id
  ),
  current_progress AS (
    SELECT 
      COALESCE(MAX(CASE WHEN is_completed THEN step_number ELSE 0 END), 0) as last_completed_step,
      MIN(CASE WHEN NOT is_completed THEN step_number END) as current_active_step
    FROM enrolled_courses
  )
  SELECT 
    COALESCE(cp.current_active_step, cp.last_completed_step + 1) INTO v_current_step
  FROM current_progress cp;

  -- Check if current step is a choice point that hasn't been decided
  SELECT pc.choice_group INTO v_choice_group
  FROM pathway_courses pc
  WHERE pc.pathway_id = v_pathway_id
    AND pc.step_number = v_current_step
    AND pc.choice_group IS NOT NULL
  LIMIT 1;

  IF v_choice_group IS NOT NULL THEN
    -- Check if choice has been made
    IF NOT EXISTS (
      SELECT 1 FROM pathway_choice_selections pcs
      WHERE pcs.student_id = v_student_id
        AND pcs.pathway_id = v_pathway_id
        AND pcs.choice_group = v_choice_group
    ) THEN
      v_has_choice := true;
    END IF;
  END IF;

  -- Return the pathway info
  RETURN QUERY
  SELECT 
    lp.id as pathway_id,
    lp.name as pathway_name,
    pc.course_id as current_course_id,
    c.title as current_course_title,
    pc.step_number as current_step_number,
    (SELECT MAX(step_number) FROM pathway_courses WHERE pathway_id = v_pathway_id) as total_steps,
    v_has_choice as has_pending_choice,
    v_choice_group as choice_group
  FROM learning_pathways lp
  JOIN pathway_courses pc ON pc.pathway_id = lp.id AND pc.step_number = v_current_step
  JOIN courses c ON c.id = pc.course_id
  WHERE lp.id = v_pathway_id
  -- If it's a choice group, only return the selected course (or first one if not yet selected)
  AND (
    pc.choice_group IS NULL 
    OR pc.course_id = (
      SELECT COALESCE(
        (SELECT pcs.selected_course_id FROM pathway_choice_selections pcs 
         WHERE pcs.student_id = v_student_id AND pcs.pathway_id = v_pathway_id AND pcs.choice_group = pc.choice_group),
        (SELECT pc2.course_id FROM pathway_courses pc2 
         WHERE pc2.pathway_id = v_pathway_id AND pc2.step_number = v_current_step 
         ORDER BY pc2.course_id LIMIT 1)
      )
    )
  )
  LIMIT 1;
END;
$$;

-- Function to get pathway course map with availability status
CREATE OR REPLACE FUNCTION public.get_student_pathway_course_map(p_user_id uuid, p_pathway_id uuid)
RETURNS TABLE (
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
  v_current_step integer;
BEGIN
  -- Get student_id
  SELECT id INTO v_student_id FROM students WHERE user_id = p_user_id;
  IF v_student_id IS NULL THEN
    RETURN;
  END IF;

  -- Get current step
  SELECT gap.current_step_number INTO v_current_step
  FROM get_student_active_pathway(p_user_id) gap
  WHERE gap.pathway_id = p_pathway_id;

  v_current_step := COALESCE(v_current_step, 1);

  RETURN QUERY
  WITH course_status AS (
    SELECT 
      pc.course_id,
      c.title as course_title,
      pc.step_number,
      pc.choice_group,
      COALESCE(is_course_fully_completed(p_user_id, pc.course_id), false) as is_completed,
      EXISTS (
        SELECT 1 FROM course_enrollments ce 
        WHERE ce.student_id = v_student_id 
          AND ce.course_id = pc.course_id 
          AND ce.pathway_id = p_pathway_id
      ) as is_enrolled
    FROM pathway_courses pc
    JOIN courses c ON c.id = pc.course_id
    WHERE pc.pathway_id = p_pathway_id
  ),
  choice_status AS (
    SELECT 
      cs.step_number,
      cs.choice_group,
      pcs.selected_course_id,
      jsonb_agg(jsonb_build_object(
        'course_id', cs.course_id,
        'course_title', cs.course_title
      )) as options
    FROM course_status cs
    LEFT JOIN pathway_choice_selections pcs ON pcs.student_id = v_student_id 
      AND pcs.pathway_id = p_pathway_id 
      AND pcs.choice_group = cs.choice_group
    WHERE cs.choice_group IS NOT NULL
    GROUP BY cs.step_number, cs.choice_group, pcs.selected_course_id
  )
  SELECT 
    cs.course_id,
    cs.course_title,
    cs.step_number,
    cs.choice_group,
    -- Available if: step <= current OR is completed OR is enrolled
    (cs.step_number <= v_current_step OR cs.is_completed OR cs.is_enrolled) as is_available,
    cs.is_completed,
    (cs.step_number = v_current_step) as is_current,
    -- Requires choice if: it's a choice group at current step and no selection made
    (cs.choice_group IS NOT NULL AND cs.step_number = v_current_step 
     AND NOT EXISTS (
       SELECT 1 FROM pathway_choice_selections pcs 
       WHERE pcs.student_id = v_student_id 
         AND pcs.pathway_id = p_pathway_id 
         AND pcs.choice_group = cs.choice_group
     )) as requires_choice,
    chs.options as choice_options
  FROM course_status cs
  LEFT JOIN choice_status chs ON chs.step_number = cs.step_number AND chs.choice_group = cs.choice_group
  -- Filter out non-selected choice courses (show only selected one, or all if not yet selected)
  WHERE cs.choice_group IS NULL 
    OR chs.selected_course_id IS NULL 
    OR cs.course_id = chs.selected_course_id
  ORDER BY cs.step_number, cs.course_id;
END;
$$;

-- Function to advance pathway (move to next course or make choice)
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
  v_current_step integer;
  v_next_step integer;
  v_next_course_id uuid;
  v_choice_group integer;
  v_current_course_id uuid;
  v_enrollment_id uuid;
BEGIN
  -- Get student_id
  SELECT id INTO v_student_id FROM students WHERE user_id = p_user_id;
  IF v_student_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Student not found');
  END IF;

  -- Get current pathway state
  SELECT gap.current_step_number, gap.current_course_id, gap.choice_group
  INTO v_current_step, v_current_course_id, v_choice_group
  FROM get_student_active_pathway(p_user_id) gap
  WHERE gap.pathway_id = p_pathway_id;

  IF v_current_step IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No active pathway found');
  END IF;

  -- Check if current course is completed
  IF NOT is_course_fully_completed(p_user_id, v_current_course_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Current course not fully completed');
  END IF;

  -- Calculate next step
  v_next_step := v_current_step + 1;

  -- Check if there's a next step
  SELECT pc.course_id, pc.choice_group 
  INTO v_next_course_id, v_choice_group
  FROM pathway_courses pc
  WHERE pc.pathway_id = p_pathway_id AND pc.step_number = v_next_step
  LIMIT 1;

  IF v_next_course_id IS NULL THEN
    -- Pathway completed!
    UPDATE course_enrollments 
    SET status = 'completed', completed_at = now()
    WHERE student_id = v_student_id AND pathway_id = p_pathway_id AND status = 'active';
    
    RETURN jsonb_build_object('success', true, 'message', 'Pathway completed!', 'completed', true);
  END IF;

  -- Handle choice point
  IF v_choice_group IS NOT NULL THEN
    IF p_selected_course_id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'error', 'Choice required', 'requires_choice', true, 'choice_group', v_choice_group);
    END IF;
    
    -- Validate selected course is part of this choice group
    IF NOT EXISTS (
      SELECT 1 FROM pathway_courses pc 
      WHERE pc.pathway_id = p_pathway_id 
        AND pc.step_number = v_next_step 
        AND pc.choice_group = v_choice_group 
        AND pc.course_id = p_selected_course_id
    ) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invalid course selection for this choice point');
    END IF;

    -- Record the choice
    INSERT INTO pathway_choice_selections (student_id, pathway_id, choice_group, selected_course_id)
    VALUES (v_student_id, p_pathway_id, v_choice_group, p_selected_course_id)
    ON CONFLICT (student_id, pathway_id, choice_group) DO UPDATE SET selected_course_id = p_selected_course_id;

    v_next_course_id := p_selected_course_id;
  END IF;

  -- Create enrollment for next course
  INSERT INTO course_enrollments (student_id, course_id, pathway_id, enrollment_source, status, enrolled_at)
  VALUES (v_student_id, v_next_course_id, p_pathway_id, 'pathway', 'active', now())
  ON CONFLICT (student_id, course_id) DO UPDATE SET status = 'active', pathway_id = p_pathway_id
  RETURNING id INTO v_enrollment_id;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Advanced to next course',
    'next_course_id', v_next_course_id,
    'next_step', v_next_step
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.is_course_fully_completed(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_active_pathway(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_student_pathway_course_map(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_pathway(uuid, uuid, uuid) TO authenticated;