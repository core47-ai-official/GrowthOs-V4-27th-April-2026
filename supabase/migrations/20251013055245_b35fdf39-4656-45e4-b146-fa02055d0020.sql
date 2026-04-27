-- Update currency defaults to PKR throughout the database

-- Update company_settings table default currency to PKR
ALTER TABLE public.company_settings 
  ALTER COLUMN currency SET DEFAULT 'PKR';

-- Update any existing USD references to PKR in company_settings
UPDATE public.company_settings 
SET currency = 'PKR' 
WHERE currency = 'USD' OR currency IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.company_settings.currency IS 'Currency code (default: PKR). Examples: PKR, USD, EUR, GBP, INR. Configurable via VITE_DEFAULT_CURRENCY env variable.';