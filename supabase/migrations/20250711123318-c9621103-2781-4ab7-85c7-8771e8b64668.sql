-- Check if RLS is enabled on users table and disable it for login functionality
-- Since we need unauthenticated users to be able to query the users table for login,
-- we need to either disable RLS or create appropriate policies

-- Disable RLS on users table to allow login queries
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Alternative: If you want to keep RLS enabled, uncomment the lines below instead:
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- 
-- CREATE POLICY "Allow public read for login" 
-- ON public.users 
-- FOR SELECT 
-- USING (true);