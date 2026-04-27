-- =====================================================
-- PHASE 2: MIGRATION - CREATE DEFAULT COURSE & ENROLL STUDENTS
-- (Fixed version - handles trigger issues)
-- =====================================================

-- 2.1 Create the default "Main Course" for existing content
DO $$
DECLARE
  v_default_course_id uuid;
BEGIN
  -- Insert the default course
  INSERT INTO public.courses (title, description, is_active, is_published, sequence_order)
  VALUES ('Main Course', 'Original course content - all existing modules and lessons', true, true, 1)
  RETURNING id INTO v_default_course_id;
  
  -- Link all existing modules to this course
  UPDATE public.modules 
  SET course_id = v_default_course_id 
  WHERE course_id IS NULL;
  
  -- Link all existing assignments to this course
  UPDATE public.assignments 
  SET course_id = v_default_course_id 
  WHERE course_id IS NULL;
  
  -- Auto-enroll all existing students into the default course
  INSERT INTO public.course_enrollments (student_id, course_id, status, enrolled_at)
  SELECT s.id, v_default_course_id, 'active', COALESCE(s.enrollment_date, now())
  FROM public.students s
  ON CONFLICT (student_id, course_id) DO NOTHING;
  
  RAISE NOTICE 'Created default course with ID: %', v_default_course_id;
END $$;

-- 2.1b Update success_sessions separately (direct update bypassing trigger)
UPDATE public.success_sessions 
SET course_id = (SELECT id FROM public.courses WHERE title = 'Main Course' LIMIT 1)
WHERE course_id IS NULL
AND mentor_id IN (SELECT id FROM public.users);

-- 2.2 Create function to get default course ID
CREATE OR REPLACE FUNCTION public.get_default_course_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.courses 
  WHERE title = 'Main Course' 
  AND is_active = true 
  ORDER BY created_at ASC 
  LIMIT 1;
$$;

-- 2.3 Create function to check if multi-course is enabled
CREATE OR REPLACE FUNCTION public.is_multi_course_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(multi_course_enabled, false) 
  FROM public.company_settings 
  LIMIT 1;
$$;

-- 2.4 Create function to get student's enrolled courses
CREATE OR REPLACE FUNCTION public.get_student_courses(p_user_id uuid)
RETURNS TABLE (
  course_id uuid,
  course_title text,
  course_description text,
  thumbnail_url text,
  progress_percentage integer,
  enrollment_status text,
  enrolled_at timestamptz,
  completed_at timestamptz,
  is_pathway boolean,
  pathway_id uuid,
  pathway_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id as course_id,
    c.title as course_title,
    c.description as course_description,
    c.thumbnail_url,
    ce.progress_percentage,
    ce.status as enrollment_status,
    ce.enrolled_at,
    ce.completed_at,
    ce.pathway_id IS NOT NULL as is_pathway,
    ce.pathway_id,
    lp.name as pathway_name
  FROM public.course_enrollments ce
  JOIN public.courses c ON c.id = ce.course_id
  JOIN public.students s ON s.id = ce.student_id
  LEFT JOIN public.learning_pathways lp ON lp.id = ce.pathway_id
  WHERE s.user_id = p_user_id
  AND ce.status IN ('active', 'completed')
  ORDER BY ce.enrolled_at DESC;
$$;

-- 2.5 Create function to get pathway next course options
CREATE OR REPLACE FUNCTION public.get_pathway_next_options(
  p_user_id uuid,
  p_pathway_id uuid,
  p_current_step integer
)
RETURNS TABLE (
  course_id uuid,
  course_title text,
  course_description text,
  step_number integer,
  is_choice_point boolean,
  choice_group integer,
  is_mandatory boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id as course_id,
    c.title as course_title,
    c.description as course_description,
    pc.step_number,
    pc.is_choice_point,
    pc.choice_group,
    pc.is_mandatory
  FROM public.pathway_courses pc
  JOIN public.courses c ON c.id = pc.course_id
  WHERE pc.pathway_id = p_pathway_id
  AND pc.step_number = p_current_step + 1
  AND c.is_active = true
  ORDER BY pc.choice_group NULLS LAST, c.title;
$$;

-- 2.6 Create function to enroll student in a course
CREATE OR REPLACE FUNCTION public.enroll_student_in_course(
  p_student_id uuid,
  p_course_id uuid,
  p_pathway_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_enrollment_id uuid;
BEGIN
  -- Check if course exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE id = p_course_id AND is_active = true) THEN
    RETURN json_build_object('success', false, 'error', 'Course not found or inactive');
  END IF;
  
  -- Check if already enrolled
  IF EXISTS (SELECT 1 FROM public.course_enrollments WHERE student_id = p_student_id AND course_id = p_course_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already enrolled in this course');
  END IF;
  
  -- Create enrollment
  INSERT INTO public.course_enrollments (student_id, course_id, pathway_id, status)
  VALUES (p_student_id, p_course_id, p_pathway_id, 'active')
  RETURNING id INTO v_enrollment_id;
  
  RETURN json_build_object(
    'success', true, 
    'enrollment_id', v_enrollment_id,
    'course_id', p_course_id
  );
END;
$$;

-- 2.7 Create function to update course progress
CREATE OR REPLACE FUNCTION public.update_course_progress(
  p_student_id uuid,
  p_course_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_recordings integer;
  v_watched_recordings integer;
  v_progress integer;
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.students WHERE id = p_student_id;
  
  -- Count total recordings in course
  SELECT COUNT(*) INTO v_total_recordings
  FROM public.available_lessons al
  JOIN public.modules m ON m.id::text = al.module
  WHERE m.course_id = p_course_id;
  
  -- Count watched recordings
  SELECT COUNT(*) INTO v_watched_recordings
  FROM public.recording_views rv
  JOIN public.available_lessons al ON al.id = rv.recording_id
  JOIN public.modules m ON m.id::text = al.module
  WHERE rv.user_id = v_user_id
  AND rv.watched = true
  AND m.course_id = p_course_id;
  
  -- Calculate progress percentage
  IF v_total_recordings > 0 THEN
    v_progress := ROUND((v_watched_recordings::numeric / v_total_recordings::numeric) * 100);
  ELSE
    v_progress := 0;
  END IF;
  
  -- Update enrollment progress
  UPDATE public.course_enrollments
  SET progress_percentage = v_progress,
      completed_at = CASE WHEN v_progress = 100 THEN now() ELSE NULL END,
      status = CASE WHEN v_progress = 100 THEN 'completed' ELSE 'active' END,
      updated_at = now()
  WHERE student_id = p_student_id AND course_id = p_course_id;
END;
$$;

-- 2.8 Create trigger to auto-enroll new students in default course
CREATE OR REPLACE FUNCTION public.auto_enroll_student_default_course()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_default_course_id uuid;
BEGIN
  -- Only auto-enroll if multi-course is not enabled (backward compatible mode)
  IF NOT public.is_multi_course_enabled() THEN
    v_default_course_id := public.get_default_course_id();
    
    IF v_default_course_id IS NOT NULL THEN
      INSERT INTO public.course_enrollments (student_id, course_id, status)
      VALUES (NEW.id, v_default_course_id, 'active')
      ON CONFLICT (student_id, course_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop trigger if exists first
DROP TRIGGER IF EXISTS trigger_auto_enroll_student ON public.students;

CREATE TRIGGER trigger_auto_enroll_student
  AFTER INSERT ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_student_default_course();