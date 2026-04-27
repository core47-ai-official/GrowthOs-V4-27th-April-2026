-- Fix RLS policies to avoid user_metadata security issues
-- Remove policies that check JWT claims, use simpler access control

-- Drop the insecure policies
DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_update_admin" ON users;
DROP POLICY IF EXISTS "users_delete_admin" ON users;
DROP POLICY IF EXISTS "users_insert_admin" ON users;

-- Keep the safe policies for users accessing their own records
-- These policies already exist and are secure:
-- - users_select_own: Users can view their own record
-- - users_update_own_password: Users can update their own record
-- - users_insert_authenticated: Authenticated users can create their own record

-- For admin access, we'll use edge functions instead of RLS policies
-- This avoids the security issues with checking roles in RLS

-- Allow service role to bypass RLS (for edge functions)
-- This ensures edge functions with service role can manage users