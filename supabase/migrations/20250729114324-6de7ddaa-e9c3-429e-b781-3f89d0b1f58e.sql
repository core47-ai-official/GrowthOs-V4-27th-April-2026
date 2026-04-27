-- Add SMTP configuration columns to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS smtp_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS smtp_host TEXT,
ADD COLUMN IF NOT EXISTS smtp_port INTEGER DEFAULT 587,
ADD COLUMN IF NOT EXISTS smtp_username TEXT,
ADD COLUMN IF NOT EXISTS smtp_password TEXT,
ADD COLUMN IF NOT EXISTS smtp_encryption TEXT DEFAULT 'STARTTLS' CHECK (smtp_encryption IN ('None', 'SSL/TLS', 'STARTTLS')),
ADD COLUMN IF NOT EXISTS invoice_from_email TEXT,
ADD COLUMN IF NOT EXISTS lms_from_email TEXT,
ADD COLUMN IF NOT EXISTS invoice_from_name TEXT,
ADD COLUMN IF NOT EXISTS lms_from_name TEXT;