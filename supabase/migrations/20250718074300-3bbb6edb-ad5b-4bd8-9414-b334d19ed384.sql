-- Update the user IDs in the users table to match their auth.users IDs
-- This is necessary because there was a mismatch between auth IDs and user table IDs

-- Update umarservices0@gmail.com
UPDATE users 
SET id = (SELECT id FROM auth.users WHERE email = 'umarservices0@gmail.com')
WHERE email = 'umarservices0@gmail.com';

-- Let's also check and fix other users if needed
-- Update test@gmail.com if it exists
UPDATE users 
SET id = (SELECT au.id FROM auth.users au WHERE au.email = 'test@gmail.com')
WHERE email = 'test@gmail.com' 
AND EXISTS (SELECT 1 FROM auth.users WHERE email = 'test@gmail.com');

-- Update test0@gmail.com if it exists  
UPDATE users 
SET id = (SELECT au.id FROM auth.users au WHERE au.email = 'test0@gmail.com')
WHERE email = 'test0@gmail.com'
AND EXISTS (SELECT 1 FROM auth.users WHERE email = 'test0@gmail.com');