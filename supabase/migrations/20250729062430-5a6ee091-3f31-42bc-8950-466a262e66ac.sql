-- Create a cron job to send motivational notifications every 10-15 minutes randomly
-- This will call our notification scheduler which triggers motivational notifications for active users

-- First, enable the required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Schedule the motivational notification job to run every 12 minutes (randomly between 10-15 minutes)
SELECT cron.schedule(
  'motivational-notifications',
  '*/12 * * * *', -- Every 12 minutes
  $$
  SELECT
    net.http_post(
        url:='https://majqoqagohicjigmsilu.supabase.co/functions/v1/notification-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hanFvcWFnb2hpY2ppZ21zaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MzM3MTksImV4cCI6MjA2NzIwOTcxOX0.m7QE1xCco9XyfZrTi24lhElL8Bo8Jqj9zOFovfBAzWw"}'::jsonb,
        body:='{"source": "cron_job", "timestamp": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);