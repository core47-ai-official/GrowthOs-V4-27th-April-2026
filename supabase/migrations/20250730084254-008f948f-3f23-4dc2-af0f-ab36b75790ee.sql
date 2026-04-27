-- Clean up old data while preserving specific users
-- First, delete assignment submissions that don't belong to the users we want to keep
DELETE FROM public.assignment_submissions 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com', 
    'aliegamerz167@gmail.com',
    'tes21312321t@gmail.com',
    'billing@idmpakistan.pk'
  )
);

-- Delete user activity logs for users we're removing
DELETE FROM public.user_activity_logs 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com',
    'aliegamerz167@gmail.com', 
    'tes21312321t@gmail.com',
    'billing@idmpakistan.pk'
  )
);

-- Delete other user-related data for users we're removing
DELETE FROM public.user_unlocks 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com',
    'aliegamerz167@gmail.com',
    'tes21312321t@gmail.com', 
    'billing@idmpakistan.pk'
  )
);

DELETE FROM public.recording_views 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com',
    'aliegamerz167@gmail.com',
    'tes21312321t@gmail.com',
    'billing@idmpakistan.pk'
  )
);

DELETE FROM public.user_module_progress 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com',
    'aliegamerz167@gmail.com',
    'tes21312321t@gmail.com',
    'billing@idmpakistan.pk'
  )
);

DELETE FROM public.installment_payments 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com',
    'aliegamerz167@gmail.com',
    'tes21312321t@gmail.com',
    'billing@idmpakistan.pk'
  )
);

DELETE FROM public.notifications 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com',
    'aliegamerz167@gmail.com',
    'tes21312321t@gmail.com',
    'billing@idmpakistan.pk'
  )
);

DELETE FROM public.onboarding_responses 
WHERE user_id NOT IN (
  SELECT id FROM public.users 
  WHERE email IN (
    'umaridmpakistan@gmail.com',
    'umarservices0@gmail.com',
    'aliegamerz167@gmail.com',
    'tes21312321t@gmail.com',
    'billing@idmpakistan.pk'
  )
);

-- Finally, delete users except the ones we want to keep
DELETE FROM public.users 
WHERE email NOT IN (
  'umaridmpakistan@gmail.com',
  'umarservices0@gmail.com',
  'aliegamerz167@gmail.com', 
  'tes21312321t@gmail.com',
  'billing@idmpakistan.pk'
);