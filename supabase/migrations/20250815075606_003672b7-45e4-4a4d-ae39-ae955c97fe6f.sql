-- Phase 1: Critical Security Fixes
-- Fix RLS policies for publicly accessible tables

-- 1. Secure company_settings table
DROP POLICY IF EXISTS "Authenticated users can read basic company info" ON public.company_settings;
CREATE POLICY "Staff can view company settings" ON public.company_settings
FOR SELECT TO authenticated
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'enrollment_manager'::text, 'mentor'::text, 'superadmin'::text]));

-- 2. Secure success_sessions table  
DROP POLICY IF EXISTS "Everyone can view success sessions" ON public.success_sessions;
CREATE POLICY "Enrolled users can view success sessions" ON public.success_sessions
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 3. Secure assignments table
DROP POLICY IF EXISTS "Everyone can view assignments" ON public.assignments;
CREATE POLICY "Enrolled users can view assignments" ON public.assignments
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 4. Secure available_lessons table
DROP POLICY IF EXISTS "Everyone can view session recordings" ON public.available_lessons;
CREATE POLICY "Enrolled users can view recordings" ON public.available_lessons
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 5. Secure modules table
DROP POLICY IF EXISTS "Everyone can view modules" ON public.modules;
CREATE POLICY "Enrolled users can view modules" ON public.modules
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 6. Secure quiz_questions table
DROP POLICY IF EXISTS "Everyone can view quiz questions" ON public.quiz_questions;
CREATE POLICY "Enrolled users can view quiz questions" ON public.quiz_questions
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 7. Secure badges table
DROP POLICY IF EXISTS "Everyone can view badges" ON public.badges;
CREATE POLICY "Enrolled users can view badges" ON public.badges
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 8. Secure batches table
DROP POLICY IF EXISTS "Everyone can view batches" ON public.batches;
CREATE POLICY "Enrolled users can view batches" ON public.batches
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 9. Secure course_tracks table
DROP POLICY IF EXISTS "Everyone can view course tracks" ON public.course_tracks;
CREATE POLICY "Enrolled users can view course tracks" ON public.course_tracks
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 10. Secure pods table
DROP POLICY IF EXISTS "Everyone can view pods" ON public.pods;
CREATE POLICY "Enrolled users can view pods" ON public.pods
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 11. Secure user_badges table
DROP POLICY IF EXISTS "Everyone can view user badges" ON public.user_badges;
CREATE POLICY "Enrolled users can view user badges" ON public.user_badges
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- 12. Secure recording_attachments table
DROP POLICY IF EXISTS "Everyone can view recording attachments" ON public.recording_attachments;
CREATE POLICY "Enrolled users can view recording attachments" ON public.recording_attachments
FOR SELECT TO authenticated
USING (
  get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
  OR 
  get_current_user_role() = 'student'::text
);

-- Add missing phone field to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;

-- Create missing onboarding_responses table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer TEXT,
  answer_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on onboarding_responses
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for onboarding_responses
CREATE POLICY "Users can manage their own onboarding responses" ON public.onboarding_responses
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all onboarding responses" ON public.onboarding_responses
FOR SELECT TO authenticated
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]));

-- Create missing user_module_progress table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_module_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL,
  progress_percentage INTEGER DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on user_module_progress
ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for user_module_progress
CREATE POLICY "Users can manage their own module progress" ON public.user_module_progress
FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all module progress" ON public.user_module_progress
FOR SELECT TO authenticated
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]));

-- Add updated_at trigger for onboarding_responses
CREATE TRIGGER update_onboarding_responses_updated_at
BEFORE UPDATE ON public.onboarding_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add updated_at trigger for user_module_progress
CREATE TRIGGER update_user_module_progress_updated_at
BEFORE UPDATE ON public.user_module_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fix database security - ensure all functions have proper search_path
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT 
LANGUAGE SQL 
SECURITY DEFINER 
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;