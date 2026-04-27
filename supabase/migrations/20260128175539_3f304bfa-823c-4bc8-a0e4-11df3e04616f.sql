-- Create junction table for batch-pathway relationships
CREATE TABLE IF NOT EXISTS public.batch_pathways (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  pathway_id UUID NOT NULL REFERENCES public.learning_pathways(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(batch_id, pathway_id)
);

-- Create junction table for batch-course relationships
CREATE TABLE IF NOT EXISTS public.batch_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(batch_id, course_id)
);

-- Enable RLS on both tables
ALTER TABLE public.batch_pathways ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_courses ENABLE ROW LEVEL SECURITY;

-- RLS policies for batch_pathways
CREATE POLICY "Staff can view batch pathways"
  ON public.batch_pathways FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
  ));

CREATE POLICY "Admin can insert batch pathways"
  ON public.batch_pathways FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  ));

CREATE POLICY "Admin can delete batch pathways"
  ON public.batch_pathways FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  ));

-- RLS policies for batch_courses
CREATE POLICY "Staff can view batch courses"
  ON public.batch_courses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
  ));

CREATE POLICY "Admin can insert batch courses"
  ON public.batch_courses FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  ));

CREATE POLICY "Admin can delete batch courses"
  ON public.batch_courses FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'superadmin')
  ));

-- Students can view batch pathways/courses they're enrolled in
CREATE POLICY "Students can view enrolled batch pathways"
  ON public.batch_pathways FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM course_enrollments ce
    JOIN students s ON s.id = ce.student_id
    WHERE ce.batch_id = batch_pathways.batch_id
    AND s.user_id = auth.uid()
  ));

CREATE POLICY "Students can view enrolled batch courses"
  ON public.batch_courses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM course_enrollments ce
    JOIN students s ON s.id = ce.student_id
    WHERE ce.batch_id = batch_courses.batch_id
    AND s.user_id = auth.uid()
  ));