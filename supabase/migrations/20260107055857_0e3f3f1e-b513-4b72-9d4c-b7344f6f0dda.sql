-- Add access duration to courses (in days, null = unlimited)
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS access_duration_days INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.courses.access_duration_days IS 'Number of days student has access after enrollment. NULL = unlimited access.';

-- Add access duration to learning_pathways (in days, null = unlimited)
ALTER TABLE public.learning_pathways 
ADD COLUMN IF NOT EXISTS access_duration_days INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.learning_pathways.access_duration_days IS 'Number of days student has access after enrollment. NULL = unlimited access.';

-- Add access expiry date to course_enrollments
ALTER TABLE public.course_enrollments 
ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

COMMENT ON COLUMN public.course_enrollments.access_expires_at IS 'When student access expires. NULL = no expiry. Calculated from enrolled_at + access_duration_days.';

-- Create index for efficient expiry queries
CREATE INDEX IF NOT EXISTS idx_course_enrollments_access_expires 
ON public.course_enrollments(access_expires_at) 
WHERE access_expires_at IS NOT NULL;