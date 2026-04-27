-- Set replica identity to FULL for submissions table to ensure complete row data during updates
-- This will fix assignment status updates not appearing in real-time for students
ALTER TABLE public.submissions REPLICA IDENTITY FULL;