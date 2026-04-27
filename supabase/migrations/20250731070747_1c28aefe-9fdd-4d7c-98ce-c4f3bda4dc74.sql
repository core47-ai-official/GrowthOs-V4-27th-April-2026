-- Add deleted_at column to users table for soft deletes
ALTER TABLE public.users ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Drop and recreate the foreign key constraint on notifications table with CASCADE
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Drop and recreate other foreign key constraints with CASCADE where needed
ALTER TABLE public.user_activity_logs DROP CONSTRAINT IF EXISTS user_activity_logs_user_id_fkey;
ALTER TABLE public.user_activity_logs ADD CONSTRAINT user_activity_logs_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.recording_views DROP CONSTRAINT IF EXISTS recording_views_user_id_fkey;
ALTER TABLE public.recording_views ADD CONSTRAINT recording_views_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;
ALTER TABLE public.quiz_attempts ADD CONSTRAINT quiz_attempts_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.progress DROP CONSTRAINT IF EXISTS progress_user_id_fkey;
ALTER TABLE public.progress ADD CONSTRAINT progress_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.feedback DROP CONSTRAINT IF EXISTS feedback_user_id_fkey;
ALTER TABLE public.feedback ADD CONSTRAINT feedback_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.assignment_submissions DROP CONSTRAINT IF EXISTS assignment_submissions_user_id_fkey;
ALTER TABLE public.assignment_submissions ADD CONSTRAINT assignment_submissions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.ticket_replies DROP CONSTRAINT IF EXISTS ticket_replies_user_id_fkey;
ALTER TABLE public.ticket_replies ADD CONSTRAINT ticket_replies_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE public.messages ADD CONSTRAINT messages_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.installment_payments DROP CONSTRAINT IF EXISTS installment_payments_user_id_fkey;
ALTER TABLE public.installment_payments ADD CONSTRAINT installment_payments_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.certificates DROP CONSTRAINT IF EXISTS certificates_user_id_fkey;
ALTER TABLE public.certificates ADD CONSTRAINT certificates_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.session_attendance DROP CONSTRAINT IF EXISTS session_attendance_user_id_fkey;
ALTER TABLE public.session_attendance ADD CONSTRAINT session_attendance_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_badges DROP CONSTRAINT IF EXISTS user_badges_user_id_fkey;
ALTER TABLE public.user_badges ADD CONSTRAINT user_badges_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.leaderboard DROP CONSTRAINT IF EXISTS leaderboard_user_id_fkey;
ALTER TABLE public.leaderboard ADD CONSTRAINT leaderboard_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.performance_record DROP CONSTRAINT IF EXISTS performance_record_user_id_fkey;
ALTER TABLE public.performance_record ADD CONSTRAINT performance_record_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.onboarding_responses DROP CONSTRAINT IF EXISTS onboarding_responses_user_id_fkey;
ALTER TABLE public.onboarding_responses ADD CONSTRAINT onboarding_responses_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.mentorship_notes DROP CONSTRAINT IF EXISTS mentorship_notes_student_id_fkey;
ALTER TABLE public.mentorship_notes ADD CONSTRAINT mentorship_notes_student_id_fkey 
  FOREIGN KEY (student_id) REFERENCES public.users(id) ON DELETE CASCADE;