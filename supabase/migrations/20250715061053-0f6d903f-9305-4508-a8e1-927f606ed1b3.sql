-- Create table to track module completion status
CREATE TABLE public.user_module_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  module_id UUID NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE public.user_module_progress ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own module progress" 
ON public.user_module_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own module progress" 
ON public.user_module_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own module progress" 
ON public.user_module_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_module_progress_updated_at
BEFORE UPDATE ON public.user_module_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if a user has completed a module
CREATE OR REPLACE FUNCTION public.is_module_completed(
  _user_id UUID,
  _module_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT is_completed FROM public.user_module_progress 
     WHERE user_id = _user_id AND module_id = _module_id),
    false
  );
$$;

-- Function to check if a recording has been watched completely
CREATE OR REPLACE FUNCTION public.is_recording_watched(
  _user_id UUID,
  _recording_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT watched FROM public.recording_views 
     WHERE user_id = _user_id AND recording_id = _recording_id),
    false
  );
$$;

-- Function to check if an assignment has been accepted/passed
CREATE OR REPLACE FUNCTION public.is_assignment_passed(
  _user_id UUID,
  _assignment_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.assignment_submissions 
    WHERE user_id = _user_id 
    AND assignment_id = _assignment_id 
    AND status = 'accepted'
  );
$$;

-- Function to get the next unlocked content for a user
CREATE OR REPLACE FUNCTION public.get_user_unlock_status(
  _user_id UUID
)
RETURNS TABLE (
  module_id UUID,
  recording_id UUID,
  is_module_unlocked BOOLEAN,
  is_recording_unlocked BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  current_module RECORD;
  current_recording RECORD;
  prev_module_completed BOOLEAN := true;
  prev_recording_watched BOOLEAN := true;
  prev_assignment_passed BOOLEAN := true;
BEGIN
  -- Loop through modules in order
  FOR current_module IN 
    SELECT m.id, m.title, m.order 
    FROM public.modules m 
    ORDER BY m.order NULLS LAST, m.title
  LOOP
    -- Check if previous module was completed
    IF prev_module_completed THEN
      -- Module is unlocked
      RETURN QUERY SELECT 
        current_module.id,
        NULL::UUID,
        true,
        false;
      
      -- Reset for this module's recordings
      prev_recording_watched := true;
      prev_assignment_passed := true;
      
      -- Loop through recordings in this module
      FOR current_recording IN
        SELECT al.id, al.sequence_order
        FROM public.available_lessons al
        WHERE al.module = current_module.id
        ORDER BY al.sequence_order NULLS LAST
      LOOP
        -- Check if previous recording was watched and assignment passed
        IF prev_recording_watched AND prev_assignment_passed THEN
          -- Recording is unlocked
          RETURN QUERY SELECT 
            current_module.id,
            current_recording.id,
            true,
            true;
          
          -- Check if this recording has been watched
          prev_recording_watched := public.is_recording_watched(_user_id, current_recording.id);
          
          -- Check if associated assignment has been passed
          IF prev_recording_watched THEN
            SELECT a.assignment_id INTO current_recording.id
            FROM public.assignment a
            WHERE a.sequence_order = current_recording.sequence_order;
            
            IF current_recording.id IS NOT NULL THEN
              prev_assignment_passed := public.is_assignment_passed(_user_id, current_recording.id);
            END IF;
          ELSE
            prev_assignment_passed := false;
          END IF;
        ELSE
          -- Recording is locked
          RETURN QUERY SELECT 
            current_module.id,
            current_recording.id,
            true,
            false;
        END IF;
      END LOOP;
      
      -- Check if all recordings in this module are completed
      prev_module_completed := NOT EXISTS(
        SELECT 1 FROM public.available_lessons al
        WHERE al.module = current_module.id
        AND NOT public.is_recording_watched(_user_id, al.id)
      );
      
      -- If module is completed, check all assignments are passed
      IF prev_module_completed THEN
        prev_module_completed := NOT EXISTS(
          SELECT 1 FROM public.available_lessons al
          JOIN public.assignment a ON a.sequence_order = al.sequence_order
          WHERE al.module = current_module.id
          AND NOT public.is_assignment_passed(_user_id, a.assignment_id)
        );
      END IF;
    ELSE
      -- Module is locked
      RETURN QUERY SELECT 
        current_module.id,
        NULL::UUID,
        false,
        false;
    END IF;
  END LOOP;
END;
$$;