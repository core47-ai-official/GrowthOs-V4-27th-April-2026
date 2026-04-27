-- Add RLS policy to allow everyone to view session recordings
ALTER TABLE public.session_recordings ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view all session recordings
CREATE POLICY "Everyone can view session recordings" 
ON public.session_recordings 
FOR SELECT 
USING (true);