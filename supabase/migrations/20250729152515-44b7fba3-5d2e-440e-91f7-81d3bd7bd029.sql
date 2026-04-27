-- Add unified SMTP configuration to company_settings
-- Remove separate invoice/lms email fields and add unified sender configuration

ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS smtp_sender_email TEXT,
ADD COLUMN IF NOT EXISTS smtp_sender_name TEXT;

-- Migration data: Move existing email configs to unified fields
UPDATE public.company_settings 
SET 
  smtp_sender_email = COALESCE(invoice_from_email, lms_from_email),
  smtp_sender_name = COALESCE(invoice_from_name, lms_from_name)
WHERE id = 1;

-- Create sync function for Supabase SMTP configuration
CREATE OR REPLACE FUNCTION public.sync_supabase_smtp_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_settings RECORD;
  v_result json;
BEGIN
  -- Get current SMTP settings
  SELECT 
    smtp_enabled,
    smtp_host,
    smtp_port,
    smtp_username,
    smtp_password,
    smtp_encryption,
    smtp_sender_email,
    smtp_sender_name
  INTO v_settings
  FROM public.company_settings
  WHERE id = 1;
  
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Company settings not found'
    );
  END IF;
  
  -- Validate required fields
  IF NOT v_settings.smtp_enabled OR 
     v_settings.smtp_host IS NULL OR 
     v_settings.smtp_username IS NULL OR 
     v_settings.smtp_password IS NULL OR
     v_settings.smtp_sender_email IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'SMTP configuration incomplete'
    );
  END IF;
  
  -- Return success with config for edge function to process
  v_result := json_build_object(
    'success', true,
    'config', json_build_object(
      'host', v_settings.smtp_host,
      'port', v_settings.smtp_port,
      'username', v_settings.smtp_username,
      'password', v_settings.smtp_password,
      'encryption', v_settings.smtp_encryption,
      'sender_email', v_settings.smtp_sender_email,
      'sender_name', v_settings.smtp_sender_name
    )
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$function$;