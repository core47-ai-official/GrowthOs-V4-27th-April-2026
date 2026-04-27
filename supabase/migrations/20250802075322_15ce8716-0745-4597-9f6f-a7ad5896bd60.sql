-- Enable RLS on tables that don't have it
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_unlocks ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for batches
CREATE POLICY "Admins can manage all batches" 
ON public.batches 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
));

CREATE POLICY "Everyone can view batches" 
ON public.batches 
FOR SELECT 
USING (true);

-- Add RLS policies for tenants
CREATE POLICY "Superadmins can manage tenants" 
ON public.tenants 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = 'superadmin'
));

-- Add RLS policies for user_unlocks
CREATE POLICY "Users can view their own unlocks" 
ON public.user_unlocks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage user unlocks" 
ON public.user_unlocks 
FOR ALL 
USING (auth.role() = 'service_role');

CREATE POLICY "Admins can view all user unlocks" 
ON public.user_unlocks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role = ANY(ARRAY['admin', 'superadmin'])
));