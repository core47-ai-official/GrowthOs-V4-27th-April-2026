import { useEffect } from 'react';
import { getLogoVariants, updateFavicon } from '@/hooks/useCompanyBranding';
import { logger } from '@/lib/logger';

export function DynamicFavicon() {
  useEffect(() => {
    const updateAppFavicon = async () => {
      try {
        const variants = await getLogoVariants();
        if (variants && typeof variants === 'object' && 'favicon' in variants && variants.favicon) {
          updateFavicon(variants.favicon);
        }
      } catch (error) {
        logger.error('Error updating favicon:', error);
      }
    };

    updateAppFavicon();
  }, []);

  return null; // This component doesn't render anything
}