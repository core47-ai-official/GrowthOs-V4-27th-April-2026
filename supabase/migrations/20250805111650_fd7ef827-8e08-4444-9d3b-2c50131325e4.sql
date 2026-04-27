-- Fix RLS policies for company_settings table and company-branding storage bucket

-- Enable RLS on company_settings if not already enabled
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Staff can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Superadmins can manage company settings" ON public.company_settings;

-- Create RLS policies for company_settings table
CREATE POLICY "Staff can view company settings" 
ON public.company_settings 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'enrollment_manager'::text, 'mentor'::text, 'superadmin'::text]));

CREATE POLICY "Superadmins can manage company settings" 
ON public.company_settings 
FOR ALL 
USING (get_current_user_role() = 'superadmin'::text)
WITH CHECK (get_current_user_role() = 'superadmin'::text);

-- Drop existing storage policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Company branding is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can upload company branding" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can update company branding" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can delete company branding" ON storage.objects;

-- Create RLS policies for company-branding storage bucket
CREATE POLICY "Company branding is publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'company-branding');

CREATE POLICY "Superadmins can upload company branding" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'company-branding' 
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  )
);

CREATE POLICY "Superadmins can update company branding" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'company-branding' 
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  )
)
WITH CHECK (
  bucket_id = 'company-branding' 
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  )
);

CREATE POLICY "Superadmins can delete company branding" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'company-branding' 
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'superadmin'
  )
);