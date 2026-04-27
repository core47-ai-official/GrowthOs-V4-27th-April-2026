-- Fix admin_logs FK constraint to allow NULL performed_by for service role deletions

-- Get current FK constraint name dynamically and drop it
DO $$
DECLARE
    fk_name text;
BEGIN
    SELECT conname INTO fk_name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'admin_logs' 
    AND c.contype = 'f'
    AND EXISTS (
        SELECT 1 FROM pg_attribute a 
        WHERE a.attrelid = t.oid 
        AND a.attname = 'performed_by'
        AND a.attnum = ANY(c.conkey)
    );
    
    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.admin_logs DROP CONSTRAINT %I', fk_name);
    END IF;
END $$;

-- Make performed_by nullable
ALTER TABLE public.admin_logs 
ALTER COLUMN performed_by DROP NOT NULL;

-- Re-create FK with ON DELETE SET NULL
ALTER TABLE public.admin_logs
ADD CONSTRAINT admin_logs_performed_by_fkey
FOREIGN KEY (performed_by) 
REFERENCES auth.users(id) 
ON DELETE SET NULL;

-- Update trigger function to handle service role deletions
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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
    'deleted',
    'User deleted from auth.users',
    OLD.id,
    now()
  );
  
  RETURN OLD;
END;
$$;