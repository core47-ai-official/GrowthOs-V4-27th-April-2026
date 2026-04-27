-- =====================================================
-- BATCH-BASED CONTENT DEPLOYMENT SYSTEM (FIXED ORDER)
-- =====================================================

-- 1) Add batch_id to course_enrollments FIRST (before policies that reference it)
ALTER TABLE public.course_enrollments
  ADD COLUMN IF NOT EXISTS batch_id uuid;

-- 2) Create batches table
CREATE TABLE public.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  timezone text DEFAULT 'Asia/Karachi',
  default_session_time time DEFAULT '20:00',
  status text DEFAULT 'active' CHECK (status IN ('draft', 'active', 'completed')),
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 3) Add foreign key constraint to course_enrollments.batch_id
ALTER TABLE public.course_enrollments
  ADD CONSTRAINT course_enrollments_batch_id_fkey
  FOREIGN KEY (batch_id) REFERENCES public.batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_batch ON public.course_enrollments(batch_id);

-- Enable RLS on batches
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

-- Staff can manage batches
CREATE POLICY "Staff can view batches"
ON public.batches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
  )
);

CREATE POLICY "Admin can insert batches"
ON public.batches FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admin can update batches"
ON public.batches FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admin can delete batches"
ON public.batches FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Students can view batches they're enrolled in
CREATE POLICY "Students can view enrolled batches"
ON public.batches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.batch_id = batches.id
    AND ce.student_id IN (
      SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    )
  )
);

-- 4) Create batch_timeline_items table
CREATE TABLE public.batch_timeline_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('RECORDING', 'LIVE_SESSION')),
  title text NOT NULL,
  description text,
  drip_offset_days integer NOT NULL DEFAULT 0,
  sequence_order integer NOT NULL DEFAULT 0,
  
  -- Recording-specific fields (used when type = 'RECORDING')
  recording_id uuid REFERENCES public.available_lessons(id) ON DELETE SET NULL,
  
  -- Live session specific fields (used when type = 'LIVE_SESSION')
  start_datetime timestamptz,
  end_datetime timestamptz,
  meeting_link text,
  zoom_username text,
  zoom_password text,
  recording_url text,
  session_status text DEFAULT 'scheduled' CHECK (session_status IN ('scheduled', 'live', 'completed', 'cancelled')),
  
  -- Assignment gating (applies to recordings only)
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  
  -- Email reminder tracking
  reminder_24h_sent_at timestamptz,
  reminder_1h_sent_at timestamptz,
  reminder_start_sent_at timestamptz,
  
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_timeline_batch_offset ON public.batch_timeline_items(batch_id, drip_offset_days);
CREATE INDEX idx_timeline_type ON public.batch_timeline_items(type);
CREATE INDEX idx_timeline_recording ON public.batch_timeline_items(recording_id) WHERE recording_id IS NOT NULL;
CREATE INDEX idx_timeline_session_status ON public.batch_timeline_items(session_status) WHERE type = 'LIVE_SESSION';

-- Enable RLS on batch_timeline_items
ALTER TABLE public.batch_timeline_items ENABLE ROW LEVEL SECURITY;

-- Staff can manage timeline items
CREATE POLICY "Staff can view timeline items"
ON public.batch_timeline_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
  )
);

CREATE POLICY "Admin can insert timeline items"
ON public.batch_timeline_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admin can update timeline items"
ON public.batch_timeline_items FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

CREATE POLICY "Admin can delete timeline items"
ON public.batch_timeline_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Students can view timeline items for their batch
CREATE POLICY "Students can view enrolled timeline items"
ON public.batch_timeline_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.course_enrollments ce
    WHERE ce.batch_id = batch_timeline_items.batch_id
    AND ce.student_id IN (
      SELECT s.id FROM public.students s WHERE s.user_id = auth.uid()
    )
  )
);

-- 5) Trigger to prevent batch start_date change after it has started
CREATE OR REPLACE FUNCTION public.validate_batch_start_date_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.start_date <= CURRENT_DATE AND NEW.start_date IS DISTINCT FROM OLD.start_date THEN
    RAISE EXCEPTION 'Batch start date cannot be changed after it has started.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER check_batch_start_date
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_batch_start_date_change();

-- 6) Function to get batch timeline status for a student
CREATE OR REPLACE FUNCTION public.get_batch_timeline_status(
  p_user_id uuid,
  p_batch_id uuid
)
RETURNS TABLE (
  item_id uuid,
  item_type text,
  title text,
  description text,
  drip_offset_days integer,
  sequence_order integer,
  is_deployed boolean,
  deployed_date date,
  is_unlocked boolean,
  unlock_reason text,
  recording_id uuid,
  recording_url text,
  duration_min integer,
  recording_watched boolean,
  assignment_id uuid,
  assignment_required boolean,
  assignment_status text,
  start_datetime timestamptz,
  end_datetime timestamptz,
  meeting_link text,
  session_recording_url text,
  session_status text,
  session_state text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_batch_start_date date;
  v_student_id uuid;
  v_prev_assignment_approved boolean := TRUE;
  v_item RECORD;
BEGIN
  -- Get batch start date
  SELECT start_date INTO v_batch_start_date
  FROM batches WHERE id = p_batch_id;
  
  IF v_batch_start_date IS NULL THEN
    RETURN;
  END IF;
  
  -- Get student_id from user_id
  SELECT id INTO v_student_id
  FROM students WHERE user_id = p_user_id;
  
  FOR v_item IN (
    SELECT 
      bti.*,
      al.recording_url as lesson_recording_url,
      al.duration_min as lesson_duration,
      rv.watched as lesson_watched,
      (
        SELECT sub.status 
        FROM submissions sub 
        WHERE sub.assignment_id = bti.assignment_id 
        AND sub.student_id = v_student_id
        ORDER BY sub.created_at DESC 
        LIMIT 1
      ) as latest_submission_status
    FROM batch_timeline_items bti
    LEFT JOIN available_lessons al ON bti.recording_id = al.id
    LEFT JOIN recording_views rv ON rv.recording_id = al.id AND rv.user_id = p_user_id
    WHERE bti.batch_id = p_batch_id
    ORDER BY bti.drip_offset_days ASC, bti.sequence_order ASC, bti.start_datetime ASC NULLS LAST
  )
  LOOP
    DECLARE
      v_is_deployed boolean;
      v_deployed_date date;
      v_is_unlocked boolean;
      v_unlock_reason text;
      v_session_state text := NULL;
    BEGIN
      -- Calculate deployment
      v_deployed_date := v_batch_start_date + v_item.drip_offset_days;
      v_is_deployed := CURRENT_DATE >= v_deployed_date;
      
      -- Calculate unlock status based on type
      IF v_item.type = 'RECORDING' THEN
        IF NOT v_is_deployed THEN
          v_is_unlocked := FALSE;
          v_unlock_reason := 'Content will be available on ' || v_deployed_date::text;
        ELSIF NOT v_prev_assignment_approved THEN
          v_is_unlocked := FALSE;
          v_unlock_reason := 'Complete and get approval on previous assignment to unlock';
        ELSE
          v_is_unlocked := TRUE;
          v_unlock_reason := NULL;
        END IF;
        
        -- Update prev_assignment_approved for next iteration
        IF v_item.assignment_id IS NOT NULL THEN
          v_prev_assignment_approved := (v_item.latest_submission_status = 'approved');
        END IF;
        
      ELSIF v_item.type = 'LIVE_SESSION' THEN
        IF NOT v_is_deployed THEN
          v_is_unlocked := FALSE;
          v_unlock_reason := 'Session will be available on ' || v_deployed_date::text;
        ELSE
          v_is_unlocked := TRUE;
          v_unlock_reason := NULL;
        END IF;
        
        -- Calculate session state
        IF v_item.start_datetime IS NOT NULL THEN
          IF NOW() < (v_item.start_datetime - INTERVAL '2 hours') THEN
            v_session_state := 'upcoming';
          ELSIF NOW() >= (v_item.start_datetime - INTERVAL '2 hours') AND NOW() <= COALESCE(v_item.end_datetime, v_item.start_datetime + INTERVAL '2 hours') THEN
            v_session_state := 'join_now';
          ELSIF NOW() > COALESCE(v_item.end_datetime, v_item.start_datetime + INTERVAL '2 hours') THEN
            IF v_item.recording_url IS NOT NULL THEN
              v_session_state := 'watch_now';
            ELSE
              v_session_state := 'recording_pending';
            END IF;
          END IF;
        ELSE
          v_session_state := 'upcoming';
        END IF;
      END IF;
      
      -- Return this row
      item_id := v_item.id;
      item_type := v_item.type;
      title := v_item.title;
      description := v_item.description;
      drip_offset_days := v_item.drip_offset_days;
      sequence_order := v_item.sequence_order;
      is_deployed := v_is_deployed;
      deployed_date := v_deployed_date;
      is_unlocked := v_is_unlocked;
      unlock_reason := v_unlock_reason;
      recording_id := v_item.recording_id;
      recording_url := v_item.lesson_recording_url;
      duration_min := v_item.lesson_duration;
      recording_watched := COALESCE(v_item.lesson_watched, FALSE);
      assignment_id := v_item.assignment_id;
      assignment_required := (v_item.assignment_id IS NOT NULL);
      assignment_status := v_item.latest_submission_status;
      start_datetime := v_item.start_datetime;
      end_datetime := v_item.end_datetime;
      meeting_link := v_item.meeting_link;
      session_recording_url := v_item.recording_url;
      session_status := v_item.session_status;
      session_state := v_session_state;
      
      RETURN NEXT;
    END;
  END LOOP;
END;
$$;

-- 7) Update timestamp triggers for new tables
CREATE TRIGGER update_batches_updated_at
  BEFORE UPDATE ON public.batches
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_batch_timeline_items_updated_at
  BEFORE UPDATE ON public.batch_timeline_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();