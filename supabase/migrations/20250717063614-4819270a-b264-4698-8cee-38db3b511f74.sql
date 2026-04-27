-- Add last_suspended_date column to users table
ALTER TABLE public.users 
ADD COLUMN last_suspended_date timestamp with time zone;