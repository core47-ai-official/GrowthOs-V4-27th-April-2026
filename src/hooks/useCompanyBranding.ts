import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { getLogoUrl } from "@/utils/logoUtils";
import { safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';

// Hook to get company logo from settings
export const useCompanyLogo = () => {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  
  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const { data, error } = await supabase
          .from('company_settings')
          .select('branding')
          .eq('id', 1)
          .maybeSingle();

        if (error) {
          logger.error('Failed to fetch company branding', error);
          return;
        }

        if (data?.branding) {
          const headerLogo = getLogoUrl(data.branding, 'header');
          setLogoUrl(headerLogo);
        }
      } catch (error) {
        logger.error('Error fetching company logo:', error);
      }
    };

    fetchLogo();
  }, []);

  return logoUrl;
};

// Update favicon dynamically
export const updateFavicon = (faviconUrl: string) => {
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel*="icon"]');
  existingLinks.forEach(link => link.remove());

  // Add new favicon
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = faviconUrl;
  document.head.appendChild(link);
};

// Get all logo variants for a context
export const getLogoVariants = async () => {
  try {
    const { data, error } = await supabase
      .from('company_settings')
      .select('branding')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      logger.error('Failed to fetch company logo variants', error);
      return [];
    }

    if (data?.branding && typeof data.branding === 'object' && data.branding !== null) {
      const branding = data.branding as any;
      if (branding.logo) {
        return {
          original: branding.logo.original,
          favicon: branding.logo.favicon,
          header: branding.logo.header
        };
      }
    }

    return null;
  } catch (error) {
    logger.error('Error fetching logo variants:', error);
    return null;
  }
};