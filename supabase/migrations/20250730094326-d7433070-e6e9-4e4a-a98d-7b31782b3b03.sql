-- Create a cron job to process student email queue every minute
select cron.schedule(
  'process-student-emails',
  '* * * * *', -- every minute
  $$
  select
    net.http_post(
        url:='https://majqoqagohicjigmsilu.supabase.co/functions/v1/send-student-emails',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hanFvcWFnb2hpY2ppZ21zaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MzM3MTksImV4cCI6MjA2NzIwOTcxOX0.m7QE1xCco9XyfZrTi24lhElL8Bo8Jqj9zOFovfBAzWw"}'::jsonb,
        body:='{"trigger": "cron"}'::jsonb
    ) as request_id;
  $$
);