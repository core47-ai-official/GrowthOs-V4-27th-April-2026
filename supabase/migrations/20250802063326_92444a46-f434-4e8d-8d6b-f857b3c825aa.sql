-- Update SMTP configuration with provided credentials
UPDATE public.company_settings 
SET 
  smtp_host = 'smtp.gmail.com',
  smtp_port = 587,
  smtp_username = 'info@idmpakistan.pk',
  smtp_password = 'inkx ylnl uvxs wnwe',
  smtp_secure = true,
  lms_from_email = 'info@idmpakistan.pk',
  lms_from_name = 'IDM Pakistan',
  invoice_from_email = 'info@idmpakistan.pk',
  invoice_from_name = 'IDM Pakistan Billing',
  updated_at = now()
WHERE id = 1;

-- Insert default settings if no record exists
INSERT INTO public.company_settings (
  id, smtp_host, smtp_port, smtp_username, smtp_password, smtp_secure,
  lms_from_email, lms_from_name, invoice_from_email, invoice_from_name,
  created_at, updated_at
)
SELECT 
  1, 'smtp.gmail.com', 587, 'info@idmpakistan.pk', 'inkx ylnl uvxs wnwe', true,
  'info@idmpakistan.pk', 'IDM Pakistan', 'info@idmpakistan.pk', 'IDM Pakistan Billing',
  now(), now()
WHERE NOT EXISTS (SELECT 1 FROM public.company_settings WHERE id = 1);