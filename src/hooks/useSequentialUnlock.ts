import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

interface SequentialUnlockStatus {
  isEnabled: boolean;
  firstRecordingUnlocked: boolean;
  feesCleared: boolean;
}

export const useSequentialUnlock = () => {
  const { user } = useAuth();
  const [status, setStatus] = useState<SequentialUnlockStatus>({
    isEnabled: false,
    firstRecordingUnlocked: false,
    feesCleared: false
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSequentialUnlockStatus();
    }
  }, [user?.id]);

  const fetchSequentialUnlockStatus = async () => {
    if (!user?.id) return;

    try {
      // Sequential unlock is always enabled (hardcoded behavior)
      const isEnabled = true;

      // Get student fees status
      const { data: studentData } = await supabase
        .from('students')
        .select('fees_cleared')
        .eq('user_id', user.id)
        .maybeSingle();

      const feesCleared = studentData?.fees_cleared || false;

      // Check if first recording is unlocked
      const { data: firstRecording } = await supabase
        .from('available_lessons')
        .select('id')
        .order('sequence_order', { ascending: true })
        .limit(1)
        .maybeSingle();

      let firstRecordingUnlocked = false;
      if (firstRecording && feesCleared) {
        const { data: unlockData } = await supabase
          .from('user_unlocks')
          .select('is_unlocked')
          .eq('user_id', user.id)
          .eq('recording_id', firstRecording.id)
          .maybeSingle();

        firstRecordingUnlocked = unlockData?.is_unlocked || false;
      }

      setStatus({
        isEnabled,
        firstRecordingUnlocked,
        feesCleared
      });

    } catch (error) {
      logger.error('Error fetching sequential unlock status:', error);
    } finally {
      setLoading(false);
    }
  };

  const initializeFirstRecordingUnlock = async () => {
    if (!user?.id) return;

    try {
      // Use the database function to properly initialize first recording unlock
      await supabase.rpc('initialize_first_recording_unlock', {
        p_user_id: user.id
      });

      // Refresh the status after initializing
      await fetchSequentialUnlockStatus();
      
    } catch (error) {
      logger.error('Error initializing first recording unlock:', error);
    }
  };

  return {
    status,
    loading,
    initializeFirstRecordingUnlock,
    refreshStatus: fetchSequentialUnlockStatus
  };
};