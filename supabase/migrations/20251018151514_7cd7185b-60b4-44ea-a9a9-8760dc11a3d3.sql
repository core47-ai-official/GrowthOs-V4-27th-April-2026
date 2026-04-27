-- Enable Realtime for success_partner_messages table
-- This allows the Success Partner to receive AI responses even when the window is closed

-- Set replica identity to full to capture all column changes
ALTER TABLE public.success_partner_messages REPLICA IDENTITY FULL;

-- Verify the table is included in the realtime publication
-- Note: Tables with RLS enabled are automatically added to supabase_realtime publication
-- This is just a verification query that will be executed during migration

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'success_partner_messages'
  ) THEN
    -- Add table to publication if not already included
    ALTER PUBLICATION supabase_realtime ADD TABLE public.success_partner_messages;
  END IF;
END $$;

-- Add comment explaining the realtime setup
COMMENT ON TABLE public.success_partner_messages IS 'Realtime enabled for background AI message processing';