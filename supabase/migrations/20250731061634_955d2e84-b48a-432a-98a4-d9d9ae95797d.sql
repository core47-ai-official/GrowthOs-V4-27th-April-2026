-- Create the missing functions that are causing TypeScript errors
CREATE OR REPLACE FUNCTION public.update_company_branding(branding_data jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  UPDATE public.company_settings 
  SET branding = branding_data,
      updated_at = now()
  WHERE id = 1;
  
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (id, branding, created_at, updated_at)
    VALUES (1, branding_data, now(), now());
  END IF;
  
  result := json_build_object('success', true, 'branding', branding_data);
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