-- Fix security issues identified by the linter

-- 1. Fix missing RLS policies (issues already resolved for messages table)

-- 2. Fix function search path mutable issues
-- Update functions that don't have SET search_path = ''
CREATE OR REPLACE FUNCTION public.initialize_student_unlocks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  first_recording_id uuid;
BEGIN
  -- Get the first recording in sequence
  SELECT id INTO first_recording_id
  FROM public.available_lessons
  WHERE sequence_order IS NOT NULL
  ORDER BY sequence_order ASC
  LIMIT 1;
  
  -- If no recordings with sequence order, get the first one by title
  IF first_recording_id IS NULL THEN
    SELECT id INTO first_recording_id
    FROM public.available_lessons
    ORDER BY recording_title ASC
    LIMIT 1;
  END IF;
  
  -- Unlock the first recording for this student
  IF first_recording_id IS NOT NULL THEN
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, first_recording_id, true, now())
    ON CONFLICT (user_id, recording_id) 
    DO UPDATE SET is_unlocked = true, unlocked_at = now();
  END IF;
END;
$function$;

-- 3. Add missing function that was referenced in other functions
CREATE OR REPLACE FUNCTION public.is_assignment_passed(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT status = 'approved' FROM public.submissions 
     WHERE student_id = _user_id AND assignment_id = _assignment_id
     LIMIT 1),
    false
  );
$function$;

-- 4. Ensure all tables have proper RLS policies
-- Check and add any missing RLS policies for existing tables

-- For admin_logs table - ensure proper policies exist
DROP POLICY IF EXISTS "Admins can view admin logs" ON public.admin_logs;
CREATE POLICY "Admins can view admin logs" 
ON public.admin_logs 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

DROP POLICY IF EXISTS "System can insert admin logs" ON public.admin_logs;
CREATE POLICY "System can insert admin logs" 
ON public.admin_logs 
FOR INSERT 
WITH CHECK (true);

-- For segmented_weekly_success_sessions - enable RLS and add policies
ALTER TABLE public.segmented_weekly_success_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view segmented sessions" 
ON public.segmented_weekly_success_sessions 
FOR SELECT 
USING (true);