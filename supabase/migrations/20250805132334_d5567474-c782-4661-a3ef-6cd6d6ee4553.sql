-- Enable pg_cron extension for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job to run installment reminder scheduler daily at 9 AM
SELECT cron.schedule(
  'installment-reminder-scheduler',
  '0 9 * * *', -- Every day at 9 AM
  $$
  SELECT
    net.http_post(
        url:='https://majqoqagohicjigmsilu.supabase.co/functions/v1/installment-reminder-scheduler',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hanFvcWFnb2hpY2ppZ21zaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MzM3MTksImV4cCI6MjA2NzIwOTcxOX0.m7QE1xCco9XyfZrTi24lhElL8Bo8Jqj9zOFovfBAzWw"}'::jsonb,
        body:=concat('{"scheduled_at": "', now(), '"}')::jsonb
    ) as request_id;
  $$
);