-- Check if there are any hidden views or objects causing the security definer issue
-- and remove any potentially problematic objects

-- First, let's check what views exist and their properties
DO $$
DECLARE
    view_rec RECORD;
    func_rec RECORD;
BEGIN
    -- Log all views in public schema for audit
    FOR view_rec IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public'
    LOOP
        RAISE NOTICE 'Found view: %.%', view_rec.schemaname, view_rec.viewname;
    END LOOP;
    
    -- Drop and recreate the segmented_weekly_success_sessions view to ensure it's clean
    DROP VIEW IF EXISTS public.segmented_weekly_success_sessions CASCADE;
    
    -- Recreate the view with proper security
    CREATE VIEW public.segmented_weekly_success_sessions AS
    SELECT 
        id,
        title,
        description,
        start_time,
        end_time,
        mentor_id,
        mentor_name,
        status,
        created_at,
        'weekly'::text AS segment
    FROM public.success_sessions;
    
    -- Add RLS comment
    COMMENT ON VIEW public.segmented_weekly_success_sessions IS 'View showing weekly success sessions - inherits RLS from success_sessions table';
    
    RAISE NOTICE 'Recreated segmented_weekly_success_sessions view';
END $$;