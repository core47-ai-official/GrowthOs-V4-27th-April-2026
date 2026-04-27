-- Create users in auth.users for testing
-- Note: This is a special case for setting up test users
-- In production, users would normally sign up through the UI

-- First, let's check if we need to insert these users
-- We'll use a function to safely create auth users

DO $$
DECLARE
    user_exists boolean;
BEGIN
    -- Check and create umarservices0@gmail.com
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'umarservices0@gmail.com') INTO user_exists;
    IF NOT user_exists THEN
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
            now(),
            now(),
            now(),
            '',
            '',
            '',
            ''
        );
    END IF;

    -- Check and create test@gmail.com
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'test@gmail.com') INTO user_exists;
    IF NOT user_exists THEN
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
            now(),
            now(),
            now(),
            '',
            '',
            '',
            ''
        );
    END IF;

    -- Check and create test0@gmail.com
    SELECT EXISTS(SELECT 1 FROM auth.users WHERE email = 'test0@gmail.com') INTO user_exists;
    IF NOT user_exists THEN
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
            now(),
            now(),
            now(),
            '',
            '',
            '',
            ''
        );
    END IF;
END $$;