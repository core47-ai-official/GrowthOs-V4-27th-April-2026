-- Enable realtime for submissions table to fix assignment status updates
-- This will allow students to see assignment status changes in real-time when staff approves/declines

-- Set replica identity to FULL to capture complete row data during updates
ALTER TABLE public.submissions REPLICA IDENTITY FULL;

-- Add submissions table to realtime publication for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;