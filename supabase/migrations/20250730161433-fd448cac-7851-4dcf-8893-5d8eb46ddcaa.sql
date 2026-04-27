-- Fix RLS policies for tables that have RLS enabled but no policies

-- Enable RLS and add policies for badges table
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view badges" ON public.badges
FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for certificates table
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own certificates" ON public.certificates
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create certificates" ON public.certificates
FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all certificates" ON public.certificates
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for course_tracks table
ALTER TABLE public.course_tracks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view course tracks" ON public.course_tracks
FOR SELECT USING (true);

CREATE POLICY "Admins can manage course tracks" ON public.course_tracks
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for feedback table
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own feedback" ON public.feedback
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own feedback" ON public.feedback
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback" ON public.feedback
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Mentors can view assigned student feedback" ON public.feedback
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'mentor'
    AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = feedback.user_id
      AND students.mentor_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can view all feedback" ON public.feedback
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for mentorship_notes table
ALTER TABLE public.mentorship_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mentors can view their own notes" ON public.mentorship_notes
FOR SELECT USING (auth.uid() = mentor_id);

CREATE POLICY "Mentors can create notes" ON public.mentorship_notes
FOR INSERT WITH CHECK (auth.uid() = mentor_id);

CREATE POLICY "Mentors can update their own notes" ON public.mentorship_notes
FOR UPDATE USING (auth.uid() = mentor_id);

CREATE POLICY "Students can view notes about them" ON public.mentorship_notes
FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Admins can view all notes" ON public.mentorship_notes
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for messages table
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own messages" ON public.messages
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can create messages" ON public.messages
FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all messages" ON public.messages
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for pods table
ALTER TABLE public.pods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view pods" ON public.pods
FOR SELECT USING (true);

CREATE POLICY "Mentors can manage their own pods" ON public.pods
FOR ALL USING (auth.uid() = mentor_id);

CREATE POLICY "Admins can manage all pods" ON public.pods
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for progress table
ALTER TABLE public.progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own progress" ON public.progress
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own progress" ON public.progress
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON public.progress
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Mentors can view assigned student progress" ON public.progress
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'mentor'
    AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = progress.user_id
      AND students.mentor_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can view all progress" ON public.progress
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for quiz_attempts table
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own quiz attempts" ON public.quiz_attempts
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own quiz attempts" ON public.quiz_attempts
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Mentors can view assigned student quiz attempts" ON public.quiz_attempts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'mentor'
    AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = quiz_attempts.user_id
      AND students.mentor_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can view all quiz attempts" ON public.quiz_attempts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for quiz_questions table
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view quiz questions" ON public.quiz_questions
FOR SELECT USING (true);

CREATE POLICY "Admins can manage quiz questions" ON public.quiz_questions
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for recording_views table
ALTER TABLE public.recording_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recording views" ON public.recording_views
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recording views" ON public.recording_views
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recording views" ON public.recording_views
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Mentors can view assigned student recording views" ON public.recording_views
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'mentor'
    AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = recording_views.user_id
      AND students.mentor_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can view all recording views" ON public.recording_views
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for session_attendance table
ALTER TABLE public.session_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session attendance" ON public.session_attendance
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own session attendance" ON public.session_attendance
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own session attendance" ON public.session_attendance
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Mentors can view assigned student session attendance" ON public.session_attendance
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role = 'mentor'
    AND EXISTS (
      SELECT 1 FROM public.users students
      WHERE students.id = session_attendance.user_id
      AND students.mentor_id = auth.uid()
    )
  )
);

CREATE POLICY "Admins can view all session attendance" ON public.session_attendance
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for user_badges table
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own badges" ON public.user_badges
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view user badges" ON public.user_badges
FOR SELECT USING (true);

CREATE POLICY "System can award badges" ON public.user_badges
FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can manage user badges" ON public.user_badges
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for user_segments table
ALTER TABLE public.user_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own segments" ON public.user_segments
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage segments" ON public.user_segments
FOR ALL WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all segments" ON public.user_segments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Enable RLS and add policies for performance_record table
ALTER TABLE public.performance_record ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own performance record" ON public.performance_record
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage performance records" ON public.performance_record
FOR ALL WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Admins can view all performance records" ON public.performance_record
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('admin', 'superadmin')
  )
);

-- Fix the submission review function to properly handle feedback and score
DROP FUNCTION IF EXISTS public.review_assignment_submission(uuid, text, integer, text, text);

CREATE OR REPLACE FUNCTION public.review_assignment_submission(
  p_submission_id uuid,
  p_decision text,
  p_score integer DEFAULT NULL,
  p_feedback text DEFAULT NULL,
  p_reviewed_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_submission record;
  v_current_user_role text;
  v_can_review boolean := false;
  v_result json;
BEGIN
  -- Validate decision
  IF p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision. Must be "accepted" or "rejected"';
  END IF;

  -- Get current user role
  SELECT role INTO v_current_user_role
  FROM public.users 
  WHERE id = auth.uid();

  -- Get submission details
  SELECT s.*, u.mentor_id INTO v_submission
  FROM public.assignment_submissions s
  JOIN public.users u ON u.id = s.user_id
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  -- Check permissions
  IF v_current_user_role IN ('admin', 'superadmin') THEN
    v_can_review := true;
  ELSIF v_current_user_role = 'mentor' AND v_submission.mentor_id = auth.uid() THEN
    v_can_review := true;
  END IF;

  IF NOT v_can_review THEN
    RAISE EXCEPTION 'You are not authorized to review this submission';
  END IF;

  -- Update submission with feedback and score
  UPDATE public.assignment_submissions
  SET 
    status = CASE 
      WHEN p_decision = 'accepted' THEN 'accepted'::assignment_submission_status
      WHEN p_decision = 'rejected' THEN 'rejected'::assignment_submission_status
    END,
    score = p_score,
    feedback = p_feedback,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewed_note = p_reviewed_note,
    updated_at = now()
  WHERE id = p_submission_id;

  -- Return result
  v_result := json_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'status', p_decision,
    'score', p_score,
    'feedback', p_feedback
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;