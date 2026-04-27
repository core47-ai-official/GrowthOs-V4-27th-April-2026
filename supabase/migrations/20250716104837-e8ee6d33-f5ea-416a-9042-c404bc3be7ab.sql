-- Create test users with different roles
DO $$
DECLARE
  superadmin_id UUID;
  admin_id UUID;
  mentor_id UUID;
  user_id UUID;
BEGIN
  -- Create superadmin user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'umaridmpakistan@gmail.com',
    crypt('umaridmpakistan@gmail.com', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) ON CONFLICT (email) DO NOTHING
  RETURNING id INTO superadmin_id;

  -- Create admin user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'umarservices0@gmail.com',
    crypt('umarservices0@gmail.com', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) ON CONFLICT (email) DO NOTHING
  RETURNING id INTO admin_id;

  -- Create mentor user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test@gmail.com',
    crypt('test@gmail.com', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) ON CONFLICT (email) DO NOTHING
  RETURNING id INTO mentor_id;

  -- Create regular user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test0@gmail.com',
    crypt('test0@gmail.com', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) ON CONFLICT (email) DO NOTHING
  RETURNING id INTO user_id;

  -- Insert corresponding user records in public.users table
  INSERT INTO public.users (
    id,
    email,
    role,
    full_name,
    created_at,
    updated_at
  ) 
  SELECT 
    au.id,
    'umaridmpakistan@gmail.com',
    'superadmin',
    'Umar ID (Super Admin)',
    NOW(),
    NOW()
  FROM auth.users au 
  WHERE au.email = 'umaridmpakistan@gmail.com'
  ON CONFLICT (id) DO UPDATE SET 
    role = 'superadmin',
    full_name = 'Umar ID (Super Admin)',
    updated_at = NOW();

  INSERT INTO public.users (
    id,
    email,
    role,
    full_name,
    created_at,
    updated_at
  ) 
  SELECT 
    au.id,
    'umarservices0@gmail.com',
    'admin',
    'Umar Services (Admin)',
    NOW(),
    NOW()
  FROM auth.users au 
  WHERE au.email = 'umarservices0@gmail.com'
  ON CONFLICT (id) DO UPDATE SET 
    role = 'admin',
    full_name = 'Umar Services (Admin)',
    updated_at = NOW();

  INSERT INTO public.users (
    id,
    email,
    role,
    full_name,
    created_at,
    updated_at
  ) 
  SELECT 
    au.id,
    'test@gmail.com',
    'mentor',
    'Test Mentor',
    NOW(),
    NOW()
  FROM auth.users au 
  WHERE au.email = 'test@gmail.com'
  ON CONFLICT (id) DO UPDATE SET 
    role = 'mentor',
    full_name = 'Test Mentor',
    updated_at = NOW();

  INSERT INTO public.users (
    id,
    email,
    role,
    full_name,
    created_at,
    updated_at
  ) 
  SELECT 
    au.id,
    'test0@gmail.com',
    'student',
    'Test Student',
    NOW(),
    NOW()
  FROM auth.users au 
  WHERE au.email = 'test0@gmail.com'
  ON CONFLICT (id) DO UPDATE SET 
    role = 'student',
    full_name = 'Test Student',
    updated_at = NOW();

END $$;