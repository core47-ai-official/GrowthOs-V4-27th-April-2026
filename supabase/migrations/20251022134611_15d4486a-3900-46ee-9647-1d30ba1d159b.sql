-- Backfill user_roles table with existing students who don't have role entries
-- This ensures all students appear in the admin directory
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'student'::app_role
FROM public.users
WHERE role = 'student' 
  AND id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'student')
ON CONFLICT (user_id, role) DO NOTHING;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);

-- Log the backfill
DO $$
DECLARE
  backfilled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO backfilled_count
  FROM public.users
  WHERE role = 'student';
  
  RAISE NOTICE 'Backfilled % student role entries', backfilled_count;
END $$;