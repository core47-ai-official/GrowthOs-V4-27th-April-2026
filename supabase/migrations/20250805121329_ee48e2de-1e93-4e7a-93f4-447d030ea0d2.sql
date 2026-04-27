-- For tenants table (if it needs policies)
CREATE POLICY "Superadmins can manage tenants" ON public.tenants
FOR ALL USING (get_current_user_role() = 'superadmin');