-- Add RLS policy for modules table to allow everyone to view modules
ALTER TABLE public.modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view modules" 
ON public.modules 
FOR SELECT 
USING (true);