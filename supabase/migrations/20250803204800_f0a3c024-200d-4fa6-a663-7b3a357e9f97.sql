-- Fix remaining critical security issues

-- 1. Enable RLS on tables with policies but RLS disabled
-- Check what table has this issue and enable RLS
ALTER TABLE public.segmented_weekly_success_sessions ENABLE ROW LEVEL SECURITY;

-- 2. Fix any remaining RLS issues by enabling RLS on public tables
-- Enable RLS on all public tables that don't have it
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT schemaname||'.'||tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT IN (
            SELECT tablename 
            FROM pg_tables pt
            JOIN pg_class pc ON pc.relname = pt.tablename
            WHERE pc.relrowsecurity = true
            AND pt.schemaname = 'public'
        )
    LOOP
        EXECUTE 'ALTER TABLE ' || t || ' ENABLE ROW LEVEL SECURITY';
    END LOOP;
END $$;

-- 3. Add basic policies for tables that have RLS enabled but no policies
-- This covers the "RLS Enabled No Policy" issue
CREATE POLICY "Admin access" ON public.segmented_weekly_success_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
    )
  );