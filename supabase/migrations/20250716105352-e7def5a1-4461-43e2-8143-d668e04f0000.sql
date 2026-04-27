-- Remove the constraint entirely first
ALTER TABLE public.users DROP CONSTRAINT users_role_check;

-- Update all existing roles to lowercase
UPDATE public.users SET role = 'student' WHERE role = 'Student';
UPDATE public.users SET role = 'admin' WHERE role = 'Admin';

-- Update existing users with the correct roles
UPDATE public.users 
SET role = 'superadmin', full_name = 'Umar ID (Super Admin)'
WHERE email = 'umaridmpakistan@gmail.com';

UPDATE public.users 
SET role = 'admin', full_name = 'Umar Services (Admin)'
WHERE email = 'umarservices0@gmail.com';

-- Insert new users that don't exist yet
INSERT INTO public.users (email, role, full_name) 
SELECT 'test@gmail.com', 'mentor', 'Test Mentor'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'test@gmail.com');

INSERT INTO public.users (email, role, full_name) 
SELECT 'test0@gmail.com', 'student', 'Test Student'
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE email = 'test0@gmail.com');

-- Add the constraint back with all required roles
ALTER TABLE public.users ADD CONSTRAINT users_role_check 
CHECK (role = ANY (ARRAY['student', 'admin', 'mentor', 'superadmin']));