-- Create admin user with specified credentials
DO $$
DECLARE
    user_uuid uuid;
BEGIN
    -- Insert into auth.users with specified email and password
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
    ) ON CONFLICT (email) DO UPDATE SET
        encrypted_password = crypt('umarservices0@gmail.com', gen_salt('bf')),
        updated_at = NOW()
    RETURNING id INTO user_uuid;

    -- Get the user ID if conflict occurred
    IF user_uuid IS NULL THEN
        SELECT id INTO user_uuid FROM auth.users WHERE email = 'umarservices0@gmail.com';
    END IF;

    -- Insert/update corresponding record in public.users
    INSERT INTO public.users (
        id,
        email,
        role,
        full_name,
        created_at,
        updated_at
    ) VALUES (
        user_uuid,
        'umarservices0@gmail.com',
        'admin',
        'Umar Services (Admin)',
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        full_name = 'Umar Services (Admin)',
        email = 'umarservices0@gmail.com',
        updated_at = NOW();

END $$;