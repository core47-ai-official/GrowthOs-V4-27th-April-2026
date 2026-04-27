import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';

export async function triggerOnboardingProcessor() {
  try {
    safeLogger.info('Triggering onboarding processor');
    const { data, error } = await supabase.functions.invoke('process-onboarding-jobs', {
      body: {}
    });
    
    if (error) {
      console.error('Error triggering onboarding processor:', error);
      return { success: false, error };
    }
    
    safeLogger.info('Onboarding processor response', { success: true });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to trigger onboarding processor:', error);
    return { success: false, error };
  }
}