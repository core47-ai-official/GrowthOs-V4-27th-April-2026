-- Create company settings table with currency field
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT 'Your Company',
  primary_phone TEXT NOT NULL DEFAULT '',
  secondary_phone TEXT,
  address TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  currency TEXT NOT NULL DEFAULT 'USD',
  original_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 3000.00,
  maximum_installment_count INTEGER NOT NULL DEFAULT 3 CHECK (maximum_installment_count >= 1 AND maximum_installment_count <= 12),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_settings_row CHECK (id = 1)
);

-- Enable RLS on company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_settings (only superadmins can access)
CREATE POLICY "Superadmins can manage company settings" ON company_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
    )
  );

-- Insert default company settings
INSERT INTO company_settings (id, company_name, primary_phone, address, contact_email, currency) 
VALUES (1, 'Your Company', '+1 (555) 123-4567', '123 Business St, City, State 12345', 'contact@yourcompany.com', 'USD')
ON CONFLICT (id) DO NOTHING;

-- Add trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();