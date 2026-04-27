-- Fix user deletion by updating the auth trigger to use compatible entity_type and add error handling

-- Update the handle_auth_user_deleted function to use 'user' entity_type and add error handling
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
  
  -- Log deletion for real users with error handling to prevent blocking deletions
  BEGIN
    INSERT INTO public.admin_logs (
      entity_type,
      entity_id,
      action,
      description,
      performed_by,
      created_at
    ) VALUES (
      'user',  -- Changed from 'auth_user' to 'user' to match check constraint
      OLD.id,
      'deleted',  -- Changed from 'auth_deleted' to 'deleted' for consistency
      'User deleted from auth.users',
      OLD.id,
      now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't block the deletion
      RAISE NOTICE 'Failed to log user deletion for user %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$$;