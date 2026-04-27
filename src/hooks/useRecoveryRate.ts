import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RecoveryStats {
  total_messages_sent: number;
  successful_recoveries: number;
  pending_recoveries: number;
  failed_recoveries: number;
  recovery_rate: number;
}

export const useRecoveryRate = () => {
  return useQuery({
    queryKey: ['recovery-rate'],
    queryFn: async (): Promise<RecoveryStats> => {
      const { data, error } = await supabase.rpc('get_recovery_statistics');
      
      if (error) {
        console.error('Error fetching recovery statistics:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        return {
          total_messages_sent: 0,
          successful_recoveries: 0,
          pending_recoveries: 0,
          failed_recoveries: 0,
          recovery_rate: 0
        };
      }
      
      return data[0];
    },
    refetchInterval: 5 * 60 * 1000,
  });
};

export const useInactiveStudents = () => {
  return useQuery({
    queryKey: ['inactive-students'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_inactive_students', { days_threshold: 3 });
      
      if (error) {
        console.error('Error fetching inactive students:', error);
        throw error;
      }
      
      return data || [];
    },
    refetchInterval: 10 * 60 * 1000,
  });
};

export const useRecoveryMessages = () => {
  return useQuery({
    queryKey: ['recovery-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_recovery_messages')
        .select(`
          id,
          user_id,
          message_sent_at,
          message_type,
          days_inactive,
          recovery_successful,
          recovered_at,
          message_content,
          created_at,
          updated_at,
          recovery_cycle,
          message_status,
          last_check_date
        `)
        .order('message_sent_at', { ascending: false })
        .limit(50);
      
      if (error) {
        console.error('Error fetching recovery messages:', error);
        throw error;
      }

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(msg => msg.user_id))];
        const { data: users, error: usersError } = await supabase
          .from('users')
          .select('id, full_name, email, phone')
          .in('id', userIds);

        if (usersError) {
          console.error('Error fetching user details:', usersError);
          return data;
        }

        return data.map(message => ({
          ...message,
          user: users?.find(user => user.id === message.user_id)
        }));
      }
      
      return data || [];
    },
    refetchInterval: 2 * 60 * 1000,
  });
};

// Get tracked students (currently in recovery)
export const useTrackedStudents = () => {
  return useQuery({
    queryKey: ['tracked-inactive-students'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_tracked_inactive_students');
      if (error) {
        console.error('Error fetching tracked students:', error);
        throw error;
      }
      return data || [];
    },
    refetchInterval: 2 * 60 * 1000,
  });
};

// Get daily check history
export const useDailyCheckHistory = () => {
  return useQuery({
    queryKey: ['daily-check-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('student_recovery_checks')
        .select('*')
        .order('check_date', { ascending: false })
        .limit(30);
      if (error) {
        console.error('Error fetching daily check history:', error);
        throw error;
      }
      return data || [];
    },
    refetchInterval: 5 * 60 * 1000,
  });
};

// Manual trigger daily check
export const useTriggerDailyCheck = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke(
        'daily-recovery-check',
        { body: {} }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery-rate'] });
      queryClient.invalidateQueries({ queryKey: ['inactive-students'] });
      queryClient.invalidateQueries({ queryKey: ['recovery-messages'] });
      queryClient.invalidateQueries({ queryKey: ['tracked-inactive-students'] });
      queryClient.invalidateQueries({ queryKey: ['daily-check-history'] });
    },
  });
};