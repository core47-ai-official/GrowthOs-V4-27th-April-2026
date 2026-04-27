-- Create student onboarding jobs table for async processing
CREATE TYPE onboarding_step AS ENUM ('EMAIL', 'INVOICE');
CREATE TYPE onboarding_status AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'RETRY');

CREATE TABLE public.student_onboarding_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  step onboarding_step NOT NULL,
  status onboarding_status NOT NULL DEFAULT 'PENDING',
  retries INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.student_onboarding_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all onboarding jobs" 
ON public.student_onboarding_jobs 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
));

CREATE POLICY "System can manage onboarding jobs" 
ON public.student_onboarding_jobs 
FOR ALL 
USING (auth.role() = 'service_role');

-- Create index for efficient worker polling
CREATE INDEX idx_onboarding_jobs_status_step ON public.student_onboarding_jobs (status, step);
CREATE INDEX idx_onboarding_jobs_student_id ON public.student_onboarding_jobs (student_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.update_onboarding_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_onboarding_jobs_updated_at
BEFORE UPDATE ON public.student_onboarding_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_onboarding_jobs_updated_at();

-- Function to enqueue onboarding jobs
CREATE OR REPLACE FUNCTION public.enqueue_student_onboarding_jobs(p_student_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Insert EMAIL job
  INSERT INTO public.student_onboarding_jobs (student_id, step, status)
  VALUES (p_student_id, 'EMAIL', 'PENDING');
  
  -- Insert INVOICE job
  INSERT INTO public.student_onboarding_jobs (student_id, step, status)
  VALUES (p_student_id, 'INVOICE', 'PENDING');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;