-- Phase 1: Performance Indexes (Separate from main migration to avoid transaction issues)
-- These indexes improve query performance for frequently accessed tables

-- Create indexes for better performance (outside transaction)
-- Note: These will be created individually by the migration system

-- Performance indexes for core tables
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_admin_logs_performed_by ON public.admin_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_recording_views_user_recording ON public.recording_views(user_id, recording_id);
CREATE INDEX IF NOT EXISTS idx_submissions_student_assignment ON public.submissions(student_id, assignment_id);
CREATE INDEX IF NOT EXISTS idx_invoices_student_status ON public.invoices(student_id, status);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_type ON public.user_activity_logs(user_id, activity_type);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_users_role_status ON public.users(role, status) WHERE status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_recording_views_user_watched ON public.recording_views(user_id, watched);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status);

-- Add performance improvements for timestamp queries
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_occurred_at ON public.user_activity_logs(occurred_at);