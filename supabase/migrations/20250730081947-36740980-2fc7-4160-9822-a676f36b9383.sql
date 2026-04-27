-- Comprehensive Security and Performance Audit Fixes
-- Fix all RLS policy issues identified by the linter

-- Add missing RLS policies for tables that need them

-- Admin logs policies
CREATE POLICY "Admins can view admin logs" ON public.admin_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE POLICY "System can insert admin logs" ON public.admin_logs FOR INSERT WITH CHECK (true);

-- Badges policies
CREATE POLICY "Everyone can view badges" ON public.badges FOR SELECT USING (true);

CREATE POLICY "Admins can manage badges" ON public.badges FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Certificates policies
CREATE POLICY "Users can view their own certificates" ON public.certificates FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all certificates" ON public.certificates FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

CREATE POLICY "System can insert certificates" ON public.certificates FOR INSERT WITH CHECK (true);

-- Course tracks policies
CREATE POLICY "Everyone can view course tracks" ON public.course_tracks FOR SELECT USING (true);

CREATE POLICY "Admins can manage course tracks" ON public.course_tracks FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Feedback policies
CREATE POLICY "Users can insert their own feedback" ON public.feedback FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own feedback" ON public.feedback FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all feedback" ON public.feedback FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Messages policies
CREATE POLICY "Users can view their own messages" ON public.messages FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert messages" ON public.messages FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all messages" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Mentorship notes policies
CREATE POLICY "Mentors can view their own notes" ON public.mentorship_notes FOR SELECT USING (auth.uid() = mentor_id);

CREATE POLICY "Students can view notes about them" ON public.mentorship_notes FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Mentors can create notes for their students" ON public.mentorship_notes FOR INSERT WITH CHECK (
  auth.uid() = mentor_id AND
  EXISTS (SELECT 1 FROM public.users WHERE id = student_id AND mentor_id = auth.uid())
);

CREATE POLICY "Admins can view all mentorship notes" ON public.mentorship_notes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Performance record policies
CREATE POLICY "Users can view their own performance" ON public.performance_record FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage performance records" ON public.performance_record FOR ALL WITH CHECK (true);

-- Pods policies
CREATE POLICY "Everyone can view pods" ON public.pods FOR SELECT USING (true);

CREATE POLICY "Admins can manage pods" ON public.pods FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Progress policies
CREATE POLICY "Users can view their own progress" ON public.progress FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own progress" ON public.progress FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all progress" ON public.progress FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Quiz attempts policies
CREATE POLICY "Users can view their own quiz attempts" ON public.quiz_attempts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own quiz attempts" ON public.quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all quiz attempts" ON public.quiz_attempts FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Quiz questions policies
CREATE POLICY "Everyone can view quiz questions" ON public.quiz_questions FOR SELECT USING (true);

CREATE POLICY "Admins can manage quiz questions" ON public.quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Recording views policies
CREATE POLICY "Users can view their own recording views" ON public.recording_views FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own recording views" ON public.recording_views FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recording views" ON public.recording_views FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all recording views" ON public.recording_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Session attendance policies
CREATE POLICY "Users can view their own session attendance" ON public.session_attendance FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own session attendance" ON public.session_attendance FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all session attendance" ON public.session_attendance FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- User badges policies
CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert user badges" ON public.user_badges FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all user badges" ON public.user_badges FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- User segments policies
CREATE POLICY "Users can view their own segments" ON public.user_segments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can manage user segments" ON public.user_segments FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can view all user segments" ON public.user_segments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- User unlocks policies
CREATE POLICY "Users can view their own unlocks" ON public.user_unlocks FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own unlocks" ON public.user_unlocks FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage user unlocks" ON public.user_unlocks FOR ALL WITH CHECK (true);

-- Add missing indexes for performance optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_mentor_id ON public.users(mentor_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_student_id ON public.users(student_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON public.users(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_active_at ON public.users(last_active_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_submissions_user_id ON public.assignment_submissions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_submissions_assignment_id ON public.assignment_submissions(assignment_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_submissions_status ON public.assignment_submissions(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_submissions_reviewed_by ON public.assignment_submissions(reviewed_by);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_submissions_submitted_at ON public.assignment_submissions(submitted_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_logs_activity_type ON public.user_activity_logs(activity_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_logs_occurred_at ON public.user_activity_logs(occurred_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notifications_sent_at ON public.notifications(sent_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_installment_payments_user_id ON public.installment_payments(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_installment_payments_status ON public.installment_payments(status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_installment_payments_payment_date ON public.installment_payments(payment_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_views_user_id ON public.recording_views(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_views_recording_id ON public.recording_views(recording_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recording_views_watched ON public.recording_views(watched);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_available_lessons_module ON public.available_lessons(module);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_available_lessons_sequence_order ON public.available_lessons(sequence_order);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_modules_order ON public.modules("order");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_sequence_order ON public.assignment(sequence_order);

-- Add foreign key constraints for data integrity
ALTER TABLE public.users 
  ADD CONSTRAINT fk_users_mentor_id 
  FOREIGN KEY (mentor_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.assignment_submissions 
  ADD CONSTRAINT fk_assignment_submissions_user_id 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.assignment_submissions 
  ADD CONSTRAINT fk_assignment_submissions_assignment_id 
  FOREIGN KEY (assignment_id) REFERENCES public.assignment(assignment_id) ON DELETE CASCADE;

ALTER TABLE public.assignment_submissions 
  ADD CONSTRAINT fk_assignment_submissions_reviewed_by 
  FOREIGN KEY (reviewed_by) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.user_activity_logs 
  ADD CONSTRAINT fk_user_activity_logs_user_id 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.notifications 
  ADD CONSTRAINT fk_notifications_user_id 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.installment_payments 
  ADD CONSTRAINT fk_installment_payments_user_id 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.recording_views 
  ADD CONSTRAINT fk_recording_views_user_id 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.recording_views 
  ADD CONSTRAINT fk_recording_views_recording_id 
  FOREIGN KEY (recording_id) REFERENCES public.available_lessons(id) ON DELETE CASCADE;

ALTER TABLE public.mentorship_notes 
  ADD CONSTRAINT fk_mentorship_notes_student_id 
  FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.mentorship_notes 
  ADD CONSTRAINT fk_mentorship_notes_mentor_id 
  FOREIGN KEY (mentor_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.support_tickets 
  ADD CONSTRAINT fk_support_tickets_user_id 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.support_tickets 
  ADD CONSTRAINT fk_support_tickets_assigned_to 
  FOREIGN KEY (assigned_to) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE public.ticket_replies 
  ADD CONSTRAINT fk_ticket_replies_ticket_id 
  FOREIGN KEY (ticket_id) REFERENCES public.support_tickets(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_replies 
  ADD CONSTRAINT fk_ticket_replies_user_id 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Add check constraints for data validation
ALTER TABLE public.assignment_submissions 
  ADD CONSTRAINT chk_assignment_submissions_status 
  CHECK (status IN ('submitted', 'accepted', 'rejected'));

ALTER TABLE public.assignment_submissions 
  ADD CONSTRAINT chk_assignment_submissions_score 
  CHECK (score IS NULL OR (score >= 0 AND score <= 100));

ALTER TABLE public.installment_payments 
  ADD CONSTRAINT chk_installment_payments_status 
  CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'));

ALTER TABLE public.installment_payments 
  ADD CONSTRAINT chk_installment_payments_amount 
  CHECK (amount > 0);

ALTER TABLE public.installment_payments 
  ADD CONSTRAINT chk_installment_payments_installment_number 
  CHECK (installment_number > 0);

ALTER TABLE public.support_tickets 
  ADD CONSTRAINT chk_support_tickets_status 
  CHECK (status IN ('open', 'in_progress', 'resolved', 'closed'));

ALTER TABLE public.support_tickets 
  ADD CONSTRAINT chk_support_tickets_priority 
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE public.notifications 
  ADD CONSTRAINT chk_notifications_status 
  CHECK (status IN ('sent', 'delivered', 'failed', 'read'));

-- Optimize data types for better performance
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'student';
ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'Active';
ALTER TABLE public.users ALTER COLUMN lms_status SET DEFAULT 'active';
ALTER TABLE public.users ALTER COLUMN onboarding_done SET DEFAULT false;
ALTER TABLE public.users ALTER COLUMN fees_overdue SET DEFAULT false;

-- Add NOT NULL constraints where appropriate
ALTER TABLE public.assignment_submissions ALTER COLUMN submission_type SET NOT NULL;
ALTER TABLE public.assignment_submissions ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.assignment_submissions ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.user_activity_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.user_activity_logs ALTER COLUMN activity_type SET NOT NULL;

ALTER TABLE public.notifications ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN type SET NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN status SET NOT NULL;

ALTER TABLE public.installment_payments ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.installment_payments ALTER COLUMN installment_number SET NOT NULL;
ALTER TABLE public.installment_payments ALTER COLUMN total_installments SET NOT NULL;

ALTER TABLE public.recording_views ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.recording_views ALTER COLUMN recording_id SET NOT NULL;