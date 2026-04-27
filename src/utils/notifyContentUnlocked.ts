import { supabase } from '@/integrations/supabase/client';

/**
 * Calls the notify-content-unlocked Edge Function to send an email
 * and in-app notification when a recording/assignment is unlocked.
 */
export async function notifyContentUnlocked(userId: string, recordingId: string): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('notify-content-unlocked', {
      body: { user_id: userId, recording_id: recordingId },
    });
    if (error) {
      console.warn('Failed to send unlock notification:', error.message);
    }
  } catch (err) {
    console.warn('Error calling notify-content-unlocked:', err);
  }
}
