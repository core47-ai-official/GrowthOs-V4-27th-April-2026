-- Migration: Fix admin_logs FK constraint for service role deletions
-- Date: 20250803

-- UP Migration
-- Step 1: Drop the existing foreign key constraint
ALTER TABLE public.admin_logs 
  DROP CONSTRAINT IF EXISTS admin_logs_performed_by_fkey;

-- Step 2: Make performed_by column nullable
ALTER TABLE public.admin_logs 
  ALTER COLUMN performed_by DROP NOT NULL;

-- Step 3: Add new foreign key constraint with ON DELETE SET NULL
ALTER TABLE public.admin_logs 
  ADD CONSTRAINT admin_logs_performed_by_fkey 
    FOREIGN KEY (performed_by) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;

-- Step 4: Update the audit trigger function to handle service role deletions
CREATE OR REPLACE FUNCTION public.log_user_deletions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Short-circuit if this is a service role deletion to prevent FK violations
  IF TG_OP = 'DELETE' AND 
     current_setting('request.jwt.claim.sub', true) = '00000000-0000-0000-0000-000000000000' THEN
    -- Log deletion with NULL performed_by for service role operations
    BEGIN
      INSERT INTO public.admin_logs (
        entity_type,
        entity_id,
        action,
        description,
        performed_by
      ) VALUES (
        'user',
        OLD.id,
        'auth_deleted',
        'User deleted from auth system by service role',
        NULL  -- NULL for service role operations
      );
    EXCEPTION WHEN OTHERS THEN
      -- Swallow any error to prevent blocking the deletion
      RAISE NOTICE 'admin_logs insert error: %', SQLERRM;
    END;
  ELSE
    -- Normal user deletion logging
    BEGIN
      INSERT INTO public.admin_logs (
        entity_type,
        entity_id,
        action,
        description,
        performed_by
      ) VALUES (
        'user',
        OLD.id,
        'auth_deleted',
        'User deleted from auth system, cleanup performed',
        OLD.id
      );
    EXCEPTION WHEN OTHERS THEN
      -- Swallow any error to prevent blocking the deletion
      RAISE NOTICE 'admin_logs insert error: %', SQLERRM;
    END;
  END IF;

  RETURN OLD;
END;
$function$;