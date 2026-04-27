-- Add drip_enabled column to learning_pathways table
ALTER TABLE public.learning_pathways 
ADD COLUMN IF NOT EXISTS drip_enabled BOOLEAN DEFAULT NULL;