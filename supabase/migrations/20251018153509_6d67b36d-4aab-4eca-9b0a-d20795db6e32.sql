-- Create error_logs table to track all system errors
CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  error_type text NOT NULL CHECK (error_type IN ('ui', 'database', 'api', 'network', 'validation', 'auth', 'integration', 'unknown')),
  error_code text,
  error_message text NOT NULL,
  error_details jsonb,
  stack_trace text,
  url text,
  user_agent text,
  severity text NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for faster querying
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_type ON public.error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Superadmins can view all error logs
CREATE POLICY "Superadmins can view all error logs"
ON public.error_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'superadmin'
  )
);

-- System can insert error logs
CREATE POLICY "System can insert error logs"
ON public.error_logs
FOR INSERT
WITH CHECK (true);

-- Superadmins can update error logs (mark as resolved)
CREATE POLICY "Superadmins can update error logs"
ON public.error_logs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role = 'superadmin'
  )
);

-- Add comment
COMMENT ON TABLE public.error_logs IS 'Stores all system errors for monitoring and debugging';