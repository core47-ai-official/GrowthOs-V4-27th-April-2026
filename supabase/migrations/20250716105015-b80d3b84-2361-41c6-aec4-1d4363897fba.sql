-- Create test users in public.users table
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