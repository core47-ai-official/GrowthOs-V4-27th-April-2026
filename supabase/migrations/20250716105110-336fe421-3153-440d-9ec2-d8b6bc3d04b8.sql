-- Update the role constraint to allow all required roles
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role = ANY (ARRAY['student', 'admin', 'mentor', 'superadmin']));

-- Insert the test users
INSERT INTO public.users (
  email,
  role,
  full_name
) VALUES 
  ('umarservices0@gmail.com', 'admin', 'Umar Services (Admin)'),
  ('test@gmail.com', 'mentor', 'Test Mentor'),
  ('test0@gmail.com', 'student', 'Test Student')
ON CONFLICT (email) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name;

-- Update the existing superadmin user role if needed
UPDATE public.users 
SET role = 'superadmin', full_name = 'Umar ID (Super Admin)'
WHERE email = 'umaridmpakistan@gmail.com';