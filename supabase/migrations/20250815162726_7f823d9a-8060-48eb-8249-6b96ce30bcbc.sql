-- Fix the submission approval trigger to handle all approval scenarios
CREATE OR REPLACE FUNCTION public.handle_submission_approval()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  assignment_recording_id uuid;
BEGIN
  -- Process when status changes to approved (including resubmissions)
  IF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Get the recording_id from the assignment
    SELECT recording_id INTO assignment_recording_id
    FROM public.assignments
    WHERE id = NEW.assignment_id;
    
    -- Unlock next recording if this assignment is linked to a recording
    IF assignment_recording_id IS NOT NULL THEN
      PERFORM public.unlock_next_recording(NEW.student_id, assignment_recording_id);
    END IF;
    
    -- Send broadcast for real-time updates
    PERFORM pg_notify('submission_approved', json_build_object(
      'student_id', NEW.student_id,
      'assignment_id', NEW.assignment_id,
      'recording_id', assignment_recording_id
    )::text);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Ensure the trigger exists and is properly configured
DROP TRIGGER IF EXISTS trigger_submission_approval ON public.submissions;
CREATE TRIGGER trigger_submission_approval
  AFTER UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_submission_approval();