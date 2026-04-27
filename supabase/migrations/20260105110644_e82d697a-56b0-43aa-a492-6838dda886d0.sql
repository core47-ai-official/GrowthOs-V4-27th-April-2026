-- =====================================================
-- PHASE 1: MULTI-COURSE LMS DATABASE SCHEMA
-- =====================================================

-- 1.1 Create courses table
CREATE TABLE public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  thumbnail_url text,
  price numeric DEFAULT 0,
  currency text DEFAULT 'PKR',
  is_active boolean DEFAULT true,
  is_published boolean DEFAULT false,
  sequence_order integer DEFAULT 0,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

-- Courses RLS policies
CREATE POLICY "Anyone can view published courses"
  ON public.courses FOR SELECT
  USING (is_published = true AND is_active = true);

CREATE POLICY "Staff can view all courses"
  ON public.courses FOR SELECT
  USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Admins can manage courses"
  ON public.courses FOR ALL
  USING (get_current_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (get_current_user_role() IN ('admin', 'superadmin'));

-- 1.2 Create learning_pathways table
CREATE TABLE public.learning_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  thumbnail_url text,
  price numeric DEFAULT 0,
  currency text DEFAULT 'PKR',
  is_active boolean DEFAULT true,
  is_published boolean DEFAULT false,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.learning_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published pathways"
  ON public.learning_pathways FOR SELECT
  USING (is_published = true AND is_active = true);

CREATE POLICY "Staff can view all pathways"
  ON public.learning_pathways FOR SELECT
  USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Admins can manage pathways"
  ON public.learning_pathways FOR ALL
  USING (get_current_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (get_current_user_role() IN ('admin', 'superadmin'));

-- 1.3 Create pathway_courses table (course sequence within pathways)
CREATE TABLE public.pathway_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES public.learning_pathways(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  is_choice_point boolean DEFAULT false,
  choice_group integer,
  is_mandatory boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(pathway_id, course_id)
);

ALTER TABLE public.pathway_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pathway courses"
  ON public.pathway_courses FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage pathway courses"
  ON public.pathway_courses FOR ALL
  USING (get_current_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (get_current_user_role() IN ('admin', 'superadmin'));

-- 1.4 Create course_enrollments table
CREATE TABLE public.course_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  pathway_id uuid REFERENCES public.learning_pathways(id) ON DELETE SET NULL,
  enrolled_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),
  progress_percentage integer DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(student_id, course_id)
);

ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own enrollments"
  ON public.course_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = course_enrollments.student_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view all enrollments"
  ON public.course_enrollments FOR SELECT
  USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Staff can manage enrollments"
  ON public.course_enrollments FOR ALL
  USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'))
  WITH CHECK (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));

-- 1.5 Create mentor_course_assignments table
CREATE TABLE public.mentor_course_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  is_global boolean DEFAULT false,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(mentor_id, course_id)
);

ALTER TABLE public.mentor_course_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view mentor assignments"
  ON public.mentor_course_assignments FOR SELECT
  USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Admins can manage mentor assignments"
  ON public.mentor_course_assignments FOR ALL
  USING (get_current_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (get_current_user_role() IN ('admin', 'superadmin'));

-- 1.6 Create course_bundles table
CREATE TABLE public.course_bundles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  thumbnail_url text,
  price numeric NOT NULL,
  currency text DEFAULT 'PKR',
  discount_percentage numeric DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  is_active boolean DEFAULT true,
  is_published boolean DEFAULT false,
  created_by uuid REFERENCES public.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.course_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published bundles"
  ON public.course_bundles FOR SELECT
  USING (is_published = true AND is_active = true);

CREATE POLICY "Staff can view all bundles"
  ON public.course_bundles FOR SELECT
  USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Admins can manage bundles"
  ON public.course_bundles FOR ALL
  USING (get_current_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (get_current_user_role() IN ('admin', 'superadmin'));

-- 1.7 Create bundle_courses table
CREATE TABLE public.bundle_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id uuid NOT NULL REFERENCES public.course_bundles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(bundle_id, course_id)
);

ALTER TABLE public.bundle_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bundle courses"
  ON public.bundle_courses FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage bundle courses"
  ON public.bundle_courses FOR ALL
  USING (get_current_user_role() IN ('admin', 'superadmin'))
  WITH CHECK (get_current_user_role() IN ('admin', 'superadmin'));

-- 1.8 Add course_id to existing tables
ALTER TABLE public.modules ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE public.success_sessions ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;
ALTER TABLE public.assignments ADD COLUMN course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX idx_modules_course ON public.modules(course_id);
CREATE INDEX idx_success_sessions_course ON public.success_sessions(course_id);
CREATE INDEX idx_assignments_course ON public.assignments(course_id);
CREATE INDEX idx_course_enrollments_student ON public.course_enrollments(student_id);
CREATE INDEX idx_course_enrollments_course ON public.course_enrollments(course_id);
CREATE INDEX idx_pathway_courses_pathway ON public.pathway_courses(pathway_id);
CREATE INDEX idx_mentor_course_assignments_mentor ON public.mentor_course_assignments(mentor_id);
CREATE INDEX idx_mentor_course_assignments_course ON public.mentor_course_assignments(course_id);

-- 1.9 Add multi_course_enabled feature flag
ALTER TABLE public.company_settings ADD COLUMN multi_course_enabled boolean DEFAULT false;

-- 1.10 Create triggers for updated_at
CREATE TRIGGER update_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_learning_pathways_updated_at
  BEFORE UPDATE ON public.learning_pathways
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_enrollments_updated_at
  BEFORE UPDATE ON public.course_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_course_bundles_updated_at
  BEFORE UPDATE ON public.course_bundles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();