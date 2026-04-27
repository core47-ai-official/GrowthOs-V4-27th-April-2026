-- Create storage bucket for assignment files
INSERT INTO storage.buckets (id, name, public) VALUES ('assignment-files', 'assignment-files', true);

-- Create policies for assignment file uploads
CREATE POLICY "Users can upload their own assignment files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'assignment-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own assignment files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'assignment-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Assignment files are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'assignment-files');