import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface ScheduledSuspension {
  id: string;
  user_id: string;
  schedule_suspend_date: string;
  reason: string | null;
  status: string; // 'active' | 'executed' | 'cancelled'
  auto_unsuspend_date: string | null;
  created_by: string | null;
  created_at: string;
  executed_at: string | null;
  cancelled_at: string | null;
}

/**
 * Hook to manage scheduled suspensions.
 * Uses the `scheduled_suspensions` table.
 */
export function useScheduledSuspensions(userIds?: string[]) {
  const [suspensions, setSuspensions] = useState<Map<string, ScheduledSuspension>>(new Map());
  const [loading, setLoading] = useState(false);

  const fetchSuspensions = useCallback(async (ids?: string[]) => {
    const targetIds = ids || userIds;
    if (!targetIds || targetIds.length === 0) {
      setSuspensions(new Map());
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('scheduled_suspensions' as any)
        .select('*')
        .in('user_id', targetIds)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) {
        // Table might not exist yet
        logger.warn('Could not fetch scheduled suspensions:', error);
        setSuspensions(new Map());
        return;
      }

      const map = new Map<string, ScheduledSuspension>();
      (data || []).forEach((s: any) => {
        // Only keep the latest active one per user
        if (!map.has(s.user_id)) {
          map.set(s.user_id, s as ScheduledSuspension);
        }
      });
      setSuspensions(map);
    } catch (err) {
      logger.warn('Error fetching scheduled suspensions:', err);
    } finally {
      setLoading(false);
    }
  }, [userIds?.join(',')]);

  useEffect(() => {
    if (userIds && userIds.length > 0) {
      fetchSuspensions();
    }
  }, [userIds?.join(',')]);

  const createScheduledSuspension = async (params: {
    userId: string;
    scheduleSuspendDate: Date;
    reason: string;
    autoUnsuspendDate?: Date;
    createdBy: string | null;
  }) => {
    try {
      // Cancel any existing active scheduled suspension for this user
      await supabase
        .from('scheduled_suspensions' as any)
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() } as any)
        .eq('user_id', params.userId)
        .eq('status', 'active');

      // Create new scheduled suspension
      const { data, error } = await supabase
        .from('scheduled_suspensions' as any)
        .insert({
          user_id: params.userId,
          schedule_suspend_date: params.scheduleSuspendDate.toISOString(),
          reason: params.reason || null,
          auto_unsuspend_date: params.autoUnsuspendDate?.toISOString() || null,
          status: 'active',
          created_by: params.createdBy,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      logger.error('Error creating scheduled suspension:', error);
      return { data: null, error };
    }
  };

  const cancelScheduledSuspension = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_suspensions' as any)
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() } as any)
        .eq('user_id', userId)
        .eq('status', 'active');

      if (error) throw error;

      // Remove from local state
      setSuspensions(prev => {
        const next = new Map(prev);
        next.delete(userId);
        return next;
      });

      return { error: null };
    } catch (error) {
      logger.error('Error cancelling scheduled suspension:', error);
      return { error };
    }
  };

  return {
    suspensions,
    loading,
    fetchSuspensions,
    createScheduledSuspension,
    cancelScheduledSuspension,
  };
}
