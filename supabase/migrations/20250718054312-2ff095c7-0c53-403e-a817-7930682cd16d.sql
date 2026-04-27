
-- First, let's ensure the admin user exists in auth.users with the correct password
-- We'll use a safe approach that won't conflict with existing data

DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Check if admin user already exists in auth.users
    SELECT id INTO admin_user_id 
    FROM auth.users 
    WHERE email = 'umarservices0@gmail.com';

    -- If user doesn't exist in auth.users, create them
    IF admin_user_id IS NULL THEN
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
        ) RETURNING id INTO admin_user_id;
    ELSE
        -- If user exists, update their password
        UPDATE auth.users 
        SET encrypted_password = crypt('umarservices0@gmail.com', gen_salt('bf')),
            updated_at = NOW()
        WHERE email = 'umarservices0@gmail.com'
        RETURNING id INTO admin_user_id;
    END IF;

    -- Ensure user exists in public.users table
    INSERT INTO public.users (
        id,
        email,
        role,
        full_name,
        created_at,
        updated_at
    ) VALUES (
        admin_user_id,
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
