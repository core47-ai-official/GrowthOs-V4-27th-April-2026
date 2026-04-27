-- ============================================
-- PHASE 1: Security Function for Recording URL Protection
-- ============================================

-- Create function to validate mentor recording updates (prevent URL changes)
CREATE OR REPLACE FUNCTION public.validate_mentor_recording_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if current user is a mentor
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'mentor'
  ) THEN
    -- Prevent mentors from changing recording_url
    IF OLD.recording_url IS DISTINCT FROM NEW.recording_url THEN
      RAISE EXCEPTION 'Mentors cannot modify video URLs';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to enforce URL protection
DROP TRIGGER IF EXISTS prevent_mentor_url_changes ON public.available_lessons;
CREATE TRIGGER prevent_mentor_url_changes
  BEFORE UPDATE ON public.available_lessons
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_mentor_recording_update();

-- ============================================
-- PHASE 2: RLS Policy Updates for Mentors
-- ============================================

-- Update available_lessons RLS policies to allow mentor updates (except URL)
DROP POLICY IF EXISTS "Mentors can update recordings (except URL)" ON public.available_lessons;
CREATE POLICY "Mentors can update recordings (except URL)"
ON public.available_lessons
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'mentor')
WITH CHECK (get_current_user_role() = 'mentor');

DROP POLICY IF EXISTS "Mentors can insert recordings" ON public.available_lessons;
CREATE POLICY "Mentors can insert recordings"
ON public.available_lessons
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'mentor');

DROP POLICY IF EXISTS "Mentors can delete recordings" ON public.available_lessons;
CREATE POLICY "Mentors can delete recordings"
ON public.available_lessons
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'mentor');

-- Update assignments RLS policies to allow mentor management
DROP POLICY IF EXISTS "Mentors can insert assignments" ON public.assignments;
CREATE POLICY "Mentors can insert assignments"
ON public.assignments
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'mentor');

DROP POLICY IF EXISTS "Mentors can update assignments" ON public.assignments;
CREATE POLICY "Mentors can update assignments"
ON public.assignments
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'mentor')
WITH CHECK (get_current_user_role() = 'mentor');

DROP POLICY IF EXISTS "Mentors can delete assignments" ON public.assignments;
CREATE POLICY "Mentors can delete assignments"
ON public.assignments
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'mentor');

-- Update modules RLS policies to allow mentor management
DROP POLICY IF EXISTS "Mentors can insert modules" ON public.modules;
CREATE POLICY "Mentors can insert modules"
ON public.modules
FOR INSERT
TO authenticated
WITH CHECK (get_current_user_role() = 'mentor');

DROP POLICY IF EXISTS "Mentors can update modules" ON public.modules;
CREATE POLICY "Mentors can update modules"
ON public.modules
FOR UPDATE
TO authenticated
USING (get_current_user_role() = 'mentor')
WITH CHECK (get_current_user_role() = 'mentor');

DROP POLICY IF EXISTS "Mentors can delete modules" ON public.modules;
CREATE POLICY "Mentors can delete modules"
ON public.modules
FOR DELETE
TO authenticated
USING (get_current_user_role() = 'mentor');

-- ============================================
-- PHASE 3: Update Notification Function to Include Students
-- ============================================

-- Update the notify_on_learning_item_changed function to also notify students
CREATE OR REPLACE FUNCTION public.notify_on_learning_item_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  actor_name text;
  action text;
  item_type text;
  item_title text;
  item_id uuid;
  payload jsonb;
BEGIN
  SELECT full_name INTO actor_name FROM public.users WHERE id = auth.uid();
  action := lower(tg_op);

  IF tg_table_name = 'available_lessons' THEN
    item_type := 'recording';
    item_title := coalesce(new.recording_title, old.recording_title);
    item_id := coalesce(new.id, old.id);
  ELSIF tg_table_name = 'assignments' THEN
    item_type := 'assignment';
    item_title := coalesce(new.name, old.name);
    item_id := coalesce(new.id, old.id);
  ELSIF tg_table_name = 'success_sessions' THEN
    item_type := 'success_session';
    item_title := coalesce(new.title, old.title);
    item_id := coalesce(new.id, old.id);
  ELSE
    RETURN coalesce(new, old);
  END IF;

  payload := jsonb_build_object(
    'changed_by_name', coalesce(actor_name, 'System'),
    'action', action,
    'item_type', item_type,
    'item_title', coalesce(item_title, 'Item'),
    'item_id', item_id
  );

  -- Notify admins, superadmins, AND students
  PERFORM public.notify_roles(array['admin','superadmin','student'], 'learning_item_changed', payload);
  
  RETURN coalesce(new, old);
END;
$$;