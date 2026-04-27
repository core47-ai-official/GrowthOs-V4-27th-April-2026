-- Fix critical security vulnerabilities and add missing database components

-- 1. Fix company_settings RLS policies (currently publicly readable with sensitive data)
DROP POLICY IF EXISTS "Authenticated users can read basic company info" ON public.company_settings;

-- Create more restrictive policy for company_settings
CREATE POLICY "Staff can view company settings" 
ON public.company_settings 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'enrollment_manager'::text, 'mentor'::text, 'superadmin'::text]));

-- 2. Fix success_sessions RLS policies (currently no authentication required)
DROP POLICY IF EXISTS "Everyone can view success sessions" ON public.success_sessions;

-- Create proper authentication for success_sessions
CREATE POLICY "Authenticated users can view success sessions" 
ON public.success_sessions 
FOR SELECT 
USING (auth.role() = 'authenticated');

CREATE POLICY "Staff can manage success sessions" 
ON public.success_sessions 
FOR ALL 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text]))
WITH CHECK (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text]));

-- 3. Create missing onboarding_responses table
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  answer TEXT,
  answer_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for onboarding_responses
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for onboarding_responses
CREATE POLICY "Users can manage their own onboarding responses" 
ON public.onboarding_responses 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all onboarding responses" 
ON public.onboarding_responses 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]));

-- 4. Create missing user_module_progress table
CREATE TABLE IF NOT EXISTS public.user_module_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  progress_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS for user_module_progress
ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for user_module_progress
CREATE POLICY "Users can view their own module progress" 
ON public.user_module_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own module progress" 
ON public.user_module_progress 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all module progress" 
ON public.user_module_progress 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]));

-- Create triggers for updated_at columns
CREATE TRIGGER update_onboarding_responses_updated_at
BEFORE UPDATE ON public.onboarding_responses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_module_progress_updated_at
BEFORE UPDATE ON public.user_module_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Add missing get_current_user_role function if it doesn't exist
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;