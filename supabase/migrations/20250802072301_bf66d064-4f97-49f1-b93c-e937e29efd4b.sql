-- Clean up existing assignment/submission related tables and functions with CASCADE
DROP TRIGGER IF EXISTS handle_assignment_submission_events_trigger ON assignment_submissions CASCADE;
DROP TRIGGER IF EXISTS handle_assignment_evaluation_trigger ON assignment_submissions CASCADE;
DROP TRIGGER IF EXISTS notify_assignment_deleted ON assignment CASCADE;

DROP FUNCTION IF EXISTS handle_assignment_submission_events() CASCADE;
DROP FUNCTION IF EXISTS handle_assignment_evaluation() CASCADE;
DROP FUNCTION IF EXISTS notify_assignment_deletion() CASCADE;
DROP FUNCTION IF EXISTS review_assignment_submission(uuid, text, integer, text, text) CASCADE;
DROP FUNCTION IF EXISTS fn_approve_submission(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS approve_assignment_submission(uuid, uuid, text) CASCADE;
DROP FUNCTION IF EXISTS is_assignment_passed(uuid, uuid) CASCADE;

DROP TABLE IF EXISTS assignment_submissions CASCADE;
DROP TABLE IF EXISTS assignment CASCADE;

-- Create new clean assignment submission system
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  mentor_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_assignments_mentor_id ON public.assignments(mentor_id);
CREATE INDEX idx_submissions_assignment_id ON public.submissions(assignment_id);
CREATE INDEX idx_submissions_student_id ON public.submissions(student_id);
CREATE INDEX idx_submissions_status ON public.submissions(status);

-- Create triggers for updated_at
CREATE TRIGGER update_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at
  BEFORE UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assignments table
CREATE POLICY "Everyone can view assignments" ON public.assignments
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage assignments" ON public.assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- RLS Policies for submissions table
CREATE POLICY "Students can create their own submissions" ON public.submissions
  FOR INSERT WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Students can view their own submissions" ON public.submissions
  FOR SELECT USING (
    auth.uid() = student_id AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'student')
  );

CREATE POLICY "Assigned mentors can view submissions" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      JOIN public.users u ON u.id = auth.uid()
      WHERE a.id = submissions.assignment_id
      AND a.mentor_id = auth.uid()
      AND u.role = 'mentor'
    )
  );

CREATE POLICY "Admins can view all submissions" ON public.submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

CREATE POLICY "Mentors and admins can update submissions" ON public.submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND (
        u.role IN ('admin', 'superadmin') OR
        (u.role = 'mentor' AND EXISTS (
          SELECT 1 FROM public.assignments a
          WHERE a.id = submissions.assignment_id
          AND a.mentor_id = auth.uid()
        ))
      )
    )
  );

-- Create notification function for submission updates
CREATE OR REPLACE FUNCTION notify_submission_status_change()
RETURNS TRIGGER AS $$
DECLARE
  student_name TEXT;
  assignment_name TEXT;
  reviewer_name TEXT;
BEGIN
  -- Only notify on status changes
  IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
    -- Get student and assignment details
    SELECT u.full_name INTO student_name
    FROM public.users u WHERE u.id = NEW.student_id;
    
    SELECT a.name INTO assignment_name
    FROM public.assignments a WHERE a.id = NEW.assignment_id;
    
    SELECT u.full_name INTO reviewer_name
    FROM public.users u WHERE u.id = auth.uid();
    
    -- Notify the student
    PERFORM public.create_notification(
      NEW.student_id,
      'assignment_submission',
      CASE 
        WHEN NEW.status = 'approved' THEN 'Assignment Approved!'
        WHEN NEW.status = 'declined' THEN 'Assignment Needs Revision'
        ELSE 'Assignment Status Updated'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 
          'Congratulations! Your assignment "' || assignment_name || '" has been approved.'
        WHEN NEW.status = 'declined' THEN 
          'Your assignment "' || assignment_name || '" needs revision. Please check the feedback and resubmit.'
        ELSE 
          'Your assignment "' || assignment_name || '" status has been updated to ' || NEW.status || '.'
      END,
      jsonb_build_object(
        'assignment_id', NEW.assignment_id,
        'submission_id', NEW.id,
        'status', NEW.status,
        'notes', NEW.notes,
        'reviewer', reviewer_name
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for submission notifications
CREATE TRIGGER notify_submission_status_change_trigger
  AFTER UPDATE ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_submission_status_change();