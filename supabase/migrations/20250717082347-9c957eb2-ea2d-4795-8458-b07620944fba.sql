-- Create/update admin user in public.users table  
INSERT INTO public.users (
    email,
    role,
    full_name
) VALUES (
    'umarservices0@gmail.com',
    'admin',
    'Umar Services (Admin)'
) ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    full_name = 'Umar Services (Admin)';