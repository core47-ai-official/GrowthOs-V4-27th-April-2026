-- Add submission_type to assignments table to control how students can submit
ALTER TABLE assignments 
ADD COLUMN submission_type text NOT NULL DEFAULT 'text' 
CHECK (submission_type IN ('text', 'links', 'attachments'));

-- Update submissions table to support different submission types
ALTER TABLE submissions 
ADD COLUMN links jsonb,
ADD COLUMN file_urls jsonb;

-- Create storage bucket for assignment submissions
INSERT INTO storage.buckets (id, name, public) 
VALUES ('assignment-submissions', 'assignment-submissions', false);

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