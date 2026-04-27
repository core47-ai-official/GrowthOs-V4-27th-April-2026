-- Enable Row Level Security on success_sessions table
ALTER TABLE public.success_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to view success sessions
CREATE POLICY "Everyone can view success sessions" 
ON public.success_sessions 
FOR SELECT 
USING (true);