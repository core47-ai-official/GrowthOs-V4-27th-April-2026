-- Delete all users except the specified ones from both auth.users and public.users tables
-- Keep: tes21312321t@gmail.com, aliegamerz167@gmail.com, umarservices0@gmail.com, umaridmpakistan@gmail.com

-- First delete from public.users table (to avoid foreign key constraints)
DELETE FROM public.users 
WHERE email NOT IN (
  'tes21312321t@gmail.com',
  'aliegamerz167@gmail.com', 
  'umarservices0@gmail.com',
  'umaridmpakistan@gmail.com'
);

-- Then delete from auth.users table
DELETE FROM auth.users 
WHERE email NOT IN (
  'tes21312321t@gmail.com',
  'aliegamerz167@gmail.com',
  'umarservices0@gmail.com', 
  'umaridmpakistan@gmail.com'
);

-- Clean up any orphaned records in related tables
DELETE FROM public.user_badges WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.user_segments WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.user_activity_logs WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.user_module_progress WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.assignment_submissions WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.recording_views WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.user_unlocks WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.quiz_attempts WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.progress WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.feedback WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.installment_payments WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.certificates WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.mentorship_notes WHERE student_id NOT IN (SELECT id FROM public.users) OR mentor_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.session_attendance WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.support_tickets WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.ticket_replies WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.messages WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.notifications WHERE user_id NOT IN (SELECT id FROM public.users);
DELETE FROM public.leaderboard WHERE user_id NOT IN (SELECT id FROM public.users);