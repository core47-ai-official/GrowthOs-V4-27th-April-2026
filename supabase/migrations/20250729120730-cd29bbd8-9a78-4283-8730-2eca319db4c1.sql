-- Create storage bucket for company branding assets
INSERT INTO storage.buckets (id, name, public) 
VALUES ('company-branding', 'company-branding', true);

-- Add branding field to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN branding JSONB DEFAULT '{}';

-- Add comment for documentation
COMMENT ON COLUMN public.company_settings.branding IS 'Company branding assets including logo variants: {"logo": {"original": "url", "favicon": "url", "header": "url"}}';

-- Create storage policies for company branding
CREATE POLICY "Anyone can view company branding files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'company-branding');

CREATE POLICY "Superadmins can upload company branding" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'company-branding' AND 
  (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'))
);

CREATE POLICY "Superadmins can update company branding" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'company-branding' AND 
  (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'))
);

CREATE POLICY "Superadmins can delete company branding" 
ON storage.objects FOR DELETE 
USING (
  bucket_id = 'company-branding' AND 
  (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'superadmin'))
);