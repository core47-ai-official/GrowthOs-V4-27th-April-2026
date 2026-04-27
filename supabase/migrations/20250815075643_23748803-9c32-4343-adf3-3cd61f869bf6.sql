-- Phase 1: Critical Security Fixes - Part 2
-- Only update policies that need changes and don't exist yet

-- 1. Remove public access from company_settings (keep existing policy name if it exists)
DO $$
BEGIN
    -- Drop the overly permissive policy if it exists
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users can read basic company info' AND tablename = 'company_settings') THEN
        DROP POLICY "Authenticated users can read basic company info" ON public.company_settings;
    END IF;
    
    -- Only create the new policy if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Staff can view company settings' AND tablename = 'company_settings') THEN
        CREATE POLICY "Staff can view company settings" ON public.company_settings
        FOR SELECT TO authenticated
        USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'enrollment_manager'::text, 'mentor'::text, 'superadmin'::text]));
    END IF;
END $$;

-- 2. Secure success_sessions table  
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone can view success sessions' AND tablename = 'success_sessions') THEN
        DROP POLICY "Everyone can view success sessions" ON public.success_sessions;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enrolled users can view success sessions' AND tablename = 'success_sessions') THEN
        CREATE POLICY "Enrolled users can view success sessions" ON public.success_sessions
        FOR SELECT TO authenticated
        USING (
          get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
          OR 
          get_current_user_role() = 'student'::text
        );
    END IF;
END $$;

-- 3. Secure assignments table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone can view assignments' AND tablename = 'assignments') THEN
        DROP POLICY "Everyone can view assignments" ON public.assignments;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enrolled users can view assignments' AND tablename = 'assignments') THEN
        CREATE POLICY "Enrolled users can view assignments" ON public.assignments
        FOR SELECT TO authenticated
        USING (
          get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
          OR 
          get_current_user_role() = 'student'::text
        );
    END IF;
END $$;

-- 4. Secure available_lessons table
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Everyone can view session recordings' AND tablename = 'available_lessons') THEN
        DROP POLICY "Everyone can view session recordings" ON public.available_lessons;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enrolled users can view recordings' AND tablename = 'available_lessons') THEN
        CREATE POLICY "Enrolled users can view recordings" ON public.available_lessons
        FOR SELECT TO authenticated
        USING (
          get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text]) 
          OR 
          get_current_user_role() = 'student'::text
        );
    END IF;
END $$;