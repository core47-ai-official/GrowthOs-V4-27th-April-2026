-- Add temp_password column to users table for credential viewing
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS temp_password TEXT;