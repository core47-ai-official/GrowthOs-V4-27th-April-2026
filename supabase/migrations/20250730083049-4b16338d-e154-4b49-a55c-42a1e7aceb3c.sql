-- Assignment Submission Pipeline Rebuild
-- Step 1: Create enum for submission status
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_submission_status') THEN
    CREATE TYPE assignment_submission_status AS ENUM (
      'submitted', 'under_review', 'accepted', 'rejected', 'resubmit'
    );
  END IF;
END$$;

-- Step 2: Rebuild assignment_submissions table with proper structure
DROP TABLE IF EXISTS public.assignment_submissions CASCADE;

CREATE TABLE public.assignment_submissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES public.assignment (assignment_id),
  user_id         uuid NOT NULL REFERENCES public.users (id),
  submission_type text NOT NULL CHECK (submission_type IN ('text','file','link','mixed')),
  text_response   text,
  file_url        text,
  external_link   text,
  status          assignment_submission_status NOT NULL DEFAULT 'submitted',
  score           INTEGER CHECK (score BETWEEN 0 AND 100),
  feedback        text,
  reviewed_by     uuid REFERENCES public.users(id),
  reviewed_at     timestamptz,
  submitted_at    timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_note   text
);

-- Step 3: Create user_unlocks table for recording access
CREATE TABLE IF NOT EXISTS public.user_unlocks (
  user_id       uuid NOT NULL REFERENCES public.users(id),
  recording_id  uuid NOT NULL REFERENCES public.available_lessons(id),
  is_unlocked   boolean NOT NULL DEFAULT false,
  unlocked_at   timestamptz,
  PRIMARY KEY (user_id, recording_id)
);

-- Step 4: Enable RLS on both tables
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unlocks ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies for assignment_submissions

-- Students can view only their own submissions
CREATE POLICY "Students can view own submissions" ON public.assignment_submissions
FOR SELECT USING (auth.uid() = user_id);

-- Students can create submissions
CREATE POLICY "Students can create submissions" ON public.assignment_submissions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Students cannot update after submission
CREATE POLICY "Students cannot update submissions" ON public.assignment_submissions
FOR UPDATE USING (false);

-- Mentors can view submissions from their assigned students
CREATE POLICY "Mentors can view assigned submissions" ON public.assignment_submissions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users u1 
    WHERE u1.id = auth.uid() 
    AND u1.role = 'mentor'
    AND EXISTS (
      SELECT 1 FROM public.users u2 
      WHERE u2.id = assignment_submissions.user_id 
      AND u2.mentor_id = auth.uid()
    )
  )
);

-- Mentors can update submissions from their assigned students
CREATE POLICY "Mentors can update assigned submissions" ON public.assignment_submissions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users u1 
    WHERE u1.id = auth.uid() 
    AND u1.role = 'mentor'
    AND EXISTS (
      SELECT 1 FROM public.users u2 
      WHERE u2.id = assignment_submissions.user_id 
      AND u2.mentor_id = auth.uid()
    )
  )
);

-- Admins and superadmins can view all submissions
CREATE POLICY "Admins can view all submissions" ON public.assignment_submissions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Admins and superadmins can update any submission
CREATE POLICY "Admins can update all submissions" ON public.assignment_submissions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Step 6: RLS Policies for user_unlocks

-- Users can view their own unlocks
CREATE POLICY "Users can view own unlocks" ON public.user_unlocks
FOR SELECT USING (auth.uid() = user_id);

-- System can manage unlocks
CREATE POLICY "System can manage unlocks" ON public.user_unlocks
FOR ALL USING (auth.role() = 'service_role');

-- Admins can view all unlocks
CREATE POLICY "Admins can view all unlocks" ON public.user_unlocks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Step 7: Create review function
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
  v_next_recording_id uuid;
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

  -- Update submission
  UPDATE public.assignment_submissions
  SET 
    status = CASE 
      WHEN p_decision = 'accepted' THEN 'accepted'::assignment_submission_status
      WHEN p_decision = 'rejected' THEN 'resubmit'::assignment_submission_status
    END,
    score = p_score,
    feedback = p_feedback,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    reviewed_note = p_reviewed_note,
    updated_at = now()
  WHERE id = p_submission_id;

  -- If accepted, unlock next recording
  IF p_decision = 'accepted' THEN
    -- Find next recording in sequence
    SELECT al.id INTO v_next_recording_id
    FROM public.available_lessons al
    JOIN public.assignment a ON a.sequence_order = al.sequence_order
    WHERE a.assignment_id = v_submission.assignment_id
    AND al.sequence_order = (
      SELECT sequence_order + 1 
      FROM public.assignment 
      WHERE assignment_id = v_submission.assignment_id
    )
    LIMIT 1;

    -- Unlock next recording if found
    IF v_next_recording_id IS NOT NULL THEN
      INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
      VALUES (v_submission.user_id, v_next_recording_id, true, now())
      ON CONFLICT (user_id, recording_id) 
      DO UPDATE SET is_unlocked = true, unlocked_at = now();
    END IF;
  END IF;

  -- Return result
  v_result := json_build_object(
    'success', true,
    'submission_id', p_submission_id,
    'status', CASE 
      WHEN p_decision = 'accepted' THEN 'accepted'
      ELSE 'resubmit'
    END,
    'next_recording_unlocked', v_next_recording_id IS NOT NULL
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

-- Step 8: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user_id ON public.assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON public.assignment_submissions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON public.assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_submitted_at ON public.assignment_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_user_unlocks_user_id ON public.user_unlocks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_unlocks_recording_id ON public.user_unlocks(recording_id);