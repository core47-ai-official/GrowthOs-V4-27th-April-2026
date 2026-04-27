-- First delete any related records that might prevent the ID update
DELETE FROM user_badges WHERE user_id = '1831fe61-cb5a-4122-92c1-26e5dcae260a';

-- Now update the user ID to match auth.users
UPDATE users 
SET id = '0d26ff4b-5b0f-4bc1-b63f-9db587e3a067'
WHERE email = 'umarservices0@gmail.com';