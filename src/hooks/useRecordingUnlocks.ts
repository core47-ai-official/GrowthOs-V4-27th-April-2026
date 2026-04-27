import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';

interface RecordingUnlock {
  recording_id: string;
  sequence_order: number;
  is_unlocked: boolean;
  unlock_reason: string;
  assignment_required: boolean;
  assignment_completed: boolean;
  recording_watched: boolean;
  drip_locked: boolean;
  drip_unlock_date: string | null;
}

export const useRecordingUnlocks = () => {
  const { user } = useAuth();
  const [unlocks, setUnlocks] = useState<RecordingUnlock[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchUnlocks();
    }
  }, [user?.id]);

  // Listen for submission approvals and other status changes to refresh unlock status
  useEffect(() => {
    if (!user?.id) return;

    // Set up real-time listener for changes that affect unlock status
    const channel = supabase
      .channel('unlock-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `student_id=eq.${user.id}`
        },
        () => {
          logger.debug('Submission status changed, refreshing unlocks...');
          fetchUnlocks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recording_views',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          logger.debug('Recording view status changed, refreshing unlocks...');
          fetchUnlocks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'students',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          logger.debug('Student fees status changed, refreshing unlocks...');
          fetchUnlocks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'user_unlocks',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          logger.debug('New recording unlocked, refreshing unlocks...');
          fetchUnlocks();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_unlocks',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          logger.debug('Recording unlock status updated, refreshing unlocks...');
          fetchUnlocks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const fetchUnlocks = async () => {
    if (!user?.id) return;

    try {
      logger.debug('Fetching unlock status for user:', { userId: user.id });
      
      // Always use sequential unlock logic (hardcoded behavior)
      const { data, error } = await supabase.rpc('get_sequential_unlock_status', {
        p_user_id: user.id
      });

      if (error) {
        logger.error('Error fetching sequential unlock status:', error);
        throw error;
      }

      // Transform to match existing interface with new fields
      const transformedData = (data || []).map(item => ({
        recording_id: item.recording_id,
        sequence_order: item.sequence_order,
        is_unlocked: item.is_unlocked,
        unlock_reason: item.unlock_reason,
        assignment_required: item.assignment_required,
        assignment_completed: item.assignment_completed,
        recording_watched: item.recording_watched,
        drip_locked: item.drip_locked || false,
        drip_unlock_date: item.drip_unlock_date || null
      }));

      logger.debug('Sequential unlock data:', { data: transformedData });
      setUnlocks(transformedData);
    } catch (error) {
      logger.error('Error fetching recording unlocks:', error);
      // No fallback - maintain strict sequential behavior
      setUnlocks([]);
    } finally {
      setLoading(false);
    }
  };

  const isRecordingUnlocked = (recordingId: string) => {
    const unlock = unlocks.find(unlock => unlock.recording_id === recordingId);
    return unlock?.is_unlocked || false;
  };

  const getRecordingStatus = (recordingId: string) => {
    return unlocks.find(unlock => unlock.recording_id === recordingId);
  };

  const refreshUnlocks = () => {
    setLoading(true);
    fetchUnlocks();
  };

  return {
    unlocks,
    loading,
    isRecordingUnlocked,
    getRecordingStatus,
    refreshUnlocks
  };
};