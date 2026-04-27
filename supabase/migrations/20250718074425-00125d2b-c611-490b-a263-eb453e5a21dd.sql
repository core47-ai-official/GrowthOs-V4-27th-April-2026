-- Remove all foreign key references for this user ID
DELETE FROM user_badges WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM user_segments WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM user_activity_logs WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM user_module_progress WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM assignment_submissions WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM recording_views WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM user_unlocks WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM quiz_attempts WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM progress WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM feedback WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM installment_payments WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM certificates WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM mentorship_notes WHERE student_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a' OR mentor_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM session_attendance WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM support_tickets WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM ticket_replies WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM messages WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM notifications WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';
DELETE FROM leaderboard WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';

-- Now update the user ID to match auth.users
UPDATE users 
SET id = '0d26ff4b-5b0f-4bc1-b63f-9db587e3a067'
WHERE email = 'umarservices0@gmail.com';