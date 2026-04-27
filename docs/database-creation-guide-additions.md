# Database Creation Guide - Missing Components

This document contains all the missing tables, functions, and features that need to be added to the main database creation guide.

## Missing Tables

### 1. User Security Summary Tables

```sql
-- User security summary table
CREATE TABLE public.user_security_summary (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    total_violations integer NOT NULL DEFAULT 0,
    last_violation_at timestamp with time zone,
    security_score integer NOT NULL DEFAULT 100,
    risk_level text NOT NULL DEFAULT 'low',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    CONSTRAINT valid_security_score CHECK (security_score >= 0 AND security_score <= 100),
    UNIQUE(user_id)
);

-- User security summary backup table
CREATE TABLE public.user_security_summary_backup (
    id uuid,
    user_id uuid,
    total_violations integer,
    last_violation_at timestamp with time zone,
    security_score integer,
    risk_level text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    backup_created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_security_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_summary_backup ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_security_summary
CREATE POLICY "Users can view their own security summary" ON public.user_security_summary
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all security summaries" ON public.user_security_summary
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "System can manage security summaries" ON public.user_security_summary
    FOR ALL USING (true);

-- RLS Policies for user_security_summary_backup
CREATE POLICY "Superadmins can view security summary backups" ON public.user_security_summary_backup
    FOR SELECT USING (public.get_current_user_role() = 'superadmin');

-- Triggers
CREATE TRIGGER update_user_security_summary_updated_at
    BEFORE UPDATE ON public.user_security_summary
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 2. Segmented Success Sessions Tables

```sql
-- Segmented weekly success sessions view table
CREATE TABLE public.segmented_weekly_success_sessions (
    id uuid NOT NULL PRIMARY KEY,
    title text,
    description text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    mentor_id uuid,
    mentor_name text,
    status text,
    created_at timestamp without time zone,
    segment text DEFAULT 'weekly'::text
);

-- Segmented weekly success sessions backup
CREATE TABLE public.segmented_weekly_success_sessions_backup (
    id uuid,
    title text,
    description text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    mentor_id uuid,
    mentor_name text,
    status text,
    created_at timestamp without time zone,
    segment text
);

-- Enable RLS
ALTER TABLE public.segmented_weekly_success_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segmented_weekly_success_sessions_backup ENABLE ROW LEVEL SECURITY;

-- RLS Policies for segmented_weekly_success_sessions
CREATE POLICY "Staff can view all success sessions" ON public.segmented_weekly_success_sessions
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Students can view success sessions" ON public.segmented_weekly_success_sessions
    FOR SELECT USING (public.get_current_user_role() = 'student');

-- RLS Policies for segmented_weekly_success_sessions_backup
CREATE POLICY "Superadmins can view sessions backup" ON public.segmented_weekly_success_sessions_backup
    FOR SELECT USING (public.get_current_user_role() = 'superadmin');

-- Success session sync trigger
CREATE OR REPLACE FUNCTION public.handle_success_session_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM segmented_weekly_success_sessions WHERE id = OLD.id;
    RETURN OLD;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO segmented_weekly_success_sessions (
      id, title, description, start_time, end_time, 
      mentor_id, mentor_name, status, created_at, segment
    ) VALUES (
      NEW.id,
      NEW.title,
      NEW.description,
      NEW.start_time,
      NEW.end_time,
      NEW.mentor_id,
      NEW.mentor_name,
      NEW.status,
      NEW.created_at,
      'weekly'::text
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE segmented_weekly_success_sessions SET
      title = NEW.title,
      description = NEW.description,
      start_time = NEW.start_time,
      end_time = NEW.end_time,
      mentor_id = NEW.mentor_id,
      mentor_name = NEW.mentor_name,
      status = NEW.status
    WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$function$;

CREATE TRIGGER handle_success_session_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.success_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_success_session_sync();
```

### 3. User Metrics Table (with correct column definition)

```sql
-- Fix user_metrics table to include missing columns
CREATE TABLE public.user_metrics (
    id bigint NOT NULL DEFAULT nextval('user_metrics_id_seq'::regclass) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date date NOT NULL,
    metric text NOT NULL,
    value numeric NOT NULL,
    source text NOT NULL,
    fetched_at timestamp with time zone NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, date, metric, source)
);

-- Enable RLS
ALTER TABLE public.user_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own metrics" ON public.user_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all metrics" ON public.user_metrics
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "System can insert metrics" ON public.user_metrics
    FOR INSERT WITH CHECK (true);
```

## Missing Database Functions

### 1. User Creation Functions

```sql
-- Create user with role validation
CREATE OR REPLACE FUNCTION public.create_user_with_role(target_email text, target_password text, target_role text, target_full_name text DEFAULT NULL::text, target_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  current_user_role text;
  user_count integer;
  result jsonb;
BEGIN
  -- Get current user count to check if this is bootstrap scenario
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  -- If no users exist, allow creation of superadmin (bootstrap scenario)
  IF user_count = 0 THEN
    IF target_role != 'superadmin' THEN
      RETURN jsonb_build_object('error', 'First user must be a superadmin');
    END IF;
    -- Skip permission check for bootstrap
  ELSE
    -- Get current user's role for permission check
    SELECT role INTO current_user_role FROM public.users WHERE id = auth.uid();
    
    IF current_user_role IS NULL THEN
      RETURN jsonb_build_object('error', 'Unauthorized: No valid session');
    END IF;
    
    -- Permission matrix check
    CASE current_user_role
      WHEN 'superadmin' THEN
        -- Superadmins can create anyone
        NULL;
      WHEN 'admin' THEN
        -- Admins can create students, mentors, enrollment_managers
        IF target_role NOT IN ('student', 'mentor', 'enrollment_manager') THEN
          RETURN jsonb_build_object('error', 'Admins cannot create ' || target_role || ' users');
        END IF;
      WHEN 'enrollment_manager' THEN
        -- Enrollment managers can only create students
        IF target_role != 'student' THEN
          RETURN jsonb_build_object('error', 'Enrollment managers can only create students');
        END IF;
      ELSE
        RETURN jsonb_build_object('error', 'Insufficient permissions to create users');
    END CASE;
  END IF;
  
  -- Validate role
  IF target_role NOT IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student') THEN
    RETURN jsonb_build_object('error', 'Invalid role: ' || target_role);
  END IF;
  
  -- Validate email format
  IF target_email !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RETURN jsonb_build_object('error', 'Invalid email format');
  END IF;
  
  -- Check if email already exists
  IF EXISTS (SELECT 1 FROM public.users WHERE email = target_email) THEN
    RETURN jsonb_build_object('error', 'User with this email already exists');
  END IF;
  
  -- Return success - the actual user creation will be handled by the edge function
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Permission check passed',
    'can_create', true
  );
END;
$function$;
```

### 2. Auth and User Management Functions

```sql
-- Handle auth user deletion
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
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
$function$;

-- Handle user cascade deletion
CREATE OR REPLACE FUNCTION public.handle_user_cascade_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
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

-- Triggers for auth.users table
CREATE TRIGGER handle_auth_user_deleted_trigger
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();

CREATE TRIGGER handle_user_cascade_deletion_trigger
    BEFORE DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_cascade_deletion();
```

### 3. Student Recovery and Analytics Functions

```sql
-- Get inactive students for recovery
CREATE OR REPLACE FUNCTION public.get_inactive_students(days_threshold integer DEFAULT 3)
RETURNS TABLE(user_id uuid, email text, full_name text, last_active_at timestamp with time zone, days_inactive integer, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.last_active_at,
    EXTRACT(DAYS FROM (now() - u.last_active_at))::INTEGER as days_inactive,
    u.phone
  FROM public.users u
  WHERE u.role = 'student'
    AND u.status = 'active'
    AND u.lms_status = 'active'
    AND u.last_active_at IS NOT NULL
    AND u.last_active_at < (now() - INTERVAL '1 day' * days_threshold)
    AND NOT EXISTS (
      SELECT 1 FROM public.student_recovery_messages srm
      WHERE srm.user_id = u.id
        AND srm.message_sent_at > (now() - INTERVAL '1 day')
    );
END;
$function$;

-- Record recovery message
CREATE OR REPLACE FUNCTION public.record_recovery_message(p_user_id uuid, p_message_type text DEFAULT 'whatsapp_inactive'::text, p_days_inactive integer DEFAULT 3, p_message_content text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  message_id UUID;
BEGIN
  INSERT INTO public.student_recovery_messages (
    user_id,
    message_type,
    days_inactive,
    message_content
  ) VALUES (
    p_user_id,
    p_message_type,
    p_days_inactive,
    p_message_content
  ) RETURNING id INTO message_id;
  
  RETURN message_id;
END;
$function$;

-- Get LMS status for user
CREATE OR REPLACE FUNCTION public.get_user_lms_status(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(lms_status, 'inactive') FROM public.users WHERE id = user_id;
$function$;
```

### 4. Questionnaire Validation Function

```sql
-- Validate questionnaire structure
CREATE OR REPLACE FUNCTION public.validate_questionnaire_structure(questionnaire_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  question JSONB;
  answer_type TEXT;
BEGIN
  -- Check if questionnaire_data is an array
  IF jsonb_typeof(questionnaire_data) != 'array' THEN
    RETURN FALSE;
  END IF;

  -- Validate each question
  FOR question IN SELECT jsonb_array_elements(questionnaire_data)
  LOOP
    -- Check required fields
    IF NOT (question ? 'id' AND question ? 'text' AND question ? 'order' AND question ? 'answerType') THEN
      RETURN FALSE;
    END IF;

    answer_type := question->>'answerType';
    
    -- Validate answerType
    IF answer_type NOT IN ('singleLine', 'multiLine', 'singleSelect', 'multiSelect', 'file') THEN
      RETURN FALSE;
    END IF;

    -- Validate options field for select types
    IF answer_type IN ('singleSelect', 'multiSelect') THEN
      IF NOT (question ? 'options' AND jsonb_typeof(question->'options') = 'array' AND jsonb_array_length(question->'options') > 0) THEN
        RETURN FALSE;
      END IF;
    END IF;

    -- Ensure options is not present for non-select types
    IF answer_type IN ('singleLine', 'multiLine', 'file') AND (question ? 'options') THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$function$;
```

### 5. Company Branding Function

```sql
-- Update company branding
CREATE OR REPLACE FUNCTION public.update_company_branding(branding_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  result json;
BEGIN
  UPDATE public.company_settings 
  SET branding = branding_data,
      updated_at = now()
  WHERE id = 1;
  
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (id, branding, created_at, updated_at)
    VALUES (1, branding_data, now(), now());
  END IF;
  
  result := json_build_object('success', true, 'branding', branding_data);
  RETURN result;
END;
$function$;
```

### 6. Student Creation Function

```sql
-- Complete student creation function
CREATE OR REPLACE FUNCTION public.create_student_complete(p_email text, p_password text, p_full_name text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_mentor_id uuid DEFAULT NULL::uuid, p_batch_id uuid DEFAULT NULL::uuid, p_pod_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    v_user_id uuid;
    v_student_id uuid;
    v_password_display text;
    v_encrypted_password text;
    result jsonb;
BEGIN
    -- Generate a display password
    v_password_display := p_password;
    
    -- For security, we'll hash the password (in production, this should be done by auth system)
    v_encrypted_password := crypt(p_password, gen_salt('bf'));
    
    -- Create the user first
    INSERT INTO public.users (
        email,
        full_name,
        role,
        password_display,
        password_hash,
        is_temp_password,
        status,
        lms_status,
        created_at,
        updated_at
    ) VALUES (
        p_email,
        p_full_name,
        'student',
        v_password_display,
        v_encrypted_password,
        true,
        'active',
        'active',
        now(),
        now()
    ) RETURNING id INTO v_user_id;
    
    -- Create the student record with onboarding_completed = false
    INSERT INTO public.students (
        user_id,
        onboarding_completed,
        enrollment_date,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        false, -- Ensure onboarding is required
        now(),
        now(),
        now()
    ) RETURNING id INTO v_student_id;
    
    -- Return success result
    result := jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'student_id', v_student_id,
        'message', 'Student created successfully'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User with this email already exists'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to create student: ' || SQLERRM
        );
END;
$function$;
```

### 7. Learning Management Functions

```sql
-- Mark all notifications as read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  affected integer;
begin
  update public.notifications
  set status = 'read',
      read_at = now()
  where user_id = auth.uid()
    and status <> 'read';

  get diagnostics affected = row_count;
  return affected;
end;
$function$;

-- Send test notification
CREATE OR REPLACE FUNCTION public.send_test_notification(template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $function$
  select public.notify_users(array[auth.uid()], template_key, payload)
$function$;

-- Log data access attempt
CREATE OR REPLACE FUNCTION public.log_data_access_attempt(table_name text, operation text, user_role text, target_user_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at,
    data
  ) VALUES (
    'data_access',
    target_user_id,
    operation,
    'Data access attempt on ' || table_name || ' by ' || user_role,
    auth.uid(),
    now(),
    jsonb_build_object(
      'table_name', table_name,
      'operation', operation,
      'user_role', user_role,
      'target_user_id', target_user_id
    )
  );
END;
$function$;
```

## Additional Required Fixes

### 1. Missing Learning Item Notification Function

```sql
-- Learning item change notification trigger
CREATE OR REPLACE FUNCTION public.notify_on_learning_item_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  actor_name text;
  action text;
  item_type text;
  item_title text;
  item_id uuid;
  payload jsonb;
begin
  select full_name into actor_name from public.users where id = auth.uid();
  action := lower(tg_op);

  if tg_table_name = 'available_lessons' then
    item_type := 'recording';
    item_title := coalesce(new.recording_title, old.recording_title);
    item_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'assignments' then
    item_type := 'assignment';
    item_title := coalesce(new.name, old.name);
    item_id := coalesce(new.id, old.id);
  elsif tg_table_name = 'success_sessions' then
    item_type := 'success_session';
    item_title := coalesce(new.title, old.title);
    item_id := coalesce(new.id, old.id);
  else
    return coalesce(new, old);
  end if;

  payload := jsonb_build_object(
    'changed_by_name', coalesce(actor_name, 'System'),
    'action', action,
    'item_type', item_type,
    'item_title', coalesce(item_title, 'Item'),
    'item_id', item_id
  );

  perform public.notify_roles(array['admin','superadmin'], 'learning_item_changed', payload);
  return coalesce(new, old);
end;
$function$;

-- Apply triggers to learning tables
CREATE TRIGGER notify_on_learning_item_changed_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.available_lessons
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_learning_item_changed();

CREATE TRIGGER notify_on_assignment_changed_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_learning_item_changed();
```

### 2. Success Session Notification Function

```sql
-- Success session change notification
CREATE OR REPLACE FUNCTION public.handle_success_session_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_all_students(
      'success_session',
      'New Success Session Scheduled',
      'A new success session "' || NEW.title || '" has been scheduled for ' || NEW.schedule_date || '.',
      jsonb_build_object('session_id', NEW.id, 'action', 'added')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.notify_all_students(
      'success_session',
      'Success Session Updated',
      'The success session "' || NEW.title || '" has been updated.',
      jsonb_build_object('session_id', NEW.id, 'action', 'updated')
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER handle_success_session_changes_trigger
    AFTER INSERT OR UPDATE ON public.success_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_success_session_changes();
```

### 3. Missing Onboarding Jobs Table

```sql
-- Onboarding jobs processing table
CREATE TABLE public.onboarding_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    job_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    processed_at timestamp with time zone,
    error_message text,
    retry_count integer DEFAULT 0,
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Enable RLS
ALTER TABLE public.onboarding_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "System can manage onboarding jobs" ON public.onboarding_jobs
    FOR ALL USING (true);

CREATE POLICY "Admins can view onboarding jobs" ON public.onboarding_jobs
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Update trigger
CREATE OR REPLACE FUNCTION public.update_onboarding_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_onboarding_jobs_updated_at_trigger
    BEFORE UPDATE ON public.onboarding_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_onboarding_jobs_updated_at();
```

This document should be integrated into the main database creation guide to ensure a complete and accurate database setup.