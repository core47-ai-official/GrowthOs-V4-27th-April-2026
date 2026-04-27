-- Drop the existing check constraint
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;

-- Add the updated constraint that includes 'system' channel
ALTER TABLE public.notifications ADD CONSTRAINT notifications_channel_check 
CHECK (channel = ANY (ARRAY['email'::text, 'whatsapp'::text, 'sms'::text, 'system'::text]));