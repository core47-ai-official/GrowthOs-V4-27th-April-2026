-- Create new user record with correct auth ID
INSERT INTO users (
  id, email, full_name, role, phone, status, created_at, 
  onboarding_done, lms_user_id, lms_password, meta_ads_credentials, 
  shopify_credentials
) 
SELECT 
  '10adf039-8565-46c2-86e9-fcc46e172878', 
  email, full_name, role, phone, status, created_at,
  onboarding_done, lms_user_id, lms_password, meta_ads_credentials,
  shopify_credentials
FROM users 
WHERE email = 'umaridmpakistan@gmail.com' AND id = '4af89070-ca6f-4d94-86a4-6ea9f8e714f8';

-- Update foreign key references to point to the new user ID
UPDATE available_lessons 
SET uploaded_by = '10adf039-8565-46c2-86e9-fcc46e172878'
WHERE uploaded_by = '4af89070-ca6f-4d94-86a4-6ea9f8e714f8';

-- Delete the old user record
DELETE FROM users WHERE id = '4af89070-ca6f-4d94-86a4-6ea9f8e714f8';