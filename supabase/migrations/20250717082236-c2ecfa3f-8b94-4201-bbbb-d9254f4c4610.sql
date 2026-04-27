-- Create/update admin user in public.users table
INSERT INTO public.users (
    email,
    role,
    full_name,
    created_at,
    updated_at
) VALUES (
    'umarservices0@gmail.com',
    'admin',
    'Umar Services (Admin)',
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    full_name = 'Umar Services (Admin)',
    updated_at = NOW();