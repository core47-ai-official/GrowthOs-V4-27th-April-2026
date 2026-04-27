-- Call the test email function to send email to umaridmpaksitan@gmail.com
select
  net.http_post(
      url:='https://majqoqagohicjigmsilu.supabase.co/functions/v1/send-test-email',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1hanFvcWFnb2hpY2ppZ21zaWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE2MzM3MTksImV4cCI6MjA2NzIwOTcxOX0.m7QE1xCco9XyfZrTi24lhElL8Bo8Jqj9zOFovfBAzWw"}'::jsonb,
      body:='{"to_email": "umaridmpaksitan@gmail.com", "subject": "Test Email from Your LMS System", "message": "This is a test email to verify that your email system is working correctly."}'::jsonb
  ) as request_id;