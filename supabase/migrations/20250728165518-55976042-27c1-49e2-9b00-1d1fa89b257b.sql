-- Create comprehensive notification functions for LMS events

-- Function to notify admins and superadmins when users are created
CREATE OR REPLACE FUNCTION public.notify_admins_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  admin_record RECORD;
  role_display TEXT;
BEGIN
  -- Format role for display
  role_display := CASE NEW.role
    WHEN 'enrollment_manager' THEN 'Enrollment Manager'
    ELSE INITCAP(NEW.role)
  END;

  -- Notify all admins and superadmins
  FOR admin_record IN 
    SELECT id FROM public.users 
    WHERE role IN ('admin', 'superadmin')
  LOOP
    PERFORM public.create_notification(
      admin_record.id,
      'user_management',
      'New ' || role_display || ' Created',
      'A new ' || LOWER(role_display) || ' "' || NEW.full_name || '" (' || NEW.email || ') has been added to the system.',
      jsonb_build_object(
        'user_id', NEW.id,
        'user_role', NEW.role,
        'user_name', NEW.full_name,
        'user_email', NEW.email,
        'action', 'created'
      )
    );
  END LOOP;
  
  RETURN NEW;
END;
$function$;

-- Function to notify relevant users about financial events
CREATE OR REPLACE FUNCTION public.notify_financial_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  admin_record RECORD;
  student_record RECORD;
  mentor_record RECORD;
  enrollment_manager_record RECORD;
  event_type TEXT;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  -- Determine event type based on the change
  IF TG_OP = 'INSERT' THEN
    event_type := 'payment_recorded';
    notification_title := 'Payment Recorded';
    notification_message := 'A new payment of $' || NEW.amount || ' has been recorded for installment #' || NEW.installment_number || '.';
  ELSIF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    event_type := 'payment_status_changed';
    notification_title := 'Payment Status Updated';
    notification_message := 'Payment status for installment #' || NEW.installment_number || ' has been changed from ' || OLD.status || ' to ' || NEW.status || '.';
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Get student details
  SELECT * INTO student_record FROM public.users WHERE id = COALESCE(NEW.user_id, OLD.user_id);
  
  -- Notify admins and superadmins
  FOR admin_record IN 
    SELECT id FROM public.users 
    WHERE role IN ('admin', 'superadmin')
  LOOP
    PERFORM public.create_notification(
      admin_record.id,
      'financial',
      notification_title,
      'Student "' || student_record.full_name || '" - ' || notification_message,
      jsonb_build_object(
        'student_id', student_record.id,
        'student_name', student_record.full_name,
        'installment_id', COALESCE(NEW.id, OLD.id),
        'amount', COALESCE(NEW.amount, OLD.amount),
        'installment_number', COALESCE(NEW.installment_number, OLD.installment_number),
        'action', event_type
      )
    );
  END LOOP;

  -- Notify the student
  PERFORM public.create_notification(
    student_record.id,
    'financial',
    notification_title,
    notification_message,
    jsonb_build_object(
      'installment_id', COALESCE(NEW.id, OLD.id),
      'amount', COALESCE(NEW.amount, OLD.amount),
      'installment_number', COALESCE(NEW.installment_number, OLD.installment_number),
      'action', event_type
    )
  );

  -- Notify mentor if assigned
  IF student_record.mentor_id IS NOT NULL THEN
    SELECT * INTO mentor_record FROM public.users WHERE id = student_record.mentor_id;
    PERFORM public.create_notification(
      mentor_record.id,
      'financial',
      notification_title,
      'Your student "' || student_record.full_name || '" - ' || notification_message,
      jsonb_build_object(
        'student_id', student_record.id,
        'student_name', student_record.full_name,
        'installment_id', COALESCE(NEW.id, OLD.id),
        'amount', COALESCE(NEW.amount, OLD.amount),
        'installment_number', COALESCE(NEW.installment_number, OLD.installment_number),
        'action', event_type
      )
    );
  END IF;

  -- Notify enrollment managers about their students' payments
  FOR enrollment_manager_record IN 
    SELECT id FROM public.users 
    WHERE role = 'enrollment_manager'
  LOOP
    PERFORM public.create_notification(
      enrollment_manager_record.id,
      'enrollment',
      notification_title,
      'Student "' || student_record.full_name || '" - ' || notification_message,
      jsonb_build_object(
        'student_id', student_record.id,
        'student_name', student_record.full_name,
        'installment_id', COALESCE(NEW.id, OLD.id),
        'amount', COALESCE(NEW.amount, OLD.amount),
        'installment_number', COALESCE(NEW.installment_number, OLD.installment_number),
        'action', event_type
      )
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Function to notify about user status changes (suspensions, credential updates)
CREATE OR REPLACE FUNCTION public.notify_user_status_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  admin_record RECORD;
  mentor_record RECORD;
  enrollment_manager_record RECORD;
  notification_title TEXT;
  notification_message TEXT;
  event_type TEXT;
BEGIN
  -- Check for LMS status changes (suspensions)
  IF OLD.lms_status != NEW.lms_status THEN
    event_type := 'lms_status_change';
    notification_title := 'LMS Access ' || CASE 
      WHEN NEW.lms_status = 'suspended' THEN 'Suspended'
      WHEN NEW.lms_status = 'active' THEN 'Restored'
      ELSE 'Updated'
    END;
    notification_message := 'LMS access has been ' || NEW.lms_status || ' for student "' || NEW.full_name || '".';
  -- Check for credential updates
  ELSIF (OLD.lms_password IS DISTINCT FROM NEW.lms_password AND NEW.lms_password IS NOT NULL) THEN
    event_type := 'credentials_updated';
    notification_title := 'Login Credentials Updated';
    notification_message := 'Login credentials have been updated for student "' || NEW.full_name || '".';
  -- Check for general status changes
  ELSIF OLD.status != NEW.status THEN
    event_type := 'status_change';
    notification_title := 'Student Status Updated';
    notification_message := 'Status has been changed from ' || OLD.status || ' to ' || NEW.status || ' for student "' || NEW.full_name || '".';
  ELSE
    RETURN NEW;
  END IF;

  -- Notify admins and superadmins
  FOR admin_record IN 
    SELECT id FROM public.users 
    WHERE role IN ('admin', 'superadmin')
  LOOP
    PERFORM public.create_notification(
      admin_record.id,
      'user_management',
      notification_title,
      notification_message,
      jsonb_build_object(
        'student_id', NEW.id,
        'student_name', NEW.full_name,
        'old_status', CASE 
          WHEN event_type = 'lms_status_change' THEN OLD.lms_status
          WHEN event_type = 'status_change' THEN OLD.status
          ELSE NULL
        END,
        'new_status', CASE 
          WHEN event_type = 'lms_status_change' THEN NEW.lms_status
          WHEN event_type = 'status_change' THEN NEW.status
          ELSE NULL
        END,
        'action', event_type
      )
    );
  END LOOP;

  -- Notify the student
  PERFORM public.create_notification(
    NEW.id,
    'account',
    notification_title,
    CASE 
      WHEN event_type = 'lms_status_change' AND NEW.lms_status = 'suspended' THEN 'Your LMS access has been suspended. Please contact your administrator.'
      WHEN event_type = 'lms_status_change' AND NEW.lms_status = 'active' THEN 'Your LMS access has been restored.'
      WHEN event_type = 'credentials_updated' THEN 'Your login credentials have been updated.'
      ELSE 'Your account status has been updated to ' || NEW.status || '.'
    END,
    jsonb_build_object(
      'action', event_type,
      'new_status', CASE 
        WHEN event_type = 'lms_status_change' THEN NEW.lms_status
        WHEN event_type = 'status_change' THEN NEW.status
        ELSE NULL
      END
    )
  );

  -- Notify mentor if assigned
  IF NEW.mentor_id IS NOT NULL THEN
    PERFORM public.create_notification(
      NEW.mentor_id,
      'student_management',
      notification_title,
      'Your student "' || NEW.full_name || '" - ' || 
      CASE 
        WHEN event_type = 'lms_status_change' THEN 'LMS access has been ' || NEW.lms_status || '.'
        WHEN event_type = 'credentials_updated' THEN 'Login credentials have been updated.'
        ELSE 'Status has been updated to ' || NEW.status || '.'
      END,
      jsonb_build_object(
        'student_id', NEW.id,
        'student_name', NEW.full_name,
        'action', event_type,
        'new_status', CASE 
          WHEN event_type = 'lms_status_change' THEN NEW.lms_status
          WHEN event_type = 'status_change' THEN NEW.status
          ELSE NULL
        END
      )
    );
  END IF;

  -- Notify enrollment managers about LMS suspensions
  IF event_type = 'lms_status_change' AND NEW.lms_status = 'suspended' THEN
    FOR enrollment_manager_record IN 
      SELECT id FROM public.users 
      WHERE role = 'enrollment_manager'
    LOOP
      PERFORM public.create_notification(
        enrollment_manager_record.id,
        'enrollment',
        notification_title,
        'Student "' || NEW.full_name || '" has had their LMS access suspended.',
        jsonb_build_object(
          'student_id', NEW.id,
          'student_name', NEW.full_name,
          'action', event_type,
          'new_status', NEW.lms_status
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

-- Function to notify about assignment deletions
CREATE OR REPLACE FUNCTION public.notify_assignment_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  admin_record RECORD;
  student_record RECORD;
  mentor_record RECORD;
BEGIN
  -- Notify admins and superadmins
  FOR admin_record IN 
    SELECT id FROM public.users 
    WHERE role IN ('admin', 'superadmin')
  LOOP
    PERFORM public.create_notification(
      admin_record.id,
      'assignment_management',
      'Assignment Deleted',
      'Assignment "' || OLD.assignment_title || '" has been deleted from the system.',
      jsonb_build_object(
        'assignment_id', OLD.assignment_id,
        'assignment_title', OLD.assignment_title,
        'sequence_order', OLD.sequence_order,
        'action', 'deleted'
      )
    );
  END LOOP;

  -- Notify all students about the deletion
  FOR student_record IN 
    SELECT id FROM public.users 
    WHERE role = 'student'
  LOOP
    PERFORM public.create_notification(
      student_record.id,
      'assignment',
      'Assignment Removed',
      'The assignment "' || OLD.assignment_title || '" has been removed from your curriculum.',
      jsonb_build_object(
        'assignment_id', OLD.assignment_id,
        'assignment_title', OLD.assignment_title,
        'action', 'deleted'
      )
    );
  END LOOP;

  -- Notify all mentors
  FOR mentor_record IN 
    SELECT id FROM public.users 
    WHERE role = 'mentor'
  LOOP
    PERFORM public.create_notification(
      mentor_record.id,
      'assignment_management',
      'Assignment Deleted',
      'Assignment "' || OLD.assignment_title || '" has been deleted from the curriculum.',
      jsonb_build_object(
        'assignment_id', OLD.assignment_id,
        'assignment_title', OLD.assignment_title,
        'action', 'deleted'
      )
    );
  END LOOP;

  RETURN OLD;
END;
$function$;

-- Create triggers for user creation notifications
CREATE OR REPLACE TRIGGER notify_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  WHEN (NEW.role IN ('mentor', 'enrollment_manager'))
  EXECUTE FUNCTION public.notify_admins_user_created();

-- Create triggers for financial event notifications
CREATE OR REPLACE TRIGGER notify_installment_changes
  AFTER INSERT OR UPDATE ON public.installment_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_financial_events();

-- Create triggers for user status change notifications
CREATE OR REPLACE TRIGGER notify_user_status_updates
  AFTER UPDATE ON public.users
  FOR EACH ROW
  WHEN (OLD.lms_status IS DISTINCT FROM NEW.lms_status 
        OR OLD.lms_password IS DISTINCT FROM NEW.lms_password 
        OR OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_user_status_changes();

-- Create trigger for assignment deletion notifications
CREATE OR REPLACE TRIGGER notify_assignment_deleted
  AFTER DELETE ON public.assignment
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_assignment_deletion();

-- Update existing assignment submission trigger to include more comprehensive notifications
DROP TRIGGER IF EXISTS handle_assignment_evaluation_trigger ON public.assignment_submissions;

CREATE OR REPLACE FUNCTION public.handle_assignment_submission_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  assignment_title TEXT;
  student_name TEXT;
  mentor_name TEXT;
  admin_record RECORD;
BEGIN
  -- Get assignment and user details
  SELECT a.assignment_title INTO assignment_title 
  FROM public.assignment a 
  WHERE a.assignment_id = COALESCE(NEW.assignment_id, OLD.assignment_id);
  
  SELECT u.full_name INTO student_name 
  FROM public.users u 
  WHERE u.id = COALESCE(NEW.user_id, OLD.user_id);
  
  IF COALESCE(NEW.reviewed_by, OLD.reviewed_by) IS NOT NULL THEN
    SELECT u.full_name INTO mentor_name 
    FROM public.users u 
    WHERE u.id = COALESCE(NEW.reviewed_by, OLD.reviewed_by);
  END IF;

  -- Handle new submissions
  IF TG_OP = 'INSERT' THEN
    -- Notify admins and superadmins
    FOR admin_record IN 
      SELECT id FROM public.users 
      WHERE role IN ('admin', 'superadmin')
    LOOP
      PERFORM public.create_notification(
        admin_record.id,
        'assignment_submission',
        'New Assignment Submission',
        'Student "' || student_name || '" has submitted assignment "' || COALESCE(assignment_title, 'Assignment') || '".',
        jsonb_build_object(
          'submission_id', NEW.id,
          'assignment_id', NEW.assignment_id,
          'student_id', NEW.user_id,
          'student_name', student_name,
          'assignment_title', assignment_title,
          'action', 'submitted'
        )
      );
    END LOOP;

    -- Notify assigned mentor if exists
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.user_id AND mentor_id IS NOT NULL) THEN
      DECLARE
        mentor_id UUID;
      BEGIN
        SELECT mentor_id INTO mentor_id FROM public.users WHERE id = NEW.user_id;
        PERFORM public.create_notification(
          mentor_id,
          'assignment_submission',
          'New Assignment Submission',
          'Your student "' || student_name || '" has submitted assignment "' || COALESCE(assignment_title, 'Assignment') || '".',
          jsonb_build_object(
            'submission_id', NEW.id,
            'assignment_id', NEW.assignment_id,
            'student_id', NEW.user_id,
            'student_name', student_name,
            'assignment_title', assignment_title,
            'action', 'submitted'
          )
        );
      END;
    END IF;

  -- Handle evaluation updates
  ELSIF TG_OP = 'UPDATE' AND 
        OLD.status != NEW.status AND 
        NEW.status IN ('accepted', 'rejected') AND
        NEW.reviewed_at IS NOT NULL THEN
    
    -- Notify the student
    PERFORM public.create_notification(
      NEW.user_id,
      'assignment_evaluation',
      CASE 
        WHEN NEW.status = 'accepted' THEN 'Assignment Approved!'
        ELSE 'Assignment Needs Revision'
      END,
      CASE 
        WHEN NEW.status = 'accepted' THEN 
          'Congratulations! Your assignment "' || COALESCE(assignment_title, 'Assignment') || '" has been approved by ' || COALESCE(mentor_name, 'your mentor') || '.'
        ELSE 
          'Your assignment "' || COALESCE(assignment_title, 'Assignment') || '" needs revision. Please check the feedback from ' || COALESCE(mentor_name, 'your mentor') || '.'
      END,
      jsonb_build_object(
        'assignment_id', NEW.assignment_id,
        'submission_id', NEW.id,
        'status', NEW.status,
        'feedback', NEW.feedback,
        'mentor_id', NEW.reviewed_by,
        'action', 'evaluated'
      )
    );

    -- Notify admins and superadmins
    FOR admin_record IN 
      SELECT id FROM public.users 
      WHERE role IN ('admin', 'superadmin')
    LOOP
      PERFORM public.create_notification(
        admin_record.id,
        'assignment_evaluation',
        'Assignment ' || CASE WHEN NEW.status = 'accepted' THEN 'Approved' ELSE 'Rejected' END,
        'Assignment "' || COALESCE(assignment_title, 'Assignment') || '" by student "' || student_name || '" has been ' || NEW.status || ' by ' || COALESCE(mentor_name, 'mentor') || '.',
        jsonb_build_object(
          'submission_id', NEW.id,
          'assignment_id', NEW.assignment_id,
          'student_id', NEW.user_id,
          'student_name', student_name,
          'assignment_title', assignment_title,
          'status', NEW.status,
          'reviewed_by', NEW.reviewed_by,
          'action', 'evaluated'
        )
      );
    END LOOP;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Create comprehensive assignment submission trigger
CREATE TRIGGER handle_assignment_submission_events_trigger
  AFTER INSERT OR UPDATE ON public.assignment_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_assignment_submission_events();