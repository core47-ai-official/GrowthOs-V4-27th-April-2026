-- Fix all database inconsistencies and add missing functions

-- Create missing database functions
CREATE OR REPLACE FUNCTION public.update_company_branding(branding_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  UPDATE public.company_settings 
  SET branding = branding_data
  WHERE id = 1;
  
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (id, branding)
    VALUES (1, branding_data);
  END IF;
  
  result := json_build_object('success', true);
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_lms_status(user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT COALESCE(lms_status, 'inactive') FROM public.users WHERE id = user_id;
$$;

-- Fix student_integrations table to support multiple connection types  
CREATE TABLE IF NOT EXISTS public.student_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shopify_api_token text,
  shop_domain text,
  meta_api_token text,
  is_shopify_connected boolean DEFAULT false,
  is_meta_connected boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS on student_integrations
ALTER TABLE public.student_integrations ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for student_integrations
CREATE POLICY "Users can view their own integrations" 
ON public.student_integrations 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own integrations" 
ON public.student_integrations 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations" 
ON public.student_integrations 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all integrations" 
ON public.student_integrations 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
));

-- Add assignment_id field to assignment_submissions if missing
DO $$
BEGIN
  -- Check if assignment_id column exists and is UUID type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'assignment_submissions' 
    AND column_name = 'assignment_id' 
    AND data_type = 'uuid'
  ) THEN
    -- If it's text, convert to UUID
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'assignment_submissions' 
      AND column_name = 'assignment_id' 
      AND data_type = 'text'
    ) THEN
      -- Convert existing text UUIDs to proper UUID type
      ALTER TABLE public.assignment_submissions 
      ALTER COLUMN assignment_id TYPE uuid USING assignment_id::uuid;
    END IF;
  END IF;
END $$;

-- Create user_unlocks table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  module_id uuid REFERENCES public.modules(id) ON DELETE CASCADE,
  recording_id uuid REFERENCES public.available_lessons(id) ON DELETE CASCADE,
  unlocked_at timestamp with time zone DEFAULT now(),
  unlock_type text NOT NULL CHECK (unlock_type IN ('module', 'recording')),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on user_unlocks
ALTER TABLE public.user_unlocks ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for user_unlocks
CREATE POLICY "Users can view their own unlocks" 
ON public.user_unlocks 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own unlocks" 
ON public.user_unlocks 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all unlocks" 
ON public.user_unlocks 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.users 
  WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
));

-- Add updated_at trigger to student_integrations
CREATE TRIGGER update_student_integrations_updated_at
  BEFORE UPDATE ON public.student_integrations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();