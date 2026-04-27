-- Add SMTP configuration fields to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN smtp_host TEXT,
ADD COLUMN smtp_port INTEGER DEFAULT 587,
ADD COLUMN smtp_user TEXT,
ADD COLUMN smtp_password TEXT,
ADD COLUMN smtp_use_tls BOOLEAN DEFAULT true,

-- Invoice SMTP settings (separate from regular email SMTP)
ADD COLUMN invoice_smtp_host TEXT,
ADD COLUMN invoice_smtp_port INTEGER DEFAULT 587,
ADD COLUMN invoice_smtp_user TEXT,
ADD COLUMN invoice_smtp_password TEXT,
ADD COLUMN invoice_smtp_use_tls BOOLEAN DEFAULT true;