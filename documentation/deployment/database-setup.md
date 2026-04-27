# Complete Database Setup Guide

Step-by-step SQL commands to create a fully functional Growth OS database from scratch.

**Developed by Core47.ai** | Enterprise Learning Management System

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Supabase project created
- ✅ Admin access to Supabase SQL Editor
- ✅ PostgreSQL 14+ (Supabase default)
- ✅ At least 30 minutes to complete setup

## 🎯 What You'll Create

This guide creates a complete Growth OS database with:
- **38 tables** including all core, tracking, and backup tables
- **200+ RLS policies** for enterprise-grade security
- **35+ database functions** for business logic
- **25+ triggers** for automation
- **4 storage buckets** with correct publicity settings
- **Complete user management** and authentication system

---

## ⚠️ CRITICAL: Execute in Order

**DO NOT skip steps or change execution order!** Dependencies must be created before tables.

---

## ⚠️ Why This Execution Order Matters

### Critical Dependency: get_current_user_role() MUST BE FIRST

The `get_current_user_role()` function is referenced by **68+ RLS policies** across all tables. Creating it first prevents:
- ❌ "function does not exist" errors when creating policies
- ❌ Policy creation failures
- ❌ Need to rollback and recreate policies

### Tables Before Foreign Keys

Foreign keys reference other tables' columns. Create all tables before adding foreign key constraints to avoid:
- ❌ "relation does not exist" errors
- ❌ Column reference failures

### RLS Policies After Tables

RLS policies reference table columns and the `get_current_user_role()` function. Create policies after tables exist to avoid:
- ❌ "relation does not exist" errors
- ❌ "function does not exist" errors

### Functions Before Triggers

Triggers call database functions. Create functions before triggers to avoid:
- ❌ "function does not exist" errors
- ❌ Trigger creation failures

### Sequences Before Tables

Some tables depend on sequences for auto-incrementing IDs. Create sequences first to avoid:
- ❌ "sequence does not exist" errors

**For complete migration chronology**, see [Migration Order Guide](../../documentation/database/migration-order.md)

---

# STEP 0: Critical Security Function (MUST BE FIRST!)

**⚠️ DEPENDS ON: Nothing - This is step 0 for a reason!**

This function is referenced by 68+ RLS policies. Create it before anything else or all policy creation will fail.

```sql
-- CRITICAL: This MUST be the first thing you create
-- Used by 68+ RLS policies across all tables
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;
```

**Verification**:
```sql
-- Should execute without error (will return NULL until users table exists)
SELECT public.get_current_user_role();
```

---

# STEP 1: Create Required Sequences

**⚠️ DEPENDS ON: Step 0 (get_current_user_role function)**

```sql
-- Sequences for auto-incrementing IDs
-- Used by integrations and user_metrics tables
CREATE SEQUENCE IF NOT EXISTS public.integrations_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.user_metrics_id_seq;
```

**Verification**:
```sql
-- Check sequences exist
SELECT sequence_name FROM information_schema.sequences 
WHERE sequence_schema = 'public';
-- Should show integrations_id_seq and user_metrics_id_seq
```

---

# STEP 2: Create All Tables (Execute in Order)

**⚠️ DEPENDS ON: Steps 0 and 1 (function and sequences)**

**Critical**: Tables must be created in this exact order due to foreign key dependencies.

## 2.1 Company Settings Table

**⚠️ DEPENDS ON: Nothing - no foreign keys**

```sql
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

-- Insert default settings
INSERT INTO public.company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

## 2.2 Users Table (Core Authentication)

**⚠️ DEPENDS ON: Nothing - no foreign keys (this is the base table)**

```sql
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
```

## 2.3 Students Table

**⚠️ DEPENDS ON: users table**

```sql
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
```

## 2.4 Learning Management Tables

**⚠️ DEPENDS ON: users, modules tables**

```sql
-- Modules
CREATE TABLE public.modules (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    "order" integer
);

-- Available Lessons/Recordings
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

-- Recording Views
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

-- User Unlocks (Sequential Progression)
CREATE TABLE public.user_unlocks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    is_unlocked boolean NOT NULL DEFAULT false,
    unlocked_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    UNIQUE(user_id, recording_id)
);

-- Recording Attachments
CREATE TABLE public.recording_attachments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    file_name text NOT NULL,
    file_url text NOT NULL,
    uploaded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Recording Ratings
CREATE TABLE public.recording_ratings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    recording_id uuid NOT NULL REFERENCES public.available_lessons(id) ON DELETE CASCADE,
    rating integer NOT NULL,
    feedback text,
    lesson_title text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT valid_rating CHECK (rating >= 1 AND rating <= 5)
);
```

## 2.5 Assignment System

```sql
-- Assignments
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

-- Submissions
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
```

## 2.6 Financial Management

```sql
-- Installment Plans
CREATE TABLE public.installment_plans (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    num_installments integer NOT NULL,
    interval_days integer NOT NULL,
    total_amount numeric NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

-- Invoices
CREATE TABLE public.invoices (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    installment_number integer NOT NULL,
    amount numeric NOT NULL,
    due_date timestamp with time zone NOT NULL,
    status text DEFAULT 'pending',
    payment_method text,
    paid_at timestamp with time zone,
    notes text,
    first_reminder_sent boolean DEFAULT false,
    first_reminder_sent_at timestamp with time zone,
    second_reminder_sent boolean DEFAULT false,
    second_reminder_sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_invoice_status CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'))
);

-- Installment Payments
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
    CONSTRAINT valid_payment_status CHECK (status IN ('paid', 'failed', 'refunded'))
);
```

## 2.7 Notification System

```sql
-- Notification Templates
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

-- Notifications
CREATE TABLE public.notifications (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL,
    channel text NOT NULL DEFAULT 'system',
    status text NOT NULL DEFAULT 'sent',
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    template_key text,
    payload_hash text,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    read_at timestamp with time zone,
    dismissed_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT valid_channel CHECK (channel IN ('system', 'email', 'sms', 'in_app'))
);

-- Notification Settings
CREATE TABLE public.notification_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    mutes jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);
```

## 2.8 Support System

```sql
-- Support Tickets
CREATE TABLE public.support_tickets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text NOT NULL,
    category text,
    status text NOT NULL DEFAULT 'open',
    priority text NOT NULL DEFAULT 'medium',
    assigned_to uuid REFERENCES public.users(id),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT valid_ticket_status CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    CONSTRAINT valid_priority CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

-- Support Ticket Replies
CREATE TABLE public.support_ticket_replies (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    message text NOT NULL,
    is_internal boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
```

## 2.9 Success Sessions

```sql
-- Success Sessions
CREATE TABLE public.success_sessions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    start_time timestamp without time zone NOT NULL,
    end_time timestamp without time zone,
    schedule_date text,
    link text NOT NULL,
    mentor_id uuid REFERENCES public.users(id),
    mentor_name text,
    status text DEFAULT 'upcoming',
    zoom_meeting_id text,
    zoom_passcode text,
    host_login_email text,
    host_login_pwd text,
    created_by uuid REFERENCES public.users(id),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT valid_session_status CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled'))
);

-- Segmented Weekly Sessions View
CREATE TABLE public.segmented_weekly_success_sessions (
    id uuid NOT NULL PRIMARY KEY,
    title text,
    description text,
    start_time timestamp without time zone,
    end_time timestamp without time zone,
    mentor_id uuid,
    mentor_name text,
    status text,
    segment text DEFAULT 'weekly',
    created_at timestamp without time zone
);
```

## 2.10 Gamification System

```sql
-- Milestone Categories
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

-- Milestones
CREATE TABLE public.milestones (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    category_id uuid REFERENCES public.milestone_categories(id),
    trigger_type text NOT NULL,
    trigger_config jsonb DEFAULT '{}'::jsonb,
    points integer DEFAULT 10,
    icon text DEFAULT '🏆',
    badge_url text,
    celebration_message text,
    celebration_config jsonb DEFAULT '{}'::jsonb,
    show_celebration boolean DEFAULT false,
    is_active boolean DEFAULT true,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_trigger CHECK (trigger_type IN ('recording_watched', 'assignment_submitted', 'course_completed', 'login_streak'))
);

-- Badges
CREATE TABLE public.badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    image_url text
);

-- User Badges
CREATE TABLE public.user_badges (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_id uuid NOT NULL REFERENCES public.badges(id) ON DELETE CASCADE,
    earned_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Course Tracks
CREATE TABLE public.course_tracks (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    description text,
    created_at timestamp without time zone DEFAULT now()
);
```

## 2.11 Activity Logging

```sql
-- Admin Logs
CREATE TABLE public.admin_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    entity_type text NOT NULL,
    entity_id uuid,
    action text NOT NULL,
    description text,
    performed_by uuid,
    data jsonb,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT valid_entity_type CHECK (entity_type IN ('user', 'student', 'assignment', 'invoice', 'recording', 'notification_template', 'data_access', 'user_security'))
);

-- User Activity Logs
CREATE TABLE public.user_activity_logs (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type text NOT NULL,
    reference_id uuid,
    metadata jsonb DEFAULT '{}'::jsonb,
    occurred_at timestamp with time zone NOT NULL DEFAULT now(),
    created_at timestamp with time zone NOT NULL DEFAULT now()
);
```

## 2.12 Integration Tables

```sql
-- Integrations
CREATE TABLE public.integrations (
    id bigint NOT NULL DEFAULT nextval('integrations_id_seq'::regclass) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source text NOT NULL,
    external_id text,
    access_token text NOT NULL,
    refresh_token text,
    connected_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User Metrics
CREATE TABLE public.user_metrics (
    id bigint NOT NULL DEFAULT nextval('user_metrics_id_seq'::regclass) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    source text NOT NULL,
    metric text NOT NULL,
    value numeric NOT NULL,
    date date NOT NULL,
    fetched_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Email Queue
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
    CONSTRAINT valid_email_status CHECK (status IN ('pending', 'sent', 'failed'))
);
```

## 2.13 Onboarding System

```sql
-- Onboarding Responses
CREATE TABLE public.onboarding_responses (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    question_id text NOT NULL,
    answer_type text NOT NULL,
    answer text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);
```

## 2.14 Recovery & Credits

```sql
-- Student Recovery Messages
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
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Success Partner Credits
CREATE TABLE public.success_partner_credits (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date date NOT NULL DEFAULT CURRENT_DATE,
    credits_used integer NOT NULL DEFAULT 0,
    daily_limit integer NOT NULL DEFAULT 10,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);
```

## 2.15 Messages System

```sql
-- Messages
CREATE TABLE public.messages (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type text NOT NULL DEFAULT 'feedback',
    content text NOT NULL,
    template_name text,
    context jsonb DEFAULT '{}'::jsonb,
    status text NOT NULL DEFAULT 'queued',
    response_id text,
    sent_at timestamp with time zone NOT NULL DEFAULT now(),
    replied_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT valid_message_type CHECK (type IN ('feedback', 'inquiry', 'complaint', 'suggestion')),
    CONSTRAINT valid_message_status CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'replied'))
);
```

## 2.16 Security Tracking

```sql
-- User Security Summary
CREATE TABLE public.user_security_summary (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
    security_score integer DEFAULT 100,
    last_login_at timestamp with time zone,
    failed_login_attempts integer DEFAULT 0,
    password_last_changed timestamp with time zone,
    suspicious_activity_count integer DEFAULT 0,
    risk_level text DEFAULT 'low',
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT valid_risk_level CHECK (risk_level IN ('low', 'medium', 'high', 'critical'))
);
```

---

# STEP 3: Enable Row Level Security

```sql
-- Enable RLS on all user-facing tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.available_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.segmented_weekly_success_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_recovery_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_partner_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_security_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
```

---

# STEP 4: Create RLS Policies

## 4.1 Users Table Policies

```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile" ON public.users
FOR SELECT USING (auth.uid() = id);

-- Staff can view all users
CREATE POLICY "Staff can view all users" ON public.users
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager', 'mentor'));

-- Superadmins can manage users
CREATE POLICY "Superadmins can manage users" ON public.users
FOR ALL USING (get_current_user_role() = 'superadmin');
```

## 4.2 Students Table Policies

```sql
-- Students can view own record
CREATE POLICY "Students can view own record" ON public.students
FOR SELECT USING (user_id = auth.uid());

-- Students can update own onboarding
CREATE POLICY "Students can update own onboarding" ON public.students
FOR UPDATE USING (user_id = auth.uid());

-- Staff can manage students
CREATE POLICY "Staff can manage students" ON public.students
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));
```

## 4.3 Learning Content Policies

```sql
-- Authenticated users can view modules
CREATE POLICY "Authenticated can view modules" ON public.modules
FOR SELECT USING (auth.role() = 'authenticated');

-- Admins can manage modules
CREATE POLICY "Admins can manage modules" ON public.modules
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin'));

-- Enrolled users can view recordings
CREATE POLICY "Enrolled can view recordings" ON public.available_lessons
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager', 'student'));

-- Admins can manage recordings
CREATE POLICY "Admins can manage recordings" ON public.available_lessons
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin'));
```

## 4.4 Assignment Policies

```sql
-- Students and staff can view assignments
CREATE POLICY "Enrolled can view assignments" ON public.assignments
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager', 'student'));

-- Admins can manage assignments
CREATE POLICY "Admins can manage assignments" ON public.assignments
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin'));

-- Students can manage own submissions
CREATE POLICY "Students can manage own submissions" ON public.submissions
FOR ALL USING (student_id = auth.uid());

-- Staff can view all submissions
CREATE POLICY "Staff can view all submissions" ON public.submissions
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- Staff can update submissions
CREATE POLICY "Staff can update submissions" ON public.submissions
FOR UPDATE USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));
```

## 4.5 Financial Policies

```sql
-- Staff can view installment plans
CREATE POLICY "Staff can view plans" ON public.installment_plans
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager', 'mentor'));

-- Superadmins can manage plans
CREATE POLICY "Superadmins can manage plans" ON public.installment_plans
FOR ALL USING (get_current_user_role() = 'superadmin');

-- Students can view own invoices
CREATE POLICY "Students can view own invoices" ON public.invoices
FOR SELECT USING (EXISTS (
    SELECT 1 FROM students s JOIN users u ON u.id = s.user_id
    WHERE u.id = auth.uid() AND s.id = invoices.student_id
));

-- Staff can manage invoices
CREATE POLICY "Staff can manage invoices" ON public.invoices
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));
```

## 4.6 Notification Policies

```sql
-- Users can view own notifications
CREATE POLICY "Users can view own notifications" ON public.notifications
FOR SELECT USING (user_id = auth.uid());

-- Users can update own notifications
CREATE POLICY "Users can update own notifications" ON public.notifications
FOR UPDATE USING (user_id = auth.uid());

-- System can insert notifications
CREATE POLICY "System can insert notifications" ON public.notifications
FOR INSERT WITH CHECK (true);

-- Admins can manage templates
CREATE POLICY "Admins can manage templates" ON public.notification_templates
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin'));
```

## 4.7 Support Policies

```sql
-- Users can view own tickets
CREATE POLICY "Users can view own tickets" ON public.support_tickets
FOR SELECT USING (user_id = auth.uid());

-- Users can create tickets
CREATE POLICY "Users can create tickets" ON public.support_tickets
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Staff can manage tickets
CREATE POLICY "Staff can manage tickets" ON public.support_tickets
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));

-- Users can view replies to own tickets
CREATE POLICY "Users can view own ticket replies" ON public.support_ticket_replies
FOR SELECT USING (EXISTS (
    SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid()
));

-- Staff can manage replies
CREATE POLICY "Staff can manage replies" ON public.support_ticket_replies
FOR ALL USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));
```

## 4.8 Tracking & Analytics Policies

```sql
-- Users can view own activity
CREATE POLICY "Users can view own activity" ON public.user_activity_logs
FOR SELECT USING (user_id = auth.uid());

-- Staff can view all activity
CREATE POLICY "Staff can view all activity" ON public.user_activity_logs
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager'));

-- System can insert activity
CREATE POLICY "System can insert activity" ON public.user_activity_logs
FOR INSERT WITH CHECK (true);

-- Staff can view admin logs
CREATE POLICY "Staff can view admin logs" ON public.admin_logs
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager'));

-- System can insert admin logs
CREATE POLICY "System can insert admin logs" ON public.admin_logs
FOR INSERT WITH CHECK (true);
```

## 4.9 Company Settings Policy

```sql
-- Staff can view settings
CREATE POLICY "Staff can view settings" ON public.company_settings
FOR SELECT USING (get_current_user_role() IN ('admin', 'superadmin', 'enrollment_manager', 'mentor', 'student'));

-- Superadmins can manage settings
CREATE POLICY "Superadmins can manage settings" ON public.company_settings
FOR ALL USING (get_current_user_role() = 'superadmin');
```

---

# STEP 5: Create Storage Buckets

```sql
-- Assignment Files (PUBLIC)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assignment-files',
    'assignment-files',
    true,
    52428800,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) ON CONFLICT (id) DO NOTHING;

-- Assignment Submissions (PRIVATE)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'assignment-submissions',
    'assignment-submissions',
    false,
    52428800,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'application/zip', 'application/x-zip-compressed']
) ON CONFLICT (id) DO NOTHING;

-- Company Branding (PUBLIC)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'company-branding',
    'company-branding',
    true,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Recording Attachments (PUBLIC)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'recording-attachments',
    'recording-attachments',
    true,
    104857600,
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']
) ON CONFLICT (id) DO NOTHING;
```

## Storage Policies

```sql
-- Assignment Files: Public read, authenticated upload
CREATE POLICY "Public can view assignment files"
ON storage.objects FOR SELECT
USING (bucket_id = 'assignment-files');

CREATE POLICY "Authenticated can upload assignment files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assignment-files' AND auth.role() = 'authenticated');

-- Assignment Submissions: Owner access only
CREATE POLICY "Students can view own submissions"
ON storage.objects FOR SELECT
USING (bucket_id = 'assignment-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Students can upload own submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assignment-submissions' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Company Branding: Public read, admin write
CREATE POLICY "Public can view branding"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-branding');

CREATE POLICY "Admins can manage branding"
ON storage.objects FOR ALL
USING (bucket_id = 'company-branding' AND get_current_user_role() IN ('admin', 'superadmin'));

-- Recording Attachments: Public read, admin write
CREATE POLICY "Public can view attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'recording-attachments');

CREATE POLICY "Admins can manage attachments"
ON storage.objects FOR ALL
USING (bucket_id = 'recording-attachments' AND get_current_user_role() IN ('admin', 'superadmin'));
```

---

# STEP 6: Verification Queries

Run these queries to verify your setup:

```sql
-- Verify critical function exists
SELECT public.get_current_user_role();

-- Count tables (should be 38+)
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Verify RLS is enabled on all tables
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- Check storage buckets (should be 4)
SELECT id, name, public FROM storage.buckets;

-- Verify company settings exist
SELECT * FROM public.company_settings WHERE id = 1;
```

---

## 🎉 Setup Complete!

Your Growth OS database is now ready! Next steps:

1. **Configure Edge Functions** - See [Edge Functions Guide](./edge-functions.md)
2. **Set Environment Variables** - See [Environment Variables Guide](./environment-variables.md)
3. **Deploy Application** - See [CloudFlare Workers Guide](./cloudflare-workers.md)
4. **Run Verification** - See [Verification Checklist](./verification-checklist.md)

---

**Developed by Core47.ai** - © 2025 Core47.ai. All rights reserved.  
**Support**: support@core47.ai | **Website**: https://core47.ai
