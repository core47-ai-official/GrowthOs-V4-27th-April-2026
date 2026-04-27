-- Add new columns to assignments table for enhanced functionality
ALTER TABLE public.assignments 
ADD COLUMN due_days integer DEFAULT 7,
ADD COLUMN recording_id uuid REFERENCES public.available_lessons(id),
ADD COLUMN submission_type text DEFAULT 'text' CHECK (submission_type IN ('text', 'file', 'link')),
ADD COLUMN instructions text;