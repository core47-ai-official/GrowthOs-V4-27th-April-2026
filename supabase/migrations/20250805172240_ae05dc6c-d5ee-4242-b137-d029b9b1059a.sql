-- Add custom_domain column to company_settings table
ALTER TABLE public.company_settings 
ADD COLUMN custom_domain TEXT DEFAULT 'https://majqoqagohicjigmsilu.lovable.app';