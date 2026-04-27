-- Fix infinite recursion in users table RLS policies
-- Problem: Policies were querying the users table within policies on the users table

-- First, drop all existing policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own record" ON users;
DROP POLICY IF EXISTS "Students can view own profile" ON users;
DROP POLICY IF EXISTS "Admins can view users" ON users;
DROP POLICY IF EXISTS "Superadmins can view all users" ON users;
DROP POLICY IF EXISTS "Superadmins full access" ON users;
DROP POLICY IF EXISTS "Superadmins have full access to users" ON users;
DROP POLICY IF EXISTS "Mentors can view users" ON users;
DROP POLICY IF EXISTS "Enrollment managers can view users" ON users;
DROP POLICY IF EXISTS "Staff can view user data" ON users;
DROP POLICY IF EXISTS "Admins and enrollment managers can manage users" ON users;
DROP POLICY IF EXISTS "Restrict sensitive user data access" ON users;
DROP POLICY IF EXISTS "Users can update their own password" ON users;
DROP POLICY IF EXISTS "Students can set status completed when eligible" ON users;

-- Create new simplified policies that don't cause recursion
-- Key change: Use auth.jwt() to get role from JWT claims instead of querying users table

-- Allow users to view their own record
CREATE POLICY "users_select_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow users to update their own password-related fields
CREATE POLICY "users_update_own_password"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow INSERT for authenticated users (needed during login when user doesn't exist yet)
-- This allows the application to create user records during first login
CREATE POLICY "users_insert_authenticated"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admin/Superadmin access using JWT claims
-- These users can view all records
CREATE POLICY "users_select_admin"
  ON users FOR SELECT
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt()->>'user_metadata')::jsonb->>'role',
      ''
    ) IN ('admin', 'superadmin', 'enrollment_manager', 'mentor')
  );

-- Admin/Superadmin can update any user
CREATE POLICY "users_update_admin"
  ON users FOR UPDATE
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt()->>'user_metadata')::jsonb->>'role',
      ''
    ) IN ('admin', 'superadmin', 'enrollment_manager')
  );

-- Admin/Superadmin can delete users
CREATE POLICY "users_delete_admin"
  ON users FOR DELETE
  TO authenticated
  USING (
    COALESCE(
      (auth.jwt()->>'user_metadata')::jsonb->>'role',
      ''
    ) IN ('admin', 'superadmin')
  );

-- Admin/Superadmin can insert new users
CREATE POLICY "users_insert_admin"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (
    COALESCE(
      (auth.jwt()->>'user_metadata')::jsonb->>'role',
      ''
    ) IN ('admin', 'superadmin', 'enrollment_manager')
  );