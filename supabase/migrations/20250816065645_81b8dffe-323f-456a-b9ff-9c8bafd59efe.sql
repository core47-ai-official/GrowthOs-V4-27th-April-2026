-- Update submissions table to support different submission types (only add missing columns)
ALTER TABLE submissions 
ADD COLUMN IF NOT EXISTS links jsonb,
ADD COLUMN IF NOT EXISTS file_urls jsonb;

-- Create storage bucket for assignment submissions if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-submissions', 'assignment-submissions', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for assignment submissions bucket
CREATE POLICY "Students can upload their own assignment files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can view their own assignment files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Staff can view all assignment files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'assignment-submissions' 
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text, 'mentor'::text, 'enrollment_manager'::text])
);

CREATE POLICY "Students can update their own assignment files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Students can delete their own assignment files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'assignment-submissions' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);