-- =====================================================
-- PHASE 3: COURSE-AWARE UNLOCK & HELPER FUNCTIONS
-- (Fixed - module column is already uuid)
-- =====================================================

-- 3.1 Create course-aware unlock status function
CREATE OR REPLACE FUNCTION public.get_user_unlock_status_v2(
  p_user_id uuid,
  p_course_id uuid DEFAULT NULL
)
RETURNS TABLE (
  recording_id uuid,
  recording_title text,
  module_id uuid,
  module_title text,
  sequence_order integer,
  is_unlocked boolean,
  unlock_reason text,
  assignment_id uuid,
  assignment_completed boolean,
  watched boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_is_multi_course boolean;
BEGIN
  v_is_multi_course := public.is_multi_course_enabled();
  
  IF p_course_id IS NULL THEN
    IF v_is_multi_course THEN
      RETURN;
    ELSE
      v_course_id := public.get_default_course_id();
    END IF;
  ELSE
    v_course_id := p_course_id;
  END IF;
  
  RETURN QUERY
  SELECT 
    al.id as recording_id,
    al.recording_title,
    m.id as module_id,
    m.title as module_title,
    COALESCE(al.sequence_order, 0) as sequence_order,
    COALESCE(rv.watched, false) OR al.sequence_order = 1 as is_unlocked,
    CASE 
      WHEN al.sequence_order = 1 THEN 'First recording'
      WHEN COALESCE(rv.watched, false) THEN 'Already watched'
      ELSE 'Locked'
    END as unlock_reason,
    al.assignment_id,
    EXISTS (
      SELECT 1 FROM public.submissions sub 
      WHERE sub.assignment_id = al.assignment_id 
      AND sub.student_id = p_user_id 
      AND sub.status = 'approved'
    ) as assignment_completed,
    COALESCE(rv.watched, false) as watched
  FROM public.available_lessons al
  LEFT JOIN public.modules m ON m.id = al.module
  LEFT JOIN public.recording_views rv ON rv.recording_id = al.id AND rv.user_id = p_user_id
  WHERE (v_course_id IS NULL OR m.course_id = v_course_id)
  ORDER BY m.order NULLS LAST, al.sequence_order NULLS LAST;
END;
$$;

-- 3.2 Create function to get course modules with recordings count
CREATE OR REPLACE FUNCTION public.get_course_modules(p_course_id uuid)
RETURNS TABLE (
  module_id uuid,
  module_title text,
  module_description text,
  module_order integer,
  recording_count bigint,
  assignment_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id as module_id,
    m.title as module_title,
    m.description as module_description,
    m.order as module_order,
    COUNT(DISTINCT al.id) as recording_count,
    COUNT(DISTINCT al.assignment_id) as assignment_count
  FROM public.modules m
  LEFT JOIN public.available_lessons al ON al.module = m.id
  WHERE m.course_id = p_course_id
  GROUP BY m.id, m.title, m.description, m.order
  ORDER BY m.order NULLS LAST;
END;
$$;

-- 3.3 Create function to check student's course access
CREATE OR REPLACE FUNCTION public.has_course_access(
  p_user_id uuid,
  p_course_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.course_enrollments ce
    JOIN public.students s ON s.id = ce.student_id
    WHERE s.user_id = p_user_id
    AND ce.course_id = p_course_id
    AND ce.status IN ('active', 'completed')
  )
  OR EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = p_user_id
    AND u.role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
  );
END;
$$;

-- 3.4 Create function to get catalog courses (for enrollment page)
CREATE OR REPLACE FUNCTION public.get_catalog_courses(p_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  course_id uuid,
  title text,
  description text,
  thumbnail_url text,
  price numeric,
  currency text,
  module_count bigint,
  recording_count bigint,
  is_enrolled boolean,
  enrollment_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as course_id,
    c.title,
    c.description,
    c.thumbnail_url,
    c.price,
    c.currency,
    COUNT(DISTINCT m.id) as module_count,
    COUNT(DISTINCT al.id) as recording_count,
    CASE WHEN ce.id IS NOT NULL THEN true ELSE false END as is_enrolled,
    ce.status as enrollment_status
  FROM public.courses c
  LEFT JOIN public.modules m ON m.course_id = c.id
  LEFT JOIN public.available_lessons al ON al.module = m.id
  LEFT JOIN public.students s ON s.user_id = p_user_id
  LEFT JOIN public.course_enrollments ce ON ce.course_id = c.id AND ce.student_id = s.id
  WHERE c.is_active = true AND c.is_published = true
  GROUP BY c.id, c.title, c.description, c.thumbnail_url, c.price, c.currency, ce.id, ce.status
  ORDER BY c.sequence_order, c.title;
END;
$$;

-- 3.5 Create function to get mentor's assigned courses
CREATE OR REPLACE FUNCTION public.get_mentor_courses(p_mentor_id uuid)
RETURNS TABLE (
  course_id uuid,
  course_title text,
  is_global boolean,
  is_primary boolean,
  student_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as course_id,
    c.title as course_title,
    COALESCE(mca.is_global, false) as is_global,
    COALESCE(mca.is_primary, false) as is_primary,
    COUNT(DISTINCT ce.student_id) as student_count
  FROM public.courses c
  LEFT JOIN public.mentor_course_assignments mca ON mca.course_id = c.id AND mca.mentor_id = p_mentor_id
  LEFT JOIN public.course_enrollments ce ON ce.course_id = c.id AND ce.status = 'active'
  WHERE c.is_active = true
  AND (mca.id IS NOT NULL OR mca.is_global = true)
  GROUP BY c.id, c.title, mca.is_global, mca.is_primary
  ORDER BY c.title;
END;
$$;

-- 3.6 Fix update_course_progress function
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
  
  SELECT COUNT(*) INTO v_total_recordings
  FROM public.available_lessons al
  JOIN public.modules m ON m.id = al.module
  WHERE m.course_id = p_course_id;
  
  SELECT COUNT(*) INTO v_watched_recordings
  FROM public.recording_views rv
  JOIN public.available_lessons al ON al.id = rv.recording_id
  JOIN public.modules m ON m.id = al.module
  WHERE rv.user_id = v_user_id
  AND rv.watched = true
  AND m.course_id = p_course_id;
  
  IF v_total_recordings > 0 THEN
    v_progress := ROUND((v_watched_recordings::numeric / v_total_recordings::numeric) * 100);
  ELSE
    v_progress := 0;
  END IF;
  
  UPDATE public.course_enrollments
  SET progress_percentage = v_progress,
      completed_at = CASE WHEN v_progress = 100 THEN now() ELSE NULL END,
      status = CASE WHEN v_progress = 100 THEN 'completed' ELSE 'active' END,
      updated_at = now()
  WHERE student_id = p_student_id AND course_id = p_course_id;
END;
$$;

-- 3.7 Create trigger to update course progress when recording is watched
CREATE OR REPLACE FUNCTION public.update_course_progress_on_watch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_student_id uuid;
BEGIN
  IF NEW.watched = true AND (OLD.watched IS NULL OR OLD.watched = false) THEN
    SELECT m.course_id INTO v_course_id
    FROM public.available_lessons al
    JOIN public.modules m ON m.id = al.module
    WHERE al.id = NEW.recording_id;
    
    SELECT id INTO v_student_id
    FROM public.students
    WHERE user_id = NEW.user_id;
    
    IF v_course_id IS NOT NULL AND v_student_id IS NOT NULL THEN
      PERFORM public.update_course_progress(v_student_id, v_course_id);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_course_progress_on_watch ON public.recording_views;

CREATE TRIGGER trigger_update_course_progress_on_watch
  AFTER INSERT OR UPDATE ON public.recording_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_course_progress_on_watch();