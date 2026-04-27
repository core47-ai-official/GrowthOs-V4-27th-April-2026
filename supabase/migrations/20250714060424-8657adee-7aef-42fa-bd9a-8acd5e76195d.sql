-- Add RLS policies for assignment table
ALTER TABLE public.assignment ENABLE ROW LEVEL SECURITY;

-- Allow everyone to view assignments (students need to see them)
CREATE POLICY "Everyone can view assignments" 
ON public.assignment 
FOR SELECT 
USING (true);

-- Add RLS policies for assignment_submissions table  
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own submissions
CREATE POLICY "Users can view their own submissions" 
ON public.assignment_submissions 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow users to insert their own submissions
CREATE POLICY "Users can insert their own submissions" 
ON public.assignment_submissions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own submissions (if not yet reviewed)
CREATE POLICY "Users can update their own unreviewed submissions" 
ON public.assignment_submissions 
FOR UPDATE 
USING (auth.uid() = user_id AND reviewed_at IS NULL);

-- Add foreign key constraint for assignment_id in submissions
ALTER TABLE public.assignment_submissions 
ADD CONSTRAINT fk_assignment_submissions_assignment_id 
FOREIGN KEY (assignment_id) REFERENCES public.assignment(assignment_id) ON DELETE CASCADE;

-- Add trigger for updated_at timestamp on assignment_submissions
ALTER TABLE public.assignment_submissions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();

CREATE TRIGGER update_assignment_submissions_updated_at
BEFORE UPDATE ON public.assignment_submissions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_assignment_sequence_order ON public.assignment(sequence_order);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_user_id ON public.assignment_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id ON public.assignment_submissions(assignment_id);