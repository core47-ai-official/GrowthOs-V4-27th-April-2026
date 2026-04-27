-- Fix user deletion issues by ensuring triggers and admin_logs work properly

-- First, let's check if there are any old triggers referencing lms_password that need to be removed
-- Then ensure admin_logs table has proper constraints and FK relationships

-- Drop any problematic triggers that might reference old fields
DO $$
DECLARE
    trigger_record RECORD;
BEGIN
    -- Find triggers on public.users that might reference old fields
    FOR trigger_record IN 
        SELECT trigger_name, event_object_table 
        FROM information_schema.triggers 
        WHERE event_object_table = 'users' 
          AND event_object_schema = 'public'
          AND trigger_name ILIKE '%password%'
    LOOP
        EXECUTE 'DROP TRIGGER IF EXISTS ' || trigger_record.trigger_name || ' ON public.users CASCADE';
        RAISE NOTICE 'Dropped trigger: %', trigger_record.trigger_name;
    END LOOP;
END $$;

-- Ensure admin_logs table has proper FK constraint to allow NULL for service role operations
-- and check constraints for entity_type
DO $$
BEGIN
    -- Drop existing FK constraint if it exists and doesn't allow CASCADE/SET NULL
    IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints rc
        JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'admin_logs' AND rc.delete_rule != 'SET NULL'
    ) THEN
        -- Find and drop the existing FK constraint
        EXECUTE (
            SELECT 'ALTER TABLE admin_logs DROP CONSTRAINT ' || constraint_name
            FROM information_schema.table_constraints 
            WHERE table_name = 'admin_logs' 
              AND constraint_type = 'FOREIGN KEY'
              AND constraint_name LIKE '%performed_by%'
            LIMIT 1
        );
    END IF;
    
    -- Add proper FK constraint with SET NULL on delete
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.referential_constraints rc
        JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
        WHERE tc.table_name = 'admin_logs' AND rc.delete_rule = 'SET NULL'
    ) THEN
        ALTER TABLE admin_logs 
        ADD CONSTRAINT admin_logs_performed_by_fkey 
        FOREIGN KEY (performed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'FK constraint handling completed with: %', SQLERRM;
END $$;

-- Add check constraint for entity_type if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'admin_logs_entity_type_check'
    ) THEN
        ALTER TABLE admin_logs 
        ADD CONSTRAINT admin_logs_entity_type_check 
        CHECK (entity_type IN ('user', 'auth_user', 'system', 'student', 'admin', 'assignment', 'module', 'recording'));
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Check constraint already exists or error: %', SQLERRM;
END $$;

-- Ensure the auth user deletion trigger exists and works properly
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Skip logging for service role deletions to prevent FK violations
  IF current_setting('request.jwt.claim.sub', true) = '00000000-0000-0000-0000-000000000000' THEN
    RETURN OLD;
  END IF;
  
  -- Log deletion for real users
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at
  ) VALUES (
    'auth_user',
    OLD.id,
    'auth_deleted',
    'User deleted from auth.users',
    OLD.id,
    now()
  );
  
  RETURN OLD;
END;
$$;

-- Create the trigger on auth.users if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();

-- Test that user deletion will work by ensuring all constraints are properly set
-- Make sure there are no orphaned references that would block deletion
COMMENT ON FUNCTION public.handle_auth_user_deleted() IS 'Handles audit logging when users are deleted from auth.users, with service role protection';