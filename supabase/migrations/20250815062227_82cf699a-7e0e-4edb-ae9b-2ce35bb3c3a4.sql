-- Performance indexes for critical queries
-- Issue 5: Missing database indexes for performance

-- Index for user lookups by email (login queries)
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Index for user lookups by role (role-based queries)
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);

-- Index for students by user_id (frequent joins)
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- Index for recording views by user and recording (progress tracking)
CREATE INDEX IF NOT EXISTS idx_recording_views_user_recording ON public.recording_views(user_id, recording_id);

-- Index for submissions by student (assignment tracking)
CREATE INDEX IF NOT EXISTS idx_submissions_student_id ON public.submissions(student_id);

-- Index for notifications by user and status (notification queries)
CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON public.notifications(user_id, status);

-- Index for available_lessons by sequence_order (lesson ordering)
CREATE INDEX IF NOT EXISTS idx_available_lessons_sequence ON public.available_lessons(sequence_order);

-- Index for invoices by student_id and status (financial tracking)
CREATE INDEX IF NOT EXISTS idx_invoices_student_status ON public.invoices(student_id, status);

-- Index for user_activity_logs by user_id and created_at (activity tracking)
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON public.user_activity_logs(user_id, created_at DESC);

-- Index for admin_logs by entity_type and created_at (admin audit trails)
CREATE INDEX IF NOT EXISTS idx_admin_logs_entity_date ON public.admin_logs(entity_type, created_at DESC);