# Database Creation Guide

Complete step-by-step guide to create a fully functional Growth OS database from scratch.

## Prerequisites

- Supabase project created
- Admin access to Supabase dashboard
- SQL Editor access
- SMTP credentials (optional, for email features)

## Overview

This guide will help you create:
- 38 core database tables with user_security_summary and backup tables
- 200+ Row Level Security (RLS) policies
- 50+ custom database functions including all auth, recovery, and notification functions
- 4 storage buckets with correct policies
- Initial configuration data
- Environment secrets
- Complete user management and security systems

## Critical Dependencies

**⚠️ IMPORTANT: Execute these functions FIRST before creating any tables or RLS policies!**

### Essential Security Function

```sql
-- CRITICAL: This function MUST be created before any RLS policies
-- It's referenced by 68+ RLS policies throughout the system
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;
```

### Required Sequences

```sql
-- Create sequences for tables that need them
CREATE SEQUENCE IF NOT EXISTS integrations_id_seq;
CREATE SEQUENCE IF NOT EXISTS user_metrics_id_seq;
```

## Step 1: Create Core Tables

### 1.1 Company Settings Table

```sql
-- Core configuration table
CREATE TABLE public.company_settings (
    id integer NOT NULL DEFAULT 1 PRIMARY KEY,
    company_name text NOT NULL DEFAULT 'Your Company',
    company_email text,
    primary_phone text NOT NULL DEFAULT '',
    secondary_phone text,
    address text NOT NULL DEFAULT '',
    contact_email text NOT NULL DEFAULT '',
    custom_domain text DEFAULT 'https://majqoqagohicjigmsilu.lovable.app',
    lms_url text DEFAULT 'https://growthos.core47.ai',
    company_logo text,
    branding jsonb DEFAULT '{}'::jsonb,
    currency text NOT NULL DEFAULT 'USD',
    original_fee_amount numeric NOT NULL DEFAULT 3000.00,
    maximum_installment_count integer NOT NULL DEFAULT 3,
    installment_plans text[],
    payment_methods jsonb DEFAULT '[]'::jsonb,
    invoice_send_gap_days integer NOT NULL DEFAULT 7,
    invoice_overdue_days integer NOT NULL DEFAULT 30,
    invoice_notes text,
    questionnaire jsonb DEFAULT '[]'::jsonb,
    lms_sequential_unlock boolean DEFAULT false,
    enable_student_signin boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Insert default company settings
INSERT INTO public.company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

### 1.2 Users Table

```sql
-- Main users table for authentication and roles
CREATE TABLE public.users (
    id uuid NOT NULL PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    role text NOT NULL,
    phone text,
    status text DEFAULT 'active',
    lms_status text DEFAULT 'inactive',
    password_display text,
    password_hash text,
    is_temp_password boolean DEFAULT false,
    last_active_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_role CHECK (role IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'suspended')),
    CONSTRAINT valid_lms_status CHECK (lms_status IN ('active', 'inactive'))
);

-- Create trigger for role validation
CREATE OR REPLACE FUNCTION public.validate_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.role NOT IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student') THEN
    RAISE EXCEPTION 'Invalid role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_user_role_trigger
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.validate_user_role();

-- Create trigger for password security validation
CREATE OR REPLACE FUNCTION public.validate_password_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Ensure password hash is properly formatted (basic validation)
  IF NEW.password_hash IS NOT NULL AND LENGTH(NEW.password_hash) < 50 THEN
    RAISE EXCEPTION 'Password hash appears to be insufficiently secure';
  END IF;
  
  -- Log password changes for security audit
  IF TG_OP = 'UPDATE' AND OLD.password_hash IS DISTINCT FROM NEW.password_hash THEN
    INSERT INTO public.admin_logs (
      entity_type,
      entity_id,
      action,
      description,
      performed_by,
      created_at
    ) VALUES (
      'user',
      NEW.id,
      'password_changed',
      'User password was changed',
      COALESCE(auth.uid(), NEW.id),
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER validate_password_security_trigger
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.validate_password_security();

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
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

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.3 Students Table

```sql
-- Student-specific information
CREATE TABLE public.students (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
    student_id text UNIQUE,
    lms_username text NOT NULL DEFAULT '',
    onboarding_completed boolean DEFAULT false,
    enrollment_date timestamp with time zone DEFAULT now(),
    fees_cleared boolean DEFAULT false,
    installment_count integer DEFAULT 1,
    installment_plan_id uuid,
    goal_brief text,
    answers_json jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Generate student ID function
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.student_id IS NULL THEN
    NEW.student_id := 'STU' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1
       FROM public.students 
       WHERE student_id IS NOT NULL)::TEXT, 
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER generate_student_id_trigger
    BEFORE INSERT ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.generate_student_id();

CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fees cleared trigger for unlocking first recording
CREATE OR REPLACE FUNCTION public.handle_fees_cleared()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only trigger when fees_cleared changes from false to true
  IF OLD.fees_cleared = false AND NEW.fees_cleared = true THEN
    PERFORM public.initialize_first_recording_unlock(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER handle_fees_cleared_trigger
    AFTER UPDATE ON public.students
    FOR EACH ROW EXECUTE FUNCTION public.handle_fees_cleared();
```

### 1.4 Modules and Lessons Tables

```sql
-- Modules for organizing content
CREATE TABLE public.modules (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    "order" integer
);

-- Available lessons/recordings
CREATE TABLE public.available_lessons (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_title text,
    description text,
    recording_url text,
    duration_min integer,
    sequence_order integer,
    module uuid REFERENCES public.modules(id),
    assignment_id uuid,
    last_assignment_completed uuid,
    notes text,
    uploaded_by uuid REFERENCES public.users(id),
    uploaded_at timestamp without time zone DEFAULT now()
);

-- Create notification trigger for recording changes
CREATE OR REPLACE FUNCTION public.handle_recording_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notify_all_students(
      'recording',
      'New Recording Available',
      'A new video lesson "' || NEW.recording_title || '" is now available.',
      jsonb_build_object('recording_id', NEW.id, 'action', 'added')
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.notify_all_students(
      'recording',
      'Recording Updated',
      'The video lesson "' || NEW.recording_title || '" has been updated.',
      jsonb_build_object('recording_id', NEW.id, 'action', 'updated')
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.notify_all_students(
      'recording',
      'Recording Removed',
      'The video lesson "' || OLD.recording_title || '" has been removed.',
      jsonb_build_object('recording_id', OLD.id, 'action', 'deleted')
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER handle_recording_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.available_lessons
    FOR EACH ROW EXECUTE FUNCTION public.handle_recording_changes();
```

### 1.5 Assignments and Submissions Tables

```sql
-- Assignments table
CREATE TABLE public.assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    instructions text,
    submission_type text DEFAULT 'text',
    due_days integer DEFAULT 7,
    mentor_id uuid REFERENCES public.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_submission_type CHECK (submission_type IN ('text', 'file', 'link', 'mixed'))
);

CREATE TRIGGER update_assignments_updated_at
    BEFORE UPDATE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Submissions table
CREATE TABLE public.submissions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content text,
    file_url text,
    file_urls jsonb,
    links jsonb,
    status text NOT NULL DEFAULT 'pending',
    version integer DEFAULT 1,
    notes text,
    submitted_at timestamp with time zone NOT NULL DEFAULT now(),
    reviewed_at timestamp with time zone,
    reviewed_by uuid REFERENCES public.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'revision_required'))
);

CREATE TRIGGER update_submissions_updated_at
    BEFORE UPDATE ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequential submission approval trigger
CREATE OR REPLACE FUNCTION public.handle_sequential_submission_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  current_recording_id uuid;
  current_sequence_order integer;
  next_recording_id uuid;
BEGIN
  -- Only process approved submissions (and ensure it's a status change to approved)
  IF NEW.status != 'approved' OR OLD.status = 'approved' THEN
    RETURN NEW;
  END IF;
  
  -- Find the recording that has this assignment
  SELECT al.id, COALESCE(al.sequence_order, 999) INTO current_recording_id, current_sequence_order
  FROM public.available_lessons al
  WHERE al.assignment_id = NEW.assignment_id;
  
  IF current_recording_id IS NOT NULL THEN
    -- Find next recording in sequence
    SELECT al.id INTO next_recording_id
    FROM public.available_lessons al
    WHERE COALESCE(al.sequence_order, 999) > current_sequence_order
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
    LIMIT 1;
    
    -- Unlock next recording if it exists
    IF next_recording_id IS NOT NULL THEN
      INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
      VALUES (NEW.student_id, next_recording_id, true, now())
      ON CONFLICT (user_id, recording_id) 
      DO UPDATE SET is_unlocked = true, unlocked_at = now();
    END IF;
  END IF;
  
  -- Send broadcast for real-time updates
  PERFORM pg_notify('submission_approved', json_build_object(
    'student_id', NEW.student_id,
    'assignment_id', NEW.assignment_id,
    'current_recording_id', current_recording_id,
    'next_recording_id', next_recording_id,
    'sequential_mode', true
  )::text);
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER handle_sequential_submission_approval_trigger
    AFTER UPDATE ON public.submissions
    FOR EACH ROW EXECUTE FUNCTION public.handle_sequential_submission_approval();
```

### 1.6 Recording Views and Unlocks Tables

```sql
-- Recording views tracking
CREATE TABLE public.recording_views (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    watched boolean NOT NULL DEFAULT false,
    watched_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, recording_id)
);

CREATE TRIGGER update_recording_views_updated_at
    BEFORE UPDATE ON public.recording_views
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recording watched trigger
CREATE OR REPLACE FUNCTION public.handle_recording_watched()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  -- Only process when watched status changes to true
  IF NEW.watched = true AND (OLD.watched IS NULL OR OLD.watched = false) THEN
    -- Trigger a sync of unlock status for this user to ensure proper sequential flow
    PERFORM public.sync_user_unlock_progress(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER handle_recording_watched_trigger
    AFTER UPDATE ON public.recording_views
    FOR EACH ROW EXECUTE FUNCTION public.handle_recording_watched();

-- User unlocks for sequential progression
CREATE TABLE public.user_unlocks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    is_unlocked boolean NOT NULL DEFAULT false,
    unlocked_at timestamp with time zone,
    
    UNIQUE(user_id, recording_id)
);
```

### 1.7 User Security Summary Tables

```sql
-- User security summary for monitoring and risk assessment
CREATE TABLE public.user_security_summary (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    security_score integer DEFAULT 100,
    last_login_at timestamp with time zone,
    failed_login_attempts integer DEFAULT 0,
    password_last_changed timestamp with time zone,
    suspicious_activity_count integer DEFAULT 0,
    risk_level text DEFAULT 'low',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    UNIQUE(user_id)
);

-- Backup table for user security summary
CREATE TABLE public.user_security_summary_backup (
    id uuid,
    user_id uuid,
    security_score integer,
    last_login_at timestamp with time zone,
    failed_login_attempts integer,
    password_last_changed timestamp with time zone,
    suspicious_activity_count integer,
    risk_level text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    backup_created_at timestamp with time zone DEFAULT now()
);

CREATE TRIGGER update_user_security_summary_updated_at
    BEFORE UPDATE ON public.user_security_summary
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

### 1.8 Financial Management Tables

```sql
-- Installment plans
CREATE TABLE public.installment_plans (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    num_installments integer NOT NULL,
    total_amount numeric NOT NULL,
    interval_days integer NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TRIGGER update_installment_plans_updated_at
    BEFORE UPDATE ON public.installment_plans
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoices
CREATE TABLE public.invoices (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    installment_number integer NOT NULL,
    amount numeric NOT NULL,
    due_date timestamp with time zone NOT NULL,
    status text DEFAULT 'pending',
    payment_method text,
    notes text,
    paid_at timestamp with time zone,
    first_reminder_sent boolean DEFAULT false,
    first_reminder_sent_at timestamp with time zone,
    second_reminder_sent boolean DEFAULT false,
    second_reminder_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_invoice_status CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'))
);

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Installment payments tracking
CREATE TABLE public.installment_payments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount numeric NOT NULL,
    payment_date timestamp with time zone NOT NULL DEFAULT now(),
    payment_method text,
    transaction_id text,
    status text NOT NULL DEFAULT 'paid',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_payment_status CHECK (status IN ('paid', 'pending', 'failed', 'refunded'))
);

CREATE TRIGGER update_installment_payments_updated_at
    BEFORE UPDATE ON public.installment_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.9 Segmented Success Sessions Tables

```sql
-- Segmented weekly success sessions view
CREATE TABLE public.segmented_weekly_success_sessions (
    id uuid NOT NULL,
    title text,
    description text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    mentor_id uuid,
    mentor_name text,
    status text,
    created_at timestamp without time zone,
    segment text DEFAULT 'weekly'
);

-- Backup table for segmented sessions
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
```

### 1.10 Onboarding Jobs Table

```sql
-- Background job processing for onboarding
CREATE TABLE public.onboarding_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    job_type text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    payload jsonb DEFAULT '{}',
    result jsonb,
    error_message text,
    retries integer DEFAULT 0,
    max_retries integer DEFAULT 3,
    scheduled_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_job_status CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled'))
);

CREATE TRIGGER update_onboarding_jobs_updated_at
    BEFORE UPDATE ON public.onboarding_jobs
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.11 Milestone System Tables

```sql
-- Milestone categories
CREATE TABLE public.milestone_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    icon text,
    color text DEFAULT '#3B82F6',
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TRIGGER update_milestone_categories_updated_at
    BEFORE UPDATE ON public.milestone_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Milestones
CREATE TABLE public.milestones (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id uuid REFERENCES public.milestone_categories(id),
    name text NOT NULL,
    description text NOT NULL,
    icon text DEFAULT '🏆',
    badge_url text,
    points integer DEFAULT 10,
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}',
    show_celebration boolean DEFAULT false,
    celebration_message text,
    celebration_config jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_trigger_type CHECK (trigger_type IN ('manual', 'auto_assignment', 'auto_recording', 'auto_module', 'auto_streak'))
);

CREATE TRIGGER update_milestones_updated_at
    BEFORE UPDATE ON public.milestones
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User milestones
CREATE TABLE public.user_milestones (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    milestone_id uuid NOT NULL REFERENCES public.milestones(id) ON DELETE CASCADE,
    completed_at timestamp with time zone NOT NULL DEFAULT now(),
    awarded_by uuid REFERENCES public.users(id),
    notes text,
    progress_data jsonb,
    
    UNIQUE(user_id, milestone_id)
);

-- User module progress tracking
CREATE TABLE public.user_module_progress (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    module_id uuid NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
    is_completed boolean DEFAULT false,
    progress_percentage integer DEFAULT 0,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id, module_id),
    CONSTRAINT valid_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

CREATE TRIGGER update_user_module_progress_updated_at
    BEFORE UPDATE ON public.user_module_progress
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.12 Communication and Support Tables

```sql
-- Notifications table
CREATE TABLE public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL,
    channel text NOT NULL DEFAULT 'system',
    status text NOT NULL DEFAULT 'sent',
    payload jsonb NOT NULL DEFAULT '{}',
    template_key text,
    payload_hash text,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_channel CHECK (channel IN ('system', 'email', 'sms', 'push', 'in_app')),
    CONSTRAINT valid_status CHECK (status IN ('sent', 'read', 'dismissed', 'failed'))
);

-- Notification templates
CREATE TABLE public.notification_templates (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    key text NOT NULL UNIQUE,
    title_md text NOT NULL,
    body_md text NOT NULL,
    variables text[] NOT NULL DEFAULT '{}',
    active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON public.notification_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notification settings
CREATE TABLE public.notification_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    mutes jsonb NOT NULL DEFAULT '{}',
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TRIGGER update_notification_settings_updated_at
    BEFORE UPDATE ON public.notification_settings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Support tickets
CREATE TABLE public.support_tickets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL,
    status text NOT NULL DEFAULT 'open',
    priority text NOT NULL DEFAULT 'medium',
    category text,
    assigned_to uuid REFERENCES public.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_ticket_status CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

CREATE TRIGGER update_support_tickets_updated_at
    BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Support ticket replies
CREATE TABLE public.support_ticket_replies (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message text NOT NULL,
    is_internal boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Messages table
CREATE TABLE public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'feedback',
    content text NOT NULL,
    status text NOT NULL DEFAULT 'queued',
    template_name text,
    context jsonb DEFAULT '{}',
    response_id text,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    replied_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_message_type CHECK (type IN ('feedback', 'support', 'notification', 'system')),
    CONSTRAINT valid_message_status CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'replied'))
);

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```


### 1.13 Admin Logs and Activity Tracking

```sql
-- Admin logs for audit trail
CREATE TABLE public.admin_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    description text,
    performed_by uuid,
    data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('user', 'student', 'assignment', 'submission', 'recording', 'invoice', 'notification_template', 'data_access', 'success_session'))
);

-- User activity logs
CREATE TABLE public.user_activity_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    reference_id uuid,
    metadata jsonb DEFAULT '{}',
    occurred_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
```


### 1.14 Additional Tables

```sql
-- Success sessions (live sessions)
CREATE TABLE public.success_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    link text NOT NULL,
    schedule_date text,
    mentor_id uuid REFERENCES public.users(id),
    mentor_name text,
    created_by uuid REFERENCES public.users(id),
    status text DEFAULT 'upcoming',
    zoom_meeting_id text,
    zoom_passcode text,
    host_login_email text,
    host_login_pwd text,
    created_at timestamp without time zone DEFAULT now(),
    
    CONSTRAINT valid_session_status CHECK (status IN ('upcoming', 'live', 'completed', 'cancelled'))
);

-- Recording ratings
CREATE TABLE public.recording_ratings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    rating integer NOT NULL,
    feedback text,
    lesson_title text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5),
    UNIQUE(student_id, recording_id)
);

CREATE TRIGGER update_recording_ratings_updated_at
    BEFORE UPDATE ON public.recording_ratings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recording attachments
CREATE TABLE public.recording_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Badges system
CREATE TABLE public.badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text
);

CREATE TABLE public.user_badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, badge_id)
);

-- Milestone system
CREATE TABLE public.milestone_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    icon text,
    color text DEFAULT '#3B82F6',
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TABLE public.milestones (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    category_id uuid REFERENCES public.milestone_categories(id),
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}',
    points integer DEFAULT 10,
    icon text DEFAULT '🏆',
    badge_url text,
    show_celebration boolean DEFAULT false,
    celebration_message text,
    celebration_config jsonb DEFAULT '{}',
    display_order integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

CREATE TRIGGER update_milestone_categories_updated_at
    BEFORE UPDATE ON public.milestone_categories
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at
    BEFORE UPDATE ON public.milestones
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Course tracks (for future multi-course support)
CREATE TABLE public.course_tracks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);

-- Messages (for communication features)
CREATE TABLE public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'feedback',
    template_name text,
    content text NOT NULL,
    context jsonb DEFAULT '{}',
    status text NOT NULL DEFAULT 'queued',
    response_id text,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    replied_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_message_type CHECK (type IN ('feedback', 'support', 'notification', 'reminder')),
    CONSTRAINT valid_message_status CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'replied'))
);

CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.10 Analytics and Tracking Tables

```sql
-- User activity logs
CREATE TABLE public.user_activity_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    reference_id uuid,
    metadata jsonb DEFAULT '{}',
    occurred_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Admin logs
CREATE TABLE public.admin_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    description text,
    performed_by uuid REFERENCES public.users(id),
    data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('user', 'student', 'assignment', 'submission', 'invoice', 'recording', 'module', 'notification_template', 'data_access')),
    CONSTRAINT valid_action CHECK (action IN ('created', 'updated', 'deleted', 'approved', 'rejected', 'sent', 'viewed', 'cascade_deleted', 'password_changed'))
);

-- Recording ratings
CREATE TABLE public.recording_ratings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating integer NOT NULL,
    feedback text,
    lesson_title text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    UNIQUE(recording_id, student_id),
    CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5)
);

CREATE TRIGGER update_recording_ratings_updated_at
    BEFORE UPDATE ON public.recording_ratings
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Recording attachments
CREATE TABLE public.recording_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User metrics
CREATE TABLE public.user_metrics (
    id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source text NOT NULL,
    metric text NOT NULL,
    value numeric,
    date date NOT NULL,
    fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Success sessions
CREATE TABLE public.success_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    schedule_date text,
    link text NOT NULL,
    status text DEFAULT 'upcoming',
    mentor_id uuid REFERENCES public.users(id),
    mentor_name text,
    created_by uuid REFERENCES public.users(id),
    zoom_meeting_id text,
    zoom_passcode text,
    host_login_email text,
    host_login_pwd text,
    created_at timestamp without time zone DEFAULT now(),
    
    CONSTRAINT valid_session_status CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled'))
);

-- Segmented weekly success sessions (read-only view)
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
    segment text DEFAULT 'weekly'
);

-- Success sessions backup table
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
```

### 1.11 Recovery and Engagement Tables

```sql
-- Student recovery messages
CREATE TABLE public.student_recovery_messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message_type text NOT NULL DEFAULT 'whatsapp_inactive',
    days_inactive integer NOT NULL,
    message_content text,
    message_sent_at timestamp with time zone NOT NULL DEFAULT now(),
    recovery_successful boolean,
    recovered_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_message_type CHECK (message_type IN ('whatsapp_inactive', 'email_reminder', 'sms_followup'))
);

CREATE TRIGGER update_student_recovery_messages_updated_at
    BEFORE UPDATE ON public.student_recovery_messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Success partner credits
CREATE TABLE public.success_partner_credits (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    credits_used integer NOT NULL DEFAULT 0,
    daily_limit integer NOT NULL DEFAULT 10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    UNIQUE(user_id, date)
);

CREATE TRIGGER update_success_partner_credits_updated_at
    BEFORE UPDATE ON public.success_partner_credits
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Email queue
CREATE TABLE public.email_queue (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_email text NOT NULL,
    recipient_name text NOT NULL,
    email_type text NOT NULL,
    credentials jsonb NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    retry_count integer DEFAULT 0,
    error_message text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    
    CONSTRAINT valid_email_status CHECK (status IN ('pending', 'sent', 'failed', 'delivered'))
);

CREATE TRIGGER update_email_queue_updated_at
    BEFORE UPDATE ON public.email_queue
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

### 1.12 Additional System Tables

```sql
-- Badges system
CREATE TABLE public.badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text
);

-- User badges
CREATE TABLE public.user_badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    
    UNIQUE(user_id, badge_id)
);

-- Course tracks
CREATE TABLE public.course_tracks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);

-- Integrations
CREATE TABLE public.integrations (
    id bigint NOT NULL DEFAULT nextval('integrations_id_seq') PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source text NOT NULL,
    external_id text,
    access_token text NOT NULL,
    refresh_token text,
    connected_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TRIGGER update_integrations_updated_at
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Onboarding responses
CREATE TABLE public.onboarding_responses (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id text NOT NULL,
    answer text,
    answer_type text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    
    CONSTRAINT valid_answer_type CHECK (answer_type IN ('text', 'json', 'file'))
);

CREATE TRIGGER update_onboarding_responses_updated_at
    BEFORE UPDATE ON public.onboarding_responses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## Step 2: Create Essential Database Functions

### 2.1 User Management Functions

```sql
-- Get current user role function (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Get user LMS status
CREATE OR REPLACE FUNCTION public.get_user_lms_status(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(lms_status, 'inactive') FROM public.users WHERE id = user_id;
$function$;

-- Create user with role function
CREATE OR REPLACE FUNCTION public.create_user_with_role(target_email text, target_password text, target_role text, target_full_name text DEFAULT NULL::text, target_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Create student complete function
CREATE OR REPLACE FUNCTION public.create_student_complete(p_email text, p_password text, p_full_name text, p_phone text DEFAULT NULL::text, p_address text DEFAULT NULL::text, p_mentor_id uuid DEFAULT NULL::uuid, p_batch_id uuid DEFAULT NULL::uuid, p_pod_id uuid DEFAULT NULL::uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

## Step 2: Create Core Functions

### 2.1 User Management Functions

```sql
-- Get current user role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

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

-- Get users by role
CREATE OR REPLACE FUNCTION public.get_users_by_role(role_code text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  select id::uuid
  from public.users
  where role = role_code
$function$;

-- Get user LMS status
CREATE OR REPLACE FUNCTION public.get_user_lms_status(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(lms_status, 'inactive') FROM public.users WHERE id = user_id;
$function$;
```

### 2.2 Sequential Unlock Functions

```sql
-- Initialize student unlocks
CREATE OR REPLACE FUNCTION public.initialize_student_unlocks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  first_recording_id uuid;
BEGIN
  -- Get the first recording in sequence
  SELECT id INTO first_recording_id
  FROM public.available_lessons
  WHERE sequence_order IS NOT NULL
  ORDER BY sequence_order ASC
  LIMIT 1;
  
  -- If no recordings with sequence order, get the first one by title
  IF first_recording_id IS NULL THEN
    SELECT id INTO first_recording_id
    FROM public.available_lessons
    ORDER BY recording_title ASC
    LIMIT 1;
  END IF;
  
  -- Unlock the first recording for this student
  IF first_recording_id IS NOT NULL THEN
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, first_recording_id, true, now())
    ON CONFLICT (user_id, recording_id) 
    DO UPDATE SET is_unlocked = true, unlocked_at = now();
  END IF;
END;
$function$;
```

### 2.2 Sequential Unlock Functions

```sql
-- Initialize student unlocks
CREATE OR REPLACE FUNCTION public.initialize_student_unlocks(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  first_recording_id uuid;
BEGIN
  -- Get the first recording in sequence
  SELECT id INTO first_recording_id
  FROM public.available_lessons
  WHERE sequence_order IS NOT NULL
  ORDER BY sequence_order ASC
  LIMIT 1;
  
  -- If no recordings with sequence order, get the first one by title
  IF first_recording_id IS NULL THEN
    SELECT id INTO first_recording_id
    FROM public.available_lessons
    ORDER BY recording_title ASC
    LIMIT 1;
  END IF;
  
  -- Unlock the first recording for this student
  IF first_recording_id IS NOT NULL THEN
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, first_recording_id, true, now())
    ON CONFLICT (user_id, recording_id) 
    DO UPDATE SET is_unlocked = true, unlocked_at = now();
  END IF;
END;
$function$;

-- Initialize first recording unlock based on fees
CREATE OR REPLACE FUNCTION public.initialize_first_recording_unlock(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  first_recording_id uuid;
  fees_cleared boolean := false;
BEGIN
  -- Check if fees are cleared
  SELECT COALESCE(s.fees_cleared, false) INTO fees_cleared
  FROM public.students s WHERE s.user_id = p_user_id;
  
  -- Only proceed if fees are cleared
  IF NOT fees_cleared THEN
    RETURN;
  END IF;
  
  -- Get the first recording in sequence
  SELECT id INTO first_recording_id
  FROM public.available_lessons
  WHERE sequence_order IS NOT NULL
  ORDER BY sequence_order ASC
  LIMIT 1;
  
  -- If no recordings with sequence order, get the first one by title
  IF first_recording_id IS NULL THEN
    SELECT id INTO first_recording_id
    FROM public.available_lessons
    ORDER BY recording_title ASC
    LIMIT 1;
  END IF;
  
  -- Unlock the first recording for this student
  IF first_recording_id IS NOT NULL THEN
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, first_recording_id, true, now())
    ON CONFLICT (user_id, recording_id) 
    DO UPDATE SET is_unlocked = true, unlocked_at = now();
  END IF;
END;
$function$;

-- Unlock next recording function
CREATE OR REPLACE FUNCTION public.unlock_next_recording(p_user_id uuid, p_current_recording_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  curr_order integer;
  curr_title text;
  next_rec_id uuid;
BEGIN
  -- Get current recording order and title
  SELECT COALESCE(sequence_order, 999), COALESCE(recording_title, '')
  INTO curr_order, curr_title
  FROM public.available_lessons
  WHERE id = p_current_recording_id;

  IF curr_order IS NULL THEN
    RETURN;
  END IF;

  -- Find the next recording in the global sequence
  SELECT al.id INTO next_rec_id
  FROM public.available_lessons al
  WHERE 
    COALESCE(al.sequence_order, 999) > curr_order
    OR (
      COALESCE(al.sequence_order, 999) = curr_order 
      AND COALESCE(al.recording_title, '') > curr_title
    )
  ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LIMIT 1;

  -- If no next recording, nothing to unlock
  IF next_rec_id IS NULL THEN
    RETURN;
  END IF;

  -- Upsert-like behavior without requiring unique constraint
  IF EXISTS (
    SELECT 1 FROM public.user_unlocks 
    WHERE user_id = p_user_id AND recording_id = next_rec_id
  ) THEN
    UPDATE public.user_unlocks
    SET is_unlocked = true, unlocked_at = now()
    WHERE user_id = p_user_id AND recording_id = next_rec_id;
  ELSE
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, next_rec_id, true, now());
  END IF;
END;
$function$;

-- Get sequential unlock status
CREATE OR REPLACE FUNCTION public.get_sequential_unlock_status(p_user_id uuid)
RETURNS TABLE(recording_id uuid, sequence_order integer, is_unlocked boolean, unlock_reason text, assignment_required boolean, assignment_completed boolean, recording_watched boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  fees_cleared boolean := false;
  current_sequence integer := 1;
  prev_assignment_completed boolean := true;
  prev_recording_watched boolean := true;
BEGIN
  -- Check if fees are cleared for this student (required for first recording unlock)
  SELECT COALESCE(s.fees_cleared, false) INTO fees_cleared
  FROM public.students s WHERE s.user_id = p_user_id;
  
  -- Loop through recordings in sequence order
  FOR recording_id, sequence_order IN 
    SELECT al.id, COALESCE(al.sequence_order, 999)
    FROM public.available_lessons al
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LOOP
    DECLARE
      has_assignment boolean := false;
      assignment_completed boolean := false;
      is_watched boolean := false;
      should_unlock boolean := false;
      reason text := '';
    BEGIN
      -- Check if recording has been watched
      SELECT EXISTS(
        SELECT 1 FROM public.recording_views rv 
        WHERE rv.user_id = p_user_id AND rv.recording_id = get_sequential_unlock_status.recording_id AND rv.watched = true
      ) INTO is_watched;
      
      -- Check if this recording has an assignment
      SELECT EXISTS(
        SELECT 1 FROM public.available_lessons al 
        WHERE al.id = get_sequential_unlock_status.recording_id AND al.assignment_id IS NOT NULL
      ) INTO has_assignment;
      
      -- Check if assignment is completed (latest submission approved)
      IF has_assignment THEN
        SELECT EXISTS(
          SELECT 1 
          FROM public.available_lessons al
          JOIN public.submissions s ON s.assignment_id = al.assignment_id
          WHERE al.id = get_sequential_unlock_status.recording_id
          AND s.student_id = p_user_id
          AND s.status = 'approved'
          AND s.version = (
            SELECT MAX(version) 
            FROM public.submissions s2 
            WHERE s2.assignment_id = al.assignment_id AND s2.student_id = p_user_id
          )
        ) INTO assignment_completed;
      ELSE
        assignment_completed := true; -- No assignment means it's considered complete
      END IF;
      
      -- Determine unlock status (SEQUENTIAL LOGIC WITH ASSIGNMENT BLOCKING)
      IF current_sequence = 1 THEN
        -- First recording: only unlock if fees are cleared
        IF fees_cleared THEN
          should_unlock := true;
          reason := 'First recording - unlocked after fees cleared';
        ELSE
          should_unlock := false;
          reason := 'Payment required to unlock first recording';
        END IF;
      ELSIF prev_assignment_completed AND prev_recording_watched THEN
        -- Previous recording was watched AND its assignment was completed
        should_unlock := true;
        reason := 'Previous recording watched and assignment completed - unlocked';
      ELSE
        should_unlock := false;
        IF NOT prev_recording_watched THEN
          reason := 'Previous recording not watched - locked';
        ELSIF NOT prev_assignment_completed THEN
          reason := 'Previous assignment not approved - locked';
        ELSE
          reason := 'Previous requirements not met - locked';
        END IF;
      END IF;
      
      -- Return row
      RETURN QUERY SELECT 
        get_sequential_unlock_status.recording_id,
        get_sequential_unlock_status.sequence_order,
        should_unlock,
        reason,
        has_assignment,
        assignment_completed,
        is_watched;
      
      -- Update state for next iteration (current recording becomes previous)
      prev_assignment_completed := assignment_completed;
      prev_recording_watched := is_watched;
      current_sequence := current_sequence + 1;
    END;
  END LOOP;
END;
$function$;

-- Sync user unlock progress
CREATE OR REPLACE FUNCTION public.sync_user_unlock_progress(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recording_record RECORD;
  should_unlock BOOLEAN;
  unlock_msg TEXT;
BEGIN
  -- Clear existing unlock records for this user
  DELETE FROM user_unlocks WHERE user_id = p_user_id;
  
  -- Loop through all recordings and apply sequential unlock logic
  FOR recording_record IN 
    SELECT * FROM get_sequential_unlock_status(p_user_id)
  LOOP
    IF recording_record.is_unlocked THEN
      INSERT INTO user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
      VALUES (p_user_id, recording_record.recording_id, true, now())
      ON CONFLICT (user_id, recording_id) 
      DO UPDATE SET is_unlocked = true, unlocked_at = now();
    END IF;
  END LOOP;
END;
$function$;

-- Initialize first recording unlock (only if fees cleared)
CREATE OR REPLACE FUNCTION public.initialize_first_recording_unlock(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  first_recording_id uuid;
  fees_cleared boolean := false;
BEGIN
  -- Check if fees are cleared
  SELECT COALESCE(s.fees_cleared, false) INTO fees_cleared
  FROM public.students s WHERE s.user_id = p_user_id;
  
  -- Only proceed if fees are cleared
  IF NOT fees_cleared THEN
    RETURN;
  END IF;
  
  -- Get the first recording in sequence
  SELECT id INTO first_recording_id
  FROM public.available_lessons
  WHERE sequence_order IS NOT NULL
  ORDER BY sequence_order ASC
  LIMIT 1;
  
  -- If no recordings with sequence order, get the first one by title
  IF first_recording_id IS NULL THEN
    SELECT id INTO first_recording_id
    FROM public.available_lessons
    ORDER BY recording_title ASC
    LIMIT 1;
  END IF;
  
  -- Unlock the first recording for this student
  IF first_recording_id IS NOT NULL THEN
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, first_recording_id, true, now())
    ON CONFLICT (user_id, recording_id) 
    DO UPDATE SET is_unlocked = true, unlocked_at = now();
  END IF;
END;
$function$;

-- Unlock next recording in sequence
CREATE OR REPLACE FUNCTION public.unlock_next_recording(p_user_id uuid, p_current_recording_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  curr_order integer;
  curr_title text;
  next_rec_id uuid;
BEGIN
  -- Get current recording order and title
  SELECT COALESCE(sequence_order, 999), COALESCE(recording_title, '')
  INTO curr_order, curr_title
  FROM public.available_lessons
  WHERE id = p_current_recording_id;

  IF curr_order IS NULL THEN
    RETURN;
  END IF;

  -- Find the next recording in the global sequence
  SELECT al.id INTO next_rec_id
  FROM public.available_lessons al
  WHERE 
    COALESCE(al.sequence_order, 999) > curr_order
    OR (
      COALESCE(al.sequence_order, 999) = curr_order 
      AND COALESCE(al.recording_title, '') > curr_title
    )
  ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LIMIT 1;

  -- If no next recording, nothing to unlock
  IF next_rec_id IS NULL THEN
    RETURN;
  END IF;

  -- Upsert-like behavior without requiring unique constraint
  IF EXISTS (
    SELECT 1 FROM public.user_unlocks 
    WHERE user_id = p_user_id AND recording_id = next_rec_id
  ) THEN
    UPDATE public.user_unlocks
    SET is_unlocked = true, unlocked_at = now()
    WHERE user_id = p_user_id AND recording_id = next_rec_id;
  ELSE
    INSERT INTO public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
    VALUES (p_user_id, next_rec_id, true, now());
  END IF;
END;
$function$;

-- Get sequential unlock status
CREATE OR REPLACE FUNCTION public.get_sequential_unlock_status(p_user_id uuid)
RETURNS TABLE(recording_id uuid, sequence_order integer, is_unlocked boolean, unlock_reason text, assignment_required boolean, assignment_completed boolean, recording_watched boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  fees_cleared boolean := false;
  current_sequence integer := 1;
  prev_assignment_completed boolean := true;
  prev_recording_watched boolean := true;
BEGIN
  -- Check if fees are cleared for this student (required for first recording unlock)
  SELECT COALESCE(s.fees_cleared, false) INTO fees_cleared
  FROM public.students s WHERE s.user_id = p_user_id;
  
  -- Loop through recordings in sequence order
  FOR recording_id, sequence_order IN 
    SELECT al.id, COALESCE(al.sequence_order, 999)
    FROM public.available_lessons al
    ORDER BY COALESCE(al.sequence_order, 999), al.recording_title
  LOOP
    DECLARE
      has_assignment boolean := false;
      assignment_completed boolean := false;
      is_watched boolean := false;
      should_unlock boolean := false;
      reason text := '';
    BEGIN
      -- Check if recording has been watched
      SELECT EXISTS(
        SELECT 1 FROM public.recording_views rv 
        WHERE rv.user_id = p_user_id AND rv.recording_id = get_sequential_unlock_status.recording_id AND rv.watched = true
      ) INTO is_watched;
      
      -- Check if this recording has an assignment
      SELECT EXISTS(
        SELECT 1 FROM public.available_lessons al 
        WHERE al.id = get_sequential_unlock_status.recording_id AND al.assignment_id IS NOT NULL
      ) INTO has_assignment;
      
      -- Check if assignment is completed (latest submission approved)
      IF has_assignment THEN
        SELECT EXISTS(
          SELECT 1 
          FROM public.available_lessons al
          JOIN public.submissions s ON s.assignment_id = al.assignment_id
          WHERE al.id = get_sequential_unlock_status.recording_id
          AND s.student_id = p_user_id
          AND s.status = 'approved'
          AND s.version = (
            SELECT MAX(version) 
            FROM public.submissions s2 
            WHERE s2.assignment_id = al.assignment_id AND s2.student_id = p_user_id
          )
        ) INTO assignment_completed;
      ELSE
        assignment_completed := true; -- No assignment means it's considered complete
      END IF;
      
      -- Determine unlock status (SEQUENTIAL LOGIC WITH ASSIGNMENT BLOCKING)
      IF current_sequence = 1 THEN
        -- First recording: only unlock if fees are cleared
        IF fees_cleared THEN
          should_unlock := true;
          reason := 'First recording - unlocked after fees cleared';
        ELSE
          should_unlock := false;
          reason := 'Payment required to unlock first recording';
        END IF;
      ELSIF prev_assignment_completed AND prev_recording_watched THEN
        -- Previous recording was watched AND its assignment was completed
        should_unlock := true;
        reason := 'Previous recording watched and assignment completed - unlocked';
      ELSE
        should_unlock := false;
        IF NOT prev_recording_watched THEN
          reason := 'Previous recording not watched - locked';
        ELSIF NOT prev_assignment_completed THEN
          reason := 'Previous assignment not approved - locked';
        ELSE
          reason := 'Previous requirements not met - locked';
        END IF;
      END IF;
      
      -- Return row
      RETURN QUERY SELECT 
        get_sequential_unlock_status.recording_id,
        get_sequential_unlock_status.sequence_order,
        should_unlock,
        reason,
        has_assignment,
        assignment_completed,
        is_watched;
      
      -- Update state for next iteration (current recording becomes previous)
      prev_assignment_completed := assignment_completed;
      prev_recording_watched := is_watched;
      current_sequence := current_sequence + 1;
    END;
  END LOOP;
END;
$function$;
```

### 2.3 Progress Tracking Functions

```sql
-- Check if recording is watched
CREATE OR REPLACE FUNCTION public.is_recording_watched(_user_id uuid, _recording_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT watched FROM public.recording_views 
     WHERE user_id = _user_id AND recording_id = _recording_id
     LIMIT 1),
    false
  );
$function$;

-- Check if assignment is passed
CREATE OR REPLACE FUNCTION public.is_assignment_passed(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(
    (SELECT status = 'approved' FROM public.submissions 
     WHERE student_id = _user_id AND assignment_id = _assignment_id
     LIMIT 1),
    false
  );
$function$;

-- Check if all modules are completed
CREATE OR REPLACE FUNCTION public.has_completed_all_modules(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  incomplete_count int;
BEGIN
  -- If there are no lessons, do not allow completion
  IF (SELECT COUNT(*) FROM public.available_lessons) = 0 THEN
    RETURN false;
  END IF;

  -- All recordings must be watched
  SELECT COUNT(*) INTO incomplete_count
  FROM public.available_lessons al
  WHERE NOT public.is_recording_watched(_user_id, al.id);

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  -- All linked assignments must be approved
  SELECT COUNT(*) INTO incomplete_count
  FROM public.assignments a
  WHERE a.recording_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.assignment_id = a.id
        AND s.student_id = _user_id
        AND s.status = 'approved'
    );

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;
```

### 2.3 Progress Tracking Functions

```sql
-- Check if recording is watched
CREATE OR REPLACE FUNCTION public.is_recording_watched(_user_id uuid, _recording_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT watched FROM public.recording_views 
     WHERE user_id = _user_id AND recording_id = _recording_id
     LIMIT 1),
    false
  );
$function$;

-- Check if assignment is passed
CREATE OR REPLACE FUNCTION public.is_assignment_passed(_user_id uuid, _assignment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT COALESCE(
    (SELECT status = 'approved' FROM public.submissions 
     WHERE student_id = _user_id AND assignment_id = _assignment_id
     LIMIT 1),
    false
  );
$function$;

-- Check if all modules completed
CREATE OR REPLACE FUNCTION public.has_completed_all_modules(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  incomplete_count int;
BEGIN
  -- If there are no lessons, do not allow completion
  IF (SELECT COUNT(*) FROM public.available_lessons) = 0 THEN
    RETURN false;
  END IF;

  -- All recordings must be watched
  SELECT COUNT(*) INTO incomplete_count
  FROM public.available_lessons al
  WHERE NOT public.is_recording_watched(_user_id, al.id);

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  -- All linked assignments must be approved
  SELECT COUNT(*) INTO incomplete_count
  FROM public.assignments a
  WHERE a.recording_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.submissions s
      WHERE s.assignment_id = a.id
        AND s.student_id = _user_id
        AND s.status = 'approved'
    );

  IF incomplete_count > 0 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$function$;
```

### 2.4 Notification Functions

```sql
-- Create notification function
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    channel,
    status,
    sent_at,
    payload
  ) VALUES (
    p_user_id,
    p_type,
    'system',
    'sent',
    NOW(),
    jsonb_build_object(
      'title', p_title,
      'message', p_message,
      'metadata', p_metadata
    )
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$;

-- Interpolate template function
CREATE OR REPLACE FUNCTION public.interpolate_template(t text, vars jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  k text;
  v text;
  out text := coalesce(t,'');
begin
  if vars is null then
    return out;
  end if;

  for k in select jsonb_object_keys(vars)
  loop
    v := coalesce(vars->>k, '');
    -- Sanitize output to prevent injection
    v := replace(v, '<', '&lt;');
    v := replace(v, '>', '&gt;');
    v := replace(v, '"', '&quot;');
    out := replace(out, '{'||k||'}', v);
  end loop;

  return out;
end;
$function$;

-- Get users by role function
CREATE OR REPLACE FUNCTION public.get_users_by_role(role_code text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select id::uuid
  from public.users
  where role = role_code
$function$;

-- Notify users function
CREATE OR REPLACE FUNCTION public.notify_users(user_ids uuid[], template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  -- Parameter aliases to avoid ambiguity with column names
  v_user_ids alias for $1;
  v_template_key alias for $2;
  v_payload alias for $3;

  tpl record;
  uid uuid;
  inserted_ids uuid[] := '{}';
  now_ts timestamptz := now();
  p_hash text := md5(coalesce(v_payload::text,''));
  muted boolean;
  rendered_title text;
  rendered_body text;
  existing_id uuid;
begin
  -- Fetch active template
  select * into tpl
  from public.notification_templates
  where key = v_template_key and active = true
  limit 1;

  if tpl is null then
    -- No active template; nothing to do
    return inserted_ids;
  end if;

  -- Render strings using simple interpolation
  rendered_title := public.interpolate_template(tpl.title_md, v_payload);
  rendered_body  := public.interpolate_template(tpl.body_md,  v_payload);

  -- Loop over user ids
  foreach uid in array v_user_ids
  loop
    -- Check mutes
    select coalesce((ns.mutes ->> v_template_key)::boolean, false)
      into muted
      from public.notification_settings ns
      where ns.user_id = uid;

    if muted then
      continue;
    end if;

    -- Idempotency: skip if an identical payload for same template was created within last 1s
    select n.id into existing_id
    from public.notifications n
    where n.user_id = uid
      and coalesce(n.template_key, '') = coalesce(v_template_key,'')
      and coalesce(n.payload_hash, '') = coalesce(p_hash,'')
      and n.created_at > (now_ts - interval '1 second')
    limit 1;

    if existing_id is not null then
      continue;
    end if;

    -- Insert
    insert into public.notifications
      (user_id, type, channel, status, sent_at, payload, template_key, payload_hash)
    values
      (uid, v_template_key, 'in_app', 'sent', now_ts,
       jsonb_build_object(
         'title', rendered_title,
         'message', rendered_body,
         'template_key', v_template_key,
         'data', v_payload
       ),
       v_template_key,
       p_hash
      )
    returning id into existing_id;

    inserted_ids := inserted_ids || existing_id;
  end loop;

  return inserted_ids;
end;
$function$;

-- Notify roles function
CREATE OR REPLACE FUNCTION public.notify_roles(role_codes text[], template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  uids uuid[];
  out_ids uuid[] := '{}';
  role text;
  tmp_ids uuid[];
begin
  uids := '{}';
  foreach role in array role_codes
  loop
    uids := uids || array(select public.get_users_by_role(role));
  end loop;

  if array_length(uids, 1) is null then
    return out_ids;
  end if;

  tmp_ids := public.notify_users(uids, template_key, payload);
  out_ids := out_ids || tmp_ids;
  return out_ids;
end;
$function$;

-- Mark all notifications read
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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
SET search_path TO ''
AS $function$
  select public.notify_users(array[auth.uid()], template_key, payload)
$function$;
```

### 2.4 Notification Functions

```sql
-- Template interpolation function
CREATE OR REPLACE FUNCTION public.interpolate_template(t text, vars jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  k text;
  v text;
  out text := coalesce(t,'');
begin
  if vars is null then
    return out;
  end if;

  for k in select jsonb_object_keys(vars)
  loop
    v := coalesce(vars->>k, '');
    -- Sanitize output to prevent injection
    v := replace(v, '<', '&lt;');
    v := replace(v, '>', '&gt;');
    v := replace(v, '"', '&quot;');
    out := replace(out, '{'||k||'}', v);
  end loop;

  return out;
end;
$function$;

-- Notify users function
CREATE OR REPLACE FUNCTION public.notify_users(user_ids uuid[], template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  -- Parameter aliases to avoid ambiguity with column names
  v_user_ids alias for $1;
  v_template_key alias for $2;
  v_payload alias for $3;

  tpl record;
  uid uuid;
  inserted_ids uuid[] := '{}';
  now_ts timestamptz := now();
  p_hash text := md5(coalesce(v_payload::text,''));
  muted boolean;
  rendered_title text;
  rendered_body text;
  existing_id uuid;
begin
  -- Fetch active template
  select * into tpl
  from public.notification_templates
  where key = v_template_key and active = true
  limit 1;

  if tpl is null then
    -- No active template; nothing to do
    return inserted_ids;
  end if;

  -- Render strings using simple interpolation
  rendered_title := public.interpolate_template(tpl.title_md, v_payload);
  rendered_body  := public.interpolate_template(tpl.body_md,  v_payload);

  -- Loop over user ids
  foreach uid in array v_user_ids
  loop
    -- Check mutes
    select coalesce((ns.mutes ->> v_template_key)::boolean, false)
      into muted
      from public.notification_settings ns
      where ns.user_id = uid;

    if muted then
      continue;
    end if;

    -- Idempotency: skip if an identical payload for same template was created within last 1s
    select n.id into existing_id
    from public.notifications n
    where n.user_id = uid
      and coalesce(n.template_key, '') = coalesce(v_template_key,'')
      and coalesce(n.payload_hash, '') = coalesce(p_hash,'')
      and n.created_at > (now_ts - interval '1 second')
    limit 1;

    if existing_id is not null then
      continue;
    end if;

    -- Insert
    insert into public.notifications
      (user_id, type, channel, status, sent_at, payload, template_key, payload_hash)
    values
      (uid, v_template_key, 'in_app', 'sent', now_ts,
       jsonb_build_object(
         'title', rendered_title,
         'message', rendered_body,
         'template_key', v_template_key,
         'data', v_payload
       ),
       v_template_key,
       p_hash
      )
    returning id into existing_id;

    inserted_ids := inserted_ids || existing_id;
  end loop;

  return inserted_ids;
end;
$function$;
```

### 2.5 Recovery and Analytics Functions

```sql
-- Get inactive students
CREATE OR REPLACE FUNCTION public.get_inactive_students(days_threshold integer DEFAULT 3)
RETURNS TABLE(user_id uuid, email text, full_name text, last_active_at timestamp with time zone, days_inactive integer, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Log data access attempt
CREATE OR REPLACE FUNCTION public.log_data_access_attempt(table_name text, operation text, user_role text, target_user_id uuid DEFAULT NULL::uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Update company branding
CREATE OR REPLACE FUNCTION public.update_company_branding(branding_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Validate questionnaire structure
CREATE OR REPLACE FUNCTION public.validate_questionnaire_structure(questionnaire_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
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

-- Notify roles function
CREATE OR REPLACE FUNCTION public.notify_roles(role_codes text[], template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  uids uuid[];
  out_ids uuid[] := '{}';
  role text;
  tmp_ids uuid[];
begin
  uids := '{}';
  foreach role in array role_codes
  loop
    uids := uids || array(select public.get_users_by_role(role));
  end loop;

  if array_length(uids, 1) is null then
    return out_ids;
  end if;

  tmp_ids := public.notify_users(uids, template_key, payload);
  out_ids := out_ids || tmp_ids;
  return out_ids;
end;
$function$;

-- Create notification function
CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    channel,
    status,
    sent_at,
    payload
  ) VALUES (
    p_user_id,
    p_type,
    'system',
    'sent',
    NOW(),
    jsonb_build_object(
      'title', p_title,
      'message', p_message,
      'metadata', p_metadata
    )
  ) RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$function$;

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
```

### 2.5 Student Creation Function

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

### 2.6 Utility Functions

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

-- Get inactive students
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

## Step 3: Create Triggers and Automation

### 3.1 User Deletion Triggers

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

-- Create auth deletion trigger
CREATE TRIGGER handle_auth_user_deleted_trigger
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();

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

CREATE TRIGGER handle_user_cascade_deletion_trigger
    BEFORE DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_user_cascade_deletion();
```

### 3.2 Notification Triggers

```sql
-- Notify on learning item changes
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

-- Apply to relevant tables
CREATE TRIGGER notify_on_learning_item_changed_trigger_lessons
    AFTER INSERT OR UPDATE OR DELETE ON public.available_lessons
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_learning_item_changed();

CREATE TRIGGER notify_on_learning_item_changed_trigger_assignments
    AFTER INSERT OR UPDATE OR DELETE ON public.assignments
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_learning_item_changed();

CREATE TRIGGER notify_on_learning_item_changed_trigger_sessions
    AFTER INSERT OR UPDATE OR DELETE ON public.success_sessions
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_learning_item_changed();

-- Notify on invoice issued
CREATE OR REPLACE FUNCTION public.notify_on_invoice_issued()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  student_user_id uuid;
  student_name text;
  payload jsonb;
begin
  -- Only when newly issued or status changed to issued
  if not (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from new.status)) then
    return coalesce(new, old);
  end if;

  if new.status <> 'issued' then
    return new;
  end if;

  select s.user_id, u.full_name
    into student_user_id, student_name
  from public.students s
  join public.users u on u.id = s.user_id
  where s.id = new.student_id
  limit 1;

  payload := jsonb_build_object(
    'invoice_number', coalesce(new.installment_number::text, new.id::text),
    'student_name', coalesce(student_name, 'Student'),
    'amount', coalesce(new.amount::text,''),
    'due_date', coalesce(new.due_date::text,''),
    'invoice_id', new.id,
    'student_user_id', student_user_id
  );

  perform public.notify_roles(array['admin','superadmin'], 'invoice_issued', payload);
  if student_user_id is not null then
    perform public.notify_users(array[student_user_id], 'invoice_issued', payload);
  end if;

  return new;
end;
$function$;

CREATE TRIGGER notify_on_invoice_issued_trigger
    AFTER INSERT OR UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_invoice_issued();

-- Notify on ticket updates
CREATE OR REPLACE FUNCTION public.notify_on_ticket_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  ticket_number text;
  status text;
  action_summary text;
  student_user_id uuid;
  payload jsonb;
begin
  ticket_number := (coalesce(new.id::text, old.id::text));
  status := coalesce(new.status, old.status);
  action_summary := case 
    when tg_op = 'INSERT' then 'created'
    when tg_op = 'UPDATE' then 'updated'
    else 'updated'
  end;

  student_user_id := coalesce(new.user_id, old.user_id);

  payload := jsonb_build_object(
    'ticket_number', ticket_number,
    'status', coalesce(status,''),
    'action_summary', action_summary,
    'ticket_id', coalesce(new.id, old.id),
    'student_user_id', student_user_id
  );

  perform public.notify_roles(array['admin','superadmin'], 'ticket_updated', payload);
  if student_user_id is not null then
    perform public.notify_users(array[student_user_id], 'ticket_updated', payload);
  end if;

  return coalesce(new, old);
end;
$function$;

CREATE TRIGGER notify_on_ticket_update_trigger
    AFTER INSERT OR UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_ticket_update();

-- Notify on ticket reply
CREATE OR REPLACE FUNCTION public.notify_on_ticket_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  ticket_owner uuid;
  payload jsonb;
begin
  select user_id into ticket_owner 
  from public.support_tickets 
  where id = new.ticket_id;

  payload := jsonb_build_object(
    'ticket_number', coalesce(new.ticket_id::text,''),
    'status', 'replied',
    'action_summary', 'new reply',
    'ticket_id', new.ticket_id,
    'student_user_id', ticket_owner
  );

  perform public.notify_roles(array['admin','superadmin'], 'ticket_updated', payload);
  if ticket_owner is not null then
    perform public.notify_users(array[ticket_owner], 'ticket_updated', payload);
  end if;

  return new;
end;
$function$;

CREATE TRIGGER notify_on_ticket_reply_trigger
    AFTER INSERT ON public.support_ticket_replies
    FOR EACH ROW EXECUTE FUNCTION public.notify_on_ticket_reply();
```

### 3.3 Audit Triggers

```sql
-- Audit user changes
CREATE OR REPLACE FUNCTION public.audit_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_entity uuid;
  v_desc text;
  v_data jsonb;
BEGIN
  -- Determine action and entity
  IF TG_OP = 'DELETE' THEN
    v_action := 'deleted';
    v_entity := OLD.id;
    v_desc := 'User row deleted';
    v_data := to_jsonb(OLD);
  ELSIF TG_OP = 'INSERT' THEN
    v_action := 'created';
    v_entity := NEW.id;
    v_desc := 'User row created';
    v_data := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'updated';
    v_entity := NEW.id;
    v_desc := 'User row updated';
    v_data := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
  END IF;

  BEGIN
    INSERT INTO public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
    VALUES ('user', v_entity, v_action, v_desc, v_actor, now(), v_data);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'audit_user log failed: %', SQLERRM;
  END;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

CREATE TRIGGER audit_user_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.audit_user();

-- Audit user status changes
CREATE OR REPLACE FUNCTION public.audit_user_status_changes_to_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_desc   text;
  v_data   jsonb;
begin
  if tg_op = 'UPDATE' then
    v_action := 'updated';
    if old.lms_status is distinct from new.lms_status then
      v_desc   := 'LMS status changed from '||coalesce(old.lms_status,'')||' to '||coalesce(new.lms_status,'');
    elsif old.status is distinct from new.status then
      v_desc   := 'User status changed from '||coalesce(old.status,'')||' to '||coalesce(new.status,'');
    else
      return new;
    end if;

    v_data := jsonb_build_object(
      'status_old', old.status,
      'status_new', new.status,
      'lms_status_old', old.lms_status,
      'lms_status_new', new.lms_status
    );

    begin
      insert into public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
      values ('user', new.id, v_action, v_desc, v_actor, now(), v_data);
    exception when others then
      raise notice 'audit_user_status_changes_to_logs failed: %', sqlerrm;
    end;
  end if;

  return new;
end;
$function$;

CREATE TRIGGER audit_user_status_changes_trigger
    AFTER UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.audit_user_status_changes_to_logs();

-- Audit invoice changes
CREATE OR REPLACE FUNCTION public.audit_invoice_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_desc   text;
  v_entity uuid;
  v_student_user_id uuid;
  v_student_id uuid;
  v_data   jsonb;
begin
  v_entity := coalesce(new.id, old.id);
  v_student_id := coalesce(new.student_id, old.student_id);

  if tg_op = 'INSERT' then
    v_action := 'created';
    v_desc   := 'Invoice created';
  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    if coalesce(old.status,'') <> coalesce(new.status,'') then
      if new.status = 'paid' then
        v_desc := 'Payment recorded and invoice marked as paid';
      else
        v_desc := 'Invoice status changed from '||coalesce(old.status,'')||' to '||coalesce(new.status,'');
      end if;
    elsif (old.paid_at is distinct from new.paid_at) and new.paid_at is not null then
      v_desc := 'Payment timestamp set';
    else
      v_desc := 'Invoice details updated';
    end if;
  end if;

  if v_student_id is not null then
    select u.id
      into v_student_user_id
    from public.students s
    join public.users u on u.id = s.user_id
    where s.id = v_student_id
    limit 1;
  end if;

  v_data := jsonb_build_object(
    'student_id', v_student_id,
    'student_user_id', v_student_user_id,
    'installment_number', coalesce(new.installment_number, old.installment_number),
    'amount', coalesce(new.amount, old.amount),
    'due_date', coalesce(new.due_date, old.due_date),
    'status_old', old.status,
    'status_new', new.status,
    'paid_at', coalesce(new.paid_at, old.paid_at)
  );

  begin
    insert into public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
    values ('invoice', v_entity, v_action, v_desc, v_actor, now(), v_data);
  exception when others then
    raise notice 'audit_invoice_changes failed: %', sqlerrm;
  end;

  return coalesce(new, old);
end;
$function$;

CREATE TRIGGER audit_invoice_changes_trigger
    AFTER INSERT OR UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.audit_invoice_changes();

-- Audit notification templates
CREATE OR REPLACE FUNCTION public.audit_notification_templates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
declare
  v_actor uuid := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  v_action text;
  v_entity_id uuid;
begin
  if tg_op = 'INSERT' then
    v_action := 'created';
    v_entity_id := new.id;
  elsif tg_op = 'UPDATE' then
    v_action := 'updated';
    v_entity_id := new.id;
    new.updated_at := now();
  elsif tg_op = 'DELETE' then
    v_action := 'deleted';
    v_entity_id := old.id;
  end if;

  begin
    insert into public.admin_logs (entity_type, entity_id, action, description, performed_by, created_at, data)
    values ('notification_template', v_entity_id, v_action, 'Notification template change', v_actor, now(),
            case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else to_jsonb(old) end);
  exception when others then
    raise notice 'audit log failed: %', sqlerrm;
  end;

  return case when tg_op='DELETE' then old else new end;
end;
$function$;

CREATE TRIGGER audit_notification_templates_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.notification_templates
    FOR EACH ROW EXECUTE FUNCTION public.audit_notification_templates();

-- Audit integration access
CREATE OR REPLACE FUNCTION public.audit_integration_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Log access to integration credentials for audit purposes
  -- Use 'user' entity_type since 'integration' is not in the allowed list
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    created_at
  ) VALUES (
    'user', -- Use 'user' instead of 'integration' to match check constraint
    NEW.user_id,
    CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END,
    'Integration credentials accessed for ' || NEW.source,
    auth.uid(),
    now()
  );
  
  RETURN NEW;
END;
$function$;

CREATE TRIGGER audit_integration_access_trigger
    AFTER INSERT OR UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION public.audit_integration_access();
```

## Step 4: Create Row Level Security (RLS) Policies

### 4.1 Enable RLS on All Tables

```sql
-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_partner_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_recovery_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
```

### 4.2 Users Table Policies

```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Staff can view all users
CREATE POLICY "Staff can view all users" ON public.users
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- Admins and superadmins can manage users
CREATE POLICY "Admins and superadmins can manage users" ON public.users
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Enrollment managers can create students
CREATE POLICY "Enrollment managers can create students" ON public.users
    FOR INSERT WITH CHECK (public.get_current_user_role() = 'enrollment_manager' AND NEW.role = 'student');
```

### 4.3 Students Table Policies

```sql
-- Students can view their own record
CREATE POLICY "Students can view their own record" ON public.students
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u 
            WHERE u.id = auth.uid() AND u.id = students.user_id
        )
    );

-- Students can update their own onboarding status
CREATE POLICY "Students can update their own onboarding status" ON public.students
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Admins and enrollment managers can manage students
CREATE POLICY "Admins and enrollment managers can manage students" ON public.students
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'enrollment_manager'));

-- Superadmins have full access to students
CREATE POLICY "Superadmins have full access to students" ON public.students
    FOR ALL USING (public.get_current_user_role() = 'superadmin');
```

### 4.4 Learning Content Policies

```sql
-- Modules policies
CREATE POLICY "Authenticated users can view modules" ON public.modules
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage modules" ON public.modules
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Available lessons policies
CREATE POLICY "Enrolled users can view recordings" ON public.available_lessons
    FOR SELECT USING (
        public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager') 
        OR public.get_current_user_role() = 'student'
    );

CREATE POLICY "Admins can manage available lessons" ON public.available_lessons
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Recording attachments policies
CREATE POLICY "Authenticated users can view recording attachments" ON public.recording_attachments
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage recording attachments" ON public.recording_attachments
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));
```

### 4.5 Assignments and Submissions Policies

```sql
-- Assignments policies
CREATE POLICY "Enrolled users can view assignments" ON public.assignments
    FOR SELECT USING (
        public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager') 
        OR public.get_current_user_role() = 'student'
    );

CREATE POLICY "Admins and superadmins can manage assignments" ON public.assignments
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Submissions policies
CREATE POLICY "Students can manage their own submissions" ON public.submissions
    FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Staff can view all submissions" ON public.submissions
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Staff can update submissions" ON public.submissions
    FOR UPDATE USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));
```

### 4.6 Progress Tracking Policies

```sql
-- Recording views policies
CREATE POLICY "Users can manage their own recording views" ON public.recording_views
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all recording views" ON public.recording_views
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- User unlocks policies
CREATE POLICY "Users can view their own unlocks" ON public.user_unlocks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage unlocks" ON public.user_unlocks
    FOR ALL USING (true);

-- Recording ratings policies
CREATE POLICY "Users can view their own recording ratings" ON public.recording_ratings
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Students can insert their own recording ratings" ON public.recording_ratings
    FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can update their own recording ratings" ON public.recording_ratings
    FOR UPDATE USING (auth.uid() = student_id) WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Staff can view all recording ratings" ON public.recording_ratings
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "Admins can delete any recording rating" ON public.recording_ratings
    FOR DELETE USING (public.get_current_user_role() IN ('admin', 'superadmin'));
```

### 4.7 Financial Management Policies

```sql
-- Installment plans policies
CREATE POLICY "Staff can view installment plans" ON public.installment_plans
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'enrollment_manager', 'mentor'));

CREATE POLICY "Superadmins can manage installment plans" ON public.installment_plans
    FOR ALL USING (public.get_current_user_role() = 'superadmin');

-- Invoices policies
CREATE POLICY "Students can view their own invoices" ON public.invoices
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.students s
            JOIN public.users u ON u.id = s.user_id
            WHERE u.id = auth.uid() AND s.id = invoices.student_id
        )
    );

CREATE POLICY "Admins and enrollment managers can manage invoices" ON public.invoices
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'enrollment_manager'));

CREATE POLICY "Superadmins have full access to invoices" ON public.invoices
    FOR ALL USING (public.get_current_user_role() = 'superadmin');

-- Installment payments policies
CREATE POLICY "Students can view their own payments" ON public.installment_payments
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage installment payments" ON public.installment_payments
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));
```

### 4.8 Notifications Policies

```sql
-- Notification templates policies
CREATE POLICY "Admins can read notification templates" ON public.notification_templates
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Admins can manage notification templates" ON public.notification_templates
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
    FOR INSERT WITH CHECK (true);

-- Notification settings policies
CREATE POLICY "Users can manage their own notification settings" ON public.notification_settings
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage notification settings" ON public.notification_settings
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));
```

### 4.9 Admin and Audit Policies

```sql
-- Admin logs policies
CREATE POLICY "Admins can view admin logs" ON public.admin_logs
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin'));

CREATE POLICY "Enrollment managers can view admin logs" ON public.admin_logs
    FOR SELECT USING (public.get_current_user_role() = 'enrollment_manager');

CREATE POLICY "System can insert admin logs" ON public.admin_logs
    FOR INSERT WITH CHECK (true);

-- User activity logs policies
CREATE POLICY "Users can view their own activity logs" ON public.user_activity_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all activity logs" ON public.user_activity_logs
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "System can insert activity logs" ON public.user_activity_logs
    FOR INSERT WITH CHECK (true);
```

### 4.10 Support System Policies

```sql
-- Support tickets policies
CREATE POLICY "Users can view their own tickets" ON public.support_tickets
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets" ON public.support_tickets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tickets" ON public.support_tickets
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins and enrollment managers can manage support tickets" ON public.support_tickets
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));

-- Support ticket replies policies
CREATE POLICY "Users can view replies to their tickets" ON public.support_ticket_replies
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.support_tickets st
            WHERE st.id = support_ticket_replies.ticket_id AND st.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can reply to their own tickets" ON public.support_ticket_replies
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND
        EXISTS (
            SELECT 1 FROM public.support_tickets st
            WHERE st.id = support_ticket_replies.ticket_id AND st.user_id = auth.uid()
        )
    );

CREATE POLICY "Admins and enrollment managers can view ticket replies" ON public.support_ticket_replies
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));

CREATE POLICY "Admins and enrollment managers can reply to tickets" ON public.support_ticket_replies
    FOR INSERT WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));
```

### 4.11 Additional Feature Policies

```sql
-- Success sessions policies
CREATE POLICY "Authenticated users can view success sessions" ON public.success_sessions
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Enrolled users can view success sessions" ON public.success_sessions
    FOR SELECT USING (
        public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager') 
        OR public.get_current_user_role() = 'student'
    );

CREATE POLICY "Staff can manage success sessions" ON public.success_sessions
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor'));

-- Badges policies
CREATE POLICY "Authenticated users can view badges" ON public.badges
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage badges" ON public.badges
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- User badges policies
CREATE POLICY "Users can view their own badges" ON public.user_badges
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Everyone can view user badges" ON public.user_badges
    FOR SELECT USING (true);

CREATE POLICY "Staff can award badges" ON public.user_badges
    FOR INSERT WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- Milestone categories policies
CREATE POLICY "Everyone can view milestone categories" ON public.milestone_categories
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage milestone categories" ON public.milestone_categories
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Milestones policies
CREATE POLICY "Everyone can view milestones" ON public.milestones
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage milestones" ON public.milestones
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Course tracks policies
CREATE POLICY "Everyone can view course tracks" ON public.course_tracks
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage course tracks" ON public.course_tracks
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'))
    WITH CHECK (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Messages policies
CREATE POLICY "Users can view their own messages" ON public.messages
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON public.messages
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all messages" ON public.messages
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- Email queue policies
CREATE POLICY "Admins can manage email queue" ON public.email_queue
    FOR ALL USING (public.get_current_user_role() IN ('admin', 'superadmin'));

-- Integrations policies
CREATE POLICY "Integrations: users can select their own" ON public.integrations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Integrations: users can insert their own" ON public.integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Integrations: users can update their own" ON public.integrations
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Integrations: users can delete their own" ON public.integrations
    FOR DELETE USING (auth.uid() = user_id);

-- Success partner credits policies
CREATE POLICY "Users can view their own credits" ON public.success_partner_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits" ON public.success_partner_credits
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits" ON public.success_partner_credits
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Staff can view all credits" ON public.success_partner_credits
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- Student recovery messages policies
CREATE POLICY "Staff can view all recovery messages" ON public.student_recovery_messages
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

CREATE POLICY "System can insert recovery messages" ON public.student_recovery_messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update recovery messages" ON public.student_recovery_messages
    FOR UPDATE USING (true);

-- Onboarding responses policies
CREATE POLICY "Users can manage their own onboarding responses" ON public.onboarding_responses
    FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can view all onboarding responses" ON public.onboarding_responses
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- Company settings policies
CREATE POLICY "Staff can view company settings" ON public.company_settings
    FOR SELECT USING (public.get_current_user_role() IN ('admin', 'enrollment_manager', 'student', 'mentor', 'superadmin'));

CREATE POLICY "Superadmins can manage company settings" ON public.company_settings
    FOR ALL USING (public.get_current_user_role() = 'superadmin')
    WITH CHECK (public.get_current_user_role() = 'superadmin');
```

## Step 5: Create Storage Buckets and Policies

### 5.1 Create Storage Buckets

```sql
-- Create assignment files bucket (matches actual database: public=true)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-files', 'assignment-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create company branding bucket (matches actual database: public=true)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-branding', 'company-branding', true)
ON CONFLICT (id) DO NOTHING;

-- Create recording attachments bucket (matches actual database: public=true)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('recording-attachments', 'recording-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create assignment submissions bucket (matches actual database: public=false)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;
```

### 5.2 Create Storage Policies

```sql
-- Assignment files policies (public bucket)
CREATE POLICY "Assignment files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'assignment-files');

CREATE POLICY "Students can upload assignment files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'assignment-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own assignment files" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'assignment-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can view all assignment files" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'assignment-files' 
    AND public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
);

-- Company branding policies (public bucket)
CREATE POLICY "Company branding is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-branding');

CREATE POLICY "Superadmins can upload company branding" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'company-branding' 
    AND public.get_current_user_role() = 'superadmin'
);

CREATE POLICY "Superadmins can update company branding" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'company-branding' 
    AND public.get_current_user_role() = 'superadmin'
);

CREATE POLICY "Superadmins can delete company branding" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'company-branding' 
    AND public.get_current_user_role() = 'superadmin'
);

-- Recording attachments policies (public bucket)
CREATE POLICY "Recording attachments are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'recording-attachments');

CREATE POLICY "Admins can manage recording attachments" 
ON storage.objects 
FOR ALL 
USING (
    bucket_id = 'recording-attachments' 
    AND public.get_current_user_role() IN ('admin', 'superadmin')
);

-- Assignment submissions policies
CREATE POLICY "Students can upload assignment submissions" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
    bucket_id = 'assignment-submissions' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own submissions" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'assignment-submissions' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can view all assignment submissions" 
ON storage.objects 
FOR SELECT 
USING (
    bucket_id = 'assignment-submissions' 
    AND public.get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
);

CREATE POLICY "Students can update their own submissions" 
ON storage.objects 
FOR UPDATE 
USING (
    bucket_id = 'assignment-submissions' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can delete their own submissions" 
ON storage.objects 
FOR DELETE 
USING (
    bucket_id = 'assignment-submissions' 
    AND auth.uid()::text = (storage.foldername(name))[1]
);
```

## Step 6: Seed Initial Data

### 6.1 Create Notification Templates

```sql
-- Basic notification templates
INSERT INTO public.notification_templates (key, title_md, body_md, variables) VALUES
('learning_item_changed', 'Learning Content Updated', 'Learning content has been {action} by {changed_by_name}. Item: {item_title}', ARRAY['changed_by_name', 'action', 'item_type', 'item_title', 'item_id']),
('invoice_issued', 'New Invoice Issued', 'Invoice #{invoice_number} for ${amount} has been issued. Due date: {due_date}', ARRAY['invoice_number', 'student_name', 'amount', 'due_date', 'invoice_id', 'student_user_id']),
('ticket_updated', 'Support Ticket Updated', 'Support ticket #{ticket_number} has been {action_summary}. Status: {status}', ARRAY['ticket_number', 'status', 'action_summary', 'ticket_id', 'student_user_id']),
('assignment_graded', 'Assignment Graded', 'Your assignment "{assignment_name}" has been graded. Status: {status}', ARRAY['assignment_name', 'status', 'feedback', 'assignment_id']),
('course_progress', 'Course Progress Update', 'Congratulations! You have completed {completed_count} out of {total_count} lessons.', ARRAY['completed_count', 'total_count', 'percentage']),
('welcome_student', 'Welcome to Growth OS', 'Welcome {student_name}! Your learning journey begins now. Please complete your onboarding to get started.', ARRAY['student_name', 'course_name'])
ON CONFLICT (key) DO NOTHING;
```

### 6.2 Create Default Badge System

```sql
-- Insert default badges
INSERT INTO public.badges (name, description, image_url) VALUES
('First Login', 'Completed first login to the platform', '/badges/first-login.svg'),
('Assignment Ace', 'Submitted first assignment', '/badges/assignment-ace.svg'),
('Video Viewer', 'Watched first video lesson', '/badges/video-viewer.svg'),
('Course Completer', 'Completed entire course', '/badges/course-completer.svg'),
('Perfect Attendance', 'Attended all live sessions', '/badges/perfect-attendance.svg')
ON CONFLICT DO NOTHING;
```

### 6.3 Create Default Milestone Categories

```sql
-- Insert milestone categories
INSERT INTO public.milestone_categories (name, description, icon, color, display_order) VALUES
('Learning Progress', 'Milestones related to course completion and learning achievements', '📚', '#3B82F6', 1),
('Engagement', 'Milestones for platform engagement and participation', '🎯', '#10B981', 2),
('Social Learning', 'Milestones for community interaction and collaboration', '👥', '#8B5CF6', 3),
('Achievements', 'Special accomplishments and recognitions', '🏆', '#F59E0B', 4)
ON CONFLICT DO NOTHING;
```

### 6.4 Create Default Installment Plans

```sql
-- Insert default installment plans
INSERT INTO public.installment_plans (name, num_installments, total_amount, interval_days, is_active) VALUES
('Pay in Full', 1, 3000.00, 0, true),
('2-Month Plan', 2, 3000.00, 30, true),
('3-Month Plan', 3, 3000.00, 30, true)
ON CONFLICT DO NOTHING;
```

## Step 7: Verification Procedures

### 7.1 Test Database Functions

```sql
-- Test user role function
SELECT public.get_current_user_role();

-- Test sequential unlock status (replace with actual user ID)
-- SELECT * FROM public.get_sequential_unlock_status('00000000-0000-0000-0000-000000000000');

-- Test notification system
-- SELECT public.send_test_notification('welcome_student', '{"student_name": "Test User", "course_name": "Growth OS"}');
```

### 7.2 Verify RLS Policies

```sql
-- Check RLS is enabled on all tables
SELECT schemaname, tablename, rowsecurity, enablerls 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = false;

-- This should return no rows if RLS is properly enabled
```

### 7.3 Verify Storage Setup

```sql
-- Check storage buckets
SELECT * FROM storage.buckets;

-- Check storage policies
SELECT * FROM storage.policies;
```

## Step 8: Environment Setup

### 8.1 Required Environment Variables

Set these environment variables in your Supabase project:

```bash
# Database
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# SMTP (Optional - for email features)
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
```

### 8.2 Create Sequences (if needed)

```sql
-- Create sequences for tables that use them
CREATE SEQUENCE IF NOT EXISTS integrations_id_seq;
CREATE SEQUENCE IF NOT EXISTS user_metrics_id_seq;
```

## Step 9: Final Setup Steps

### 9.1 Create First Superadmin User

After completing the database setup, create your first superadmin user through the Supabase Auth interface or using the Edge Functions.

### 9.2 Configure Authentication

1. Enable email authentication in Supabase Auth settings
2. Configure email templates
3. Set up redirect URLs
4. Configure any social auth providers if needed

### 9.3 Test the System

1. Create a test student user
2. Upload a test recording
3. Create a test assignment
4. Verify the sequential unlock system works
5. Test the notification system

## Troubleshooting

### Common Issues

1. **RLS Policy Errors**: Ensure the `get_current_user_role()` function exists before creating policies
2. **Foreign Key Violations**: Check that referenced tables exist before creating foreign keys
3. **Function Not Found**: Ensure all functions are created in the correct order
4. **Storage Access Issues**: Verify storage buckets are created and policies are correctly set

### Verification Queries

```sql
-- Check all tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;

-- Check all functions exist
SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public' ORDER BY routine_name;

-- Check RLS is enabled
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true;
-- Add all missing functions from database-creation-guide-additions.md
-- User Creation Functions
CREATE OR REPLACE FUNCTION public.create_user_with_role(target_email text, target_password text, target_role text, target_full_name text DEFAULT NULL::text, target_metadata jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

-- Auth and User Management Functions
CREATE OR REPLACE FUNCTION public.handle_auth_user_deleted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

CREATE TRIGGER handle_auth_user_deleted_trigger
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_deleted();

-- Recovery and Analytics Functions
CREATE OR REPLACE FUNCTION public.get_inactive_students(days_threshold integer DEFAULT 3)
RETURNS TABLE(user_id uuid, email text, full_name text, last_active_at timestamp with time zone, days_inactive integer, phone text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.record_recovery_message(p_user_id uuid, p_message_type text DEFAULT 'whatsapp_inactive'::text, p_days_inactive integer DEFAULT 3, p_message_content text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

-- Company Branding Function
CREATE OR REPLACE FUNCTION public.update_company_branding(branding_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

-- Questionnaire Validation Function
CREATE OR REPLACE FUNCTION public.validate_questionnaire_structure(questionnaire_data jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

-- Missing notification functions
CREATE OR REPLACE FUNCTION public.interpolate_template(t text, vars jsonb)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
declare
  k text;
  v text;
  out text := coalesce(t,'');
begin
  if vars is null then
    return out;
  end if;

  for k in select jsonb_object_keys(vars)
  loop
    v := coalesce(vars->>k, '');
    -- Sanitize output to prevent injection
    v := replace(v, '<', '&lt;');
    v := replace(v, '>', '&gt;');
    v := replace(v, '"', '&quot;');
    out := replace(out, '{'||k||'}', v);
  end loop;

  return out;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_users(user_ids uuid[], template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
declare
  -- Parameter aliases to avoid ambiguity with column names
  v_user_ids alias for $1;
  v_template_key alias for $2;
  v_payload alias for $3;

  tpl record;
  uid uuid;
  inserted_ids uuid[] := '{}';
  now_ts timestamptz := now();
  p_hash text := md5(coalesce(v_payload::text,''));
  muted boolean;
  rendered_title text;
  rendered_body text;
  existing_id uuid;
begin
  -- Fetch active template
  select * into tpl
  from public.notification_templates
  where key = v_template_key and active = true
  limit 1;

  if tpl is null then
    -- No active template; nothing to do
    return inserted_ids;
  end if;

  -- Render strings using simple interpolation
  rendered_title := public.interpolate_template(tpl.title_md, v_payload);
  rendered_body  := public.interpolate_template(tpl.body_md,  v_payload);

  -- Loop over user ids
  foreach uid in array v_user_ids
  loop
    -- Check mutes
    select coalesce((ns.mutes ->> v_template_key)::boolean, false)
      into muted
      from public.notification_settings ns
      where ns.user_id = uid;

    if muted then
      continue;
    end if;

    -- Idempotency: skip if an identical payload for same template was created within last 1s
    select n.id into existing_id
    from public.notifications n
    where n.user_id = uid
      and coalesce(n.template_key, '') = coalesce(v_template_key,'')
      and coalesce(n.payload_hash, '') = coalesce(p_hash,'')
      and n.created_at > (now_ts - interval '1 second')
    limit 1;

    if existing_id is not null then
      continue;
    end if;

    -- Insert
    insert into public.notifications
      (user_id, type, channel, status, sent_at, payload, template_key, payload_hash)
    values
      (uid, v_template_key, 'in_app', 'sent', now_ts,
       jsonb_build_object(
         'title', rendered_title,
         'message', rendered_body,
         'template_key', v_template_key,
         'data', v_payload
       ),
       v_template_key,
       p_hash
      )
    returning id into existing_id;

    inserted_ids := inserted_ids || existing_id;
  end loop;

  return inserted_ids;
end;
$$;

CREATE OR REPLACE FUNCTION public.notify_roles(role_codes text[], template_key text, payload jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
declare
  uids uuid[];
  out_ids uuid[] := '{}';
  role text;
  tmp_ids uuid[];
begin
  uids := '{}';
  foreach role in array role_codes
  loop
    uids := uids || array(select public.get_users_by_role(role));
  end loop;

  if array_length(uids, 1) is null then
    return out_ids;
  end if;

  tmp_ids := public.notify_users(uids, template_key, payload);
  out_ids := out_ids || tmp_ids;
  return out_ids;
end;
$$;

-- Success session sync function
CREATE OR REPLACE FUNCTION public.handle_success_session_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
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
$$;

CREATE TRIGGER handle_success_session_sync_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.success_sessions
    FOR EACH ROW EXECUTE FUNCTION public.handle_success_session_sync();
```

This completes the comprehensive database creation guide. Follow these steps in order to create a fully functional Growth OS database with all required tables, functions, policies, initial data, and missing database components that exactly match your current production database.