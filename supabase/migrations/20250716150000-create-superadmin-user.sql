-- Create superadmin user
DO $$
BEGIN
  -- Insert the user with superadmin role
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
  ) ON CONFLICT (email) DO NOTHING;

  -- Insert corresponding user record
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
    'Umar ID',
    NOW(),
    NOW()
  FROM auth.users au 
  WHERE au.email = 'umaridmpakistan@gmail.com'
  ON CONFLICT (id) DO UPDATE SET 
    role = 'superadmin',
    full_name = 'Umar ID',
    updated_at = NOW();

END $$;