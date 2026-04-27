-- Add mentor_id column to assignment table
ALTER TABLE public.assignment 
ADD COLUMN mentor_id UUID REFERENCES public.users(id);

-- Add index for better query performance
CREATE INDEX idx_assignment_mentor_id ON public.assignment(mentor_id);