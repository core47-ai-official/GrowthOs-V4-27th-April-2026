-- Add 'recording_unlocked' to the allowed activity types
ALTER TABLE public.user_activity_logs DROP CONSTRAINT user_activity_logs_activity_type_check;

ALTER TABLE public.user_activity_logs ADD CONSTRAINT user_activity_logs_activity_type_check 
CHECK (activity_type = ANY (ARRAY[
  'login'::text, 'logout'::text, 
  'module_created'::text, 'module_updated'::text, 'module_deleted'::text,
  'video_watched'::text, 'video_created'::text, 'video_updated'::text, 'video_deleted'::text,
  'assignment_created'::text, 'assignment_updated'::text, 'assignment_deleted'::text, 'assignment_submitted'::text,
  'profile_updated'::text, 'page_visit'::text, 'module_completed'::text, 'quiz_attempted'::text,
  'dashboard_access'::text, 'support_ticket_created'::text, 'support_ticket_replied'::text, 'support_ticket_resolved'::text,
  'file_download'::text, 'session_joined'::text,
  'success_session_created'::text, 'success_session_updated'::text, 'success_session_deleted'::text,
  'student_created'::text, 'student_updated'::text, 'student_deleted'::text,
  'admin_created'::text, 'admin_edited'::text, 'admin_deleted'::text,
  'mentor_created'::text, 'mentor_updated'::text, 'mentor_deleted'::text,
  'fees_recorded'::text, 'invoice_generated'::text, 'invoice_downloaded'::text,
  'certificate_generated'::text, 'recording_unlocked'::text
]));