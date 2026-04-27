-- Create a function to handle cascading user deletions
CREATE OR REPLACE FUNCTION public.handle_user_cascade_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  student_record_id uuid;
BEGIN
  -- Skip logging for service role deletions to prevent FK violations
  IF current_setting('request.jwt.claim.sub', true) = '00000000-0000-0000-0000-000000000000' THEN
    -- Get student record ID if exists (for invoice cleanup)
    SELECT id INTO student_record_id 
    FROM public.students 
    WHERE user_id = OLD.id;
    
    -- Delete user-related records in proper order (respecting foreign keys)
    
    -- 1. Delete invoices (references students.id)
    IF student_record_id IS NOT NULL THEN
      DELETE FROM public.invoices WHERE student_id = student_record_id;
    END IF;
    
    -- 2. Delete submissions (references users directly via student_id)
    DELETE FROM public.submissions WHERE student_id = OLD.id;
    
    -- 3. Delete student record
    DELETE FROM public.students WHERE user_id = OLD.id;
    
    -- 4. Delete user activity logs
    DELETE FROM public.user_activity_logs WHERE user_id = OLD.id;
    
    -- 5. Delete user badges
    DELETE FROM public.user_badges WHERE user_id = OLD.id;
    
    -- 6. Delete user unlocks
    DELETE FROM public.user_unlocks WHERE user_id = OLD.id;
    
    -- 7. Delete recording views
    DELETE FROM public.recording_views WHERE user_id = OLD.id;
    
    -- 8. Delete notifications
    DELETE FROM public.notifications WHERE user_id = OLD.id;
    
    -- 9. Delete support ticket replies
    DELETE FROM public.support_ticket_replies WHERE user_id = OLD.id;
    
    -- 10. Delete support tickets
    DELETE FROM public.support_tickets WHERE user_id = OLD.id;
    
    -- 11. Delete email queue entries
    DELETE FROM public.email_queue WHERE user_id = OLD.id;
    
    -- 12. Delete admin logs where this user was the performer
    DELETE FROM public.admin_logs WHERE performed_by = OLD.id;
    
    -- 13. Delete the user profile from public.users
    DELETE FROM public.users WHERE id = OLD.id;
    
    RETURN OLD;
  END IF;
  
  -- For normal user deletions (not service role), log and then cascade
  BEGIN
    -- Get student record ID if exists (for invoice cleanup)
    SELECT id INTO student_record_id 
    FROM public.students 
    WHERE user_id = OLD.id;
    
    -- Delete user-related records in proper order
    
    -- 1. Delete invoices (references students.id)
    IF student_record_id IS NOT NULL THEN
      DELETE FROM public.invoices WHERE student_id = student_record_id;
    END IF;
    
    -- 2. Delete submissions (references users directly via student_id)
    DELETE FROM public.submissions WHERE student_id = OLD.id;
    
    -- 3. Delete student record
    DELETE FROM public.students WHERE user_id = OLD.id;
    
    -- 4. Delete user activity logs
    DELETE FROM public.user_activity_logs WHERE user_id = OLD.id;
    
    -- 5. Delete user badges
    DELETE FROM public.user_badges WHERE user_id = OLD.id;
    
    -- 6. Delete user unlocks
    DELETE FROM public.user_unlocks WHERE user_id = OLD.id;
    
    -- 7. Delete recording views
    DELETE FROM public.recording_views WHERE user_id = OLD.id;
    
    -- 8. Delete notifications
    DELETE FROM public.notifications WHERE user_id = OLD.id;
    
    -- 9. Delete support ticket replies
    DELETE FROM public.support_ticket_replies WHERE user_id = OLD.id;
    
    -- 10. Delete support tickets
    DELETE FROM public.support_tickets WHERE user_id = OLD.id;
    
    -- 11. Delete email queue entries
    DELETE FROM public.email_queue WHERE user_id = OLD.id;
    
    -- 12. Delete admin logs where this user was the performer (keep entity_id for audit trail)
    DELETE FROM public.admin_logs WHERE performed_by = OLD.id;
    
    -- 13. Delete the user profile from public.users
    DELETE FROM public.users WHERE id = OLD.id;
    
    -- Log the cascading deletion
    INSERT INTO public.admin_logs (
      entity_type,
      entity_id,
      action,
      description,
      performed_by,
      created_at
    ) VALUES (
      'user',
      OLD.id,
      'cascade_deleted',
      'User and all related records deleted from auth and all tables',
      OLD.id,
      now()
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but don't block the deletion
      RAISE NOTICE 'Failed to cascade delete for user %: %', OLD.id, SQLERRM;
  END;
  
  RETURN OLD;
END;
$function$;

-- Replace the existing trigger with the new cascading deletion function
DROP TRIGGER IF EXISTS handle_auth_user_deleted_trigger ON auth.users;

CREATE TRIGGER handle_user_cascade_deletion_trigger
  AFTER DELETE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_user_cascade_deletion();