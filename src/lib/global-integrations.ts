import { StudentIntegrations } from './student-integrations';
import { logger } from './logger';

// Integration status event for cross-component communication
export interface IntegrationStatus {
  shopifyConnected: boolean;
  metaConnected: boolean;
}

export async function initializeGlobalIntegrations(userId: string) {
  const checkIntegrations = async () => {
    try {
      const integration = await StudentIntegrations.get(userId);
      
      // Use CustomEvent for decoupled communication instead of window property
      const navEvent = new CustomEvent('integrationStatusChanged', {
        detail: {
          shopifyConnected: integration?.is_shopify_connected || false,
          metaConnected: integration?.is_meta_connected || false
        } as IntegrationStatus
      });
      
      window.dispatchEvent(navEvent);
    } catch (error) {
      logger.error('Error checking integrations:', error);
    }
  };

  // Initial check
  await checkIntegrations();
  
  // Return cleanup-friendly reference
  return checkIntegrations;
}