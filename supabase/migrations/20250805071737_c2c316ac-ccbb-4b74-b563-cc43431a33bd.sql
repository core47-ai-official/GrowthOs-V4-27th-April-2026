-- Fix security issues for the new schema
-- Set proper search_path for functions to be security definer compliant

-- Update the student ID generation function with proper security
CREATE OR REPLACE FUNCTION public.generate_student_id()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.student_id IS NULL THEN
    NEW.student_id := 'STU' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1
       FROM public.students 
       WHERE student_id IS NOT NULL)::TEXT, 
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Update the updated_at function with proper security
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Create helper functions for RLS policies to avoid recursion
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT 
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- Recreate RLS policies using the helper function to be more secure
DROP POLICY IF EXISTS "Superadmins have full access to users" ON users;
DROP POLICY IF EXISTS "Admins and enrollment managers can manage users" ON users;
DROP POLICY IF EXISTS "Mentors can view users" ON users;

CREATE POLICY "Superadmins have full access to users" ON users
  FOR ALL USING (public.get_current_user_role() = 'superadmin');

CREATE POLICY "Admins and enrollment managers can manage users" ON users
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'enrollment_manager'));

CREATE POLICY "Mentors can view users" ON users
  FOR SELECT USING (public.get_current_user_role() = 'mentor');

-- Update installment plans policies
DROP POLICY IF EXISTS "Superadmins can manage installment plans" ON installment_plans;
DROP POLICY IF EXISTS "Staff can view installment plans" ON installment_plans;

CREATE POLICY "Superadmins can manage installment plans" ON installment_plans
  FOR ALL USING (public.get_current_user_role() = 'superadmin');

CREATE POLICY "Staff can view installment plans" ON installment_plans
  FOR SELECT USING (public.get_current_user_role() IN ('admin', 'enrollment_manager', 'mentor'));

-- Update students policies
DROP POLICY IF EXISTS "Superadmins have full access to students" ON students;
DROP POLICY IF EXISTS "Admins and enrollment managers can manage students" ON students;
DROP POLICY IF EXISTS "Mentors can view students" ON students;

CREATE POLICY "Superadmins have full access to students" ON students
  FOR ALL USING (public.get_current_user_role() = 'superadmin');

CREATE POLICY "Admins and enrollment managers can manage students" ON students
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'enrollment_manager'));

CREATE POLICY "Mentors can view students" ON students
  FOR SELECT USING (public.get_current_user_role() = 'mentor');

-- Update invoices policies
DROP POLICY IF EXISTS "Superadmins have full access to invoices" ON invoices;
DROP POLICY IF EXISTS "Admins and enrollment managers can manage invoices" ON invoices;
DROP POLICY IF EXISTS "Mentors can view invoices" ON invoices;

CREATE POLICY "Superadmins have full access to invoices" ON invoices
  FOR ALL USING (public.get_current_user_role() = 'superadmin');

CREATE POLICY "Admins and enrollment managers can manage invoices" ON invoices
  FOR ALL USING (public.get_current_user_role() IN ('admin', 'enrollment_manager'));

CREATE POLICY "Mentors can view invoices" ON invoices
  FOR SELECT USING (public.get_current_user_role() = 'mentor');