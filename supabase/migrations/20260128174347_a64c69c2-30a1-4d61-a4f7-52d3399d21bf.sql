-- Create storage bucket for cover images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('cover-images', 'cover-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to view cover images
CREATE POLICY "Anyone can view cover images"
ON storage.objects FOR SELECT
USING (bucket_id = 'cover-images');

-- Allow admins and superadmins to upload cover images
CREATE POLICY "Admins can upload cover images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'cover-images' 
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Allow admins and superadmins to update cover images  
CREATE POLICY "Admins can update cover images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'cover-images'
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);

-- Allow admins and superadmins to delete cover images
CREATE POLICY "Admins can delete cover images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'cover-images'
  AND EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'superadmin')
  )
);