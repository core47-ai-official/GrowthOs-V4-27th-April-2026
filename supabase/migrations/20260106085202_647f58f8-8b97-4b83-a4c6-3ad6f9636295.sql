-- Add max_installments column to courses table
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS max_installments integer DEFAULT NULL;

-- Add max_installments column to learning_pathways table
ALTER TABLE public.learning_pathways 
ADD COLUMN IF NOT EXISTS max_installments integer DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.courses.max_installments IS 'Maximum number of installments allowed for this course (1-12). NULL means use company default.';
COMMENT ON COLUMN public.learning_pathways.max_installments IS 'Maximum number of installments allowed for this pathway (1-12). NULL means use company default.';