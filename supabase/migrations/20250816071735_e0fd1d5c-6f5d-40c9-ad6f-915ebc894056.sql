-- Enable realtime for user_unlocks table to fix resubmission status updates
-- This will allow students to see recording unlocks in real-time when assignments are approved

-- Set replica identity to FULL to capture complete row data during updates
ALTER TABLE public.user_unlocks REPLICA IDENTITY FULL;

-- Add user_unlocks table to realtime publication for real-time updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_unlocks;