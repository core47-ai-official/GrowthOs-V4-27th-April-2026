-- Fix admin_logs constraint to include 'creation_failed' action
ALTER TABLE public.admin_logs 
DROP CONSTRAINT IF EXISTS admin_logs_action_check;

-- Add the updated constraint with all necessary actions
ALTER TABLE public.admin_logs 
ADD CONSTRAINT admin_logs_action_check 
CHECK (action IN (
  'created', 
  'updated', 
  'deleted', 
  'auth_deleted',
  'creation_failed',
  'deletion_failed'
));