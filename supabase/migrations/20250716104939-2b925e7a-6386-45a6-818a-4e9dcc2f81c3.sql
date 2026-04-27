-- Create test users in public.users table
-- Note: These users will need to sign up through the normal auth flow, but their roles will be pre-set

INSERT INTO public.users (
  id,
  email,
  role,
  full_name,
  created_at,
  updated_at
) VALUES 
  ('10adf039-8565-46c2-86e9-fcc46e172878', 'umaridmpakistan@gmail.com', 'superadmin', 'Umar ID (Super Admin)', NOW(), NOW()),
  (gen_random_uuid(), 'umarservices0@gmail.com', 'admin', 'Umar Services (Admin)', NOW(), NOW()),
  (gen_random_uuid(), 'test@gmail.com', 'mentor', 'Test Mentor', NOW(), NOW()),
  (gen_random_uuid(), 'test0@gmail.com', 'student', 'Test Student', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  role = EXCLUDED.role,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();