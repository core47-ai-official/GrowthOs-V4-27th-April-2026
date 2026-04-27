import { useCompanyLogo } from "@/hooks/useCompanyBranding";
import { safeLogger } from '@/lib/safe-logger';
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface AppLogoProps {
  variant?: 'header' | 'favicon' | 'original';
  className?: string;
  alt?: string;
}

export function AppLogo({ variant = 'header', className = "h-10 w-auto max-w-[200px]", alt = "Company Logo" }: AppLogoProps) {
  const logoUrl = useCompanyLogo();
  const [companyName, setCompanyName] = useState<string>('GrowthOS');
  const [isLoading, setIsLoading] = useState(true);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('company_name, branding')
          .eq('id', 1)
          .maybeSingle();

        safeLogger.debug('AppLogo - Company settings data', { data });
        setDebugInfo(data);

        if (!error && data) {
          if (data.company_name) {
            setCompanyName(data.company_name);
          }
        }
      } catch (error) {
        console.error('Error fetching company data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCompanyData();
  }, []);

  safeLogger.info('AppLogo - logoUrl and debug:', { logoUrl, debugInfo });

  // Show loading state only while fetching company data
  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg font-semibold text-sm animate-pulse`}>
        Loading...
      </div>
    );
  }

  // If no logo is set, show company name as fallback
  if (!logoUrl) {
    safeLogger.info('AppLogo - No logo URL found, showing company name fallback');
    return (
      <div className={`${className} flex items-center justify-center bg-gradient-to-r from-primary to-primary/80 text-primary-foreground rounded-lg font-semibold text-sm`}>
        {companyName}
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt={alt}
      className={`${className} object-contain`}
      onError={(e) => {
        console.error('AppLogo - Failed to load image:', logoUrl);
        // If image fails to load, hide the element
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
      }}
    />
  );
}