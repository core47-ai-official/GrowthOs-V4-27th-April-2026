-- Create RLS policies for user_activity_logs to fix the access issues
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own activity logs
CREATE POLICY "Users can insert their own activity logs" 
ON public.user_activity_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to view their own activity logs
CREATE POLICY "Users can view their own activity logs" 
ON public.user_activity_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Refresh the schema cache to ensure column names are recognized
NOTIFY pgrst, 'reload schema';