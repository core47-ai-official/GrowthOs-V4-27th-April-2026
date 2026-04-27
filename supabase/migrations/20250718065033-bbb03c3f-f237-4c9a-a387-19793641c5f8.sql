-- First, let's see what the current constraint allows and then update it
-- Drop the existing check constraint
ALTER TABLE public.user_activity_logs DROP CONSTRAINT IF EXISTS user_activity_logs_activity_type_check;

-- Create a new check constraint with all the activity types we need
ALTER TABLE public.user_activity_logs 
ADD CONSTRAINT user_activity_logs_activity_type_check 
CHECK (activity_type IN (
  'login',
  'logout', 
  'video_watched',
  'assignment_submitted',
  'profile_updated',
  'page_visit',
  'module_completed',
  'quiz_attempted',
  'dashboard_access',
  'support_ticket_created',
  'file_download',
  'session_joined',
  'certificate_generated'
));

-- Add RLS policies to allow superadmins and admins to view all activity logs
CREATE POLICY "Superadmins and admins can view all activity logs" 
ON public.user_activity_logs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE users.id = auth.uid() 
  AND users.role IN ('superadmin', 'admin', 'mentor')
));