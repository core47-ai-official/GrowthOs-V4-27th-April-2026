-- Enable real-time updates for company_settings table
ALTER TABLE public.company_settings REPLICA IDENTITY FULL;

-- Add the table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_settings;