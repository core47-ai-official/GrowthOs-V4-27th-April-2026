-- Enable Row Level Security on user_security_summary table
ALTER TABLE public.user_security_summary ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own security summary
CREATE POLICY "Users can view their own security summary" 
ON public.user_security_summary 
FOR SELECT 
USING (auth.uid() = id);

-- Policy: Admins and superadmins can view all security summaries
CREATE POLICY "Admins can view all user security summaries" 
ON public.user_security_summary 
FOR SELECT 
USING (get_current_user_role() = ANY (ARRAY['admin'::text, 'superadmin'::text]));

-- Policy: System can insert security summaries (for automated processes)
CREATE POLICY "System can insert user security summaries" 
ON public.user_security_summary 
FOR INSERT 
WITH CHECK (true);

-- Policy: System can update security summaries (for automated processes)
CREATE POLICY "System can update user security summaries" 
ON public.user_security_summary 
FOR UPDATE 
USING (true);