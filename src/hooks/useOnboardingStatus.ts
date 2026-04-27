import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface OnboardingJobStatus {
  step: 'EMAIL' | 'INVOICE';
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY';
  retries: number;
  last_error?: string;
  updated_at: string;
}

export interface StudentOnboardingStatus {
  student_id: string;
  jobs: OnboardingJobStatus[];
}

export const useOnboardingStatus = (studentIds: string[], enabled = true) => {
  const [statuses, setStatuses] = useState<Record<string, OnboardingJobStatus[]>>({});
  const [loading, setLoading] = useState(false);

  const fetchStatuses = async () => {
    if (!enabled || studentIds.length === 0) return;
    
    setLoading(true);
    try {
      // Temporarily disable onboarding status checks due to missing table
      const data = [];
      const error = null;

      if (error) {
        console.error('Error fetching onboarding statuses:', error);
        return;
      }

      // Group by student_id
      const groupedStatuses: Record<string, OnboardingJobStatus[]> = {};
      data?.forEach(job => {
        if (!groupedStatuses[job.student_id]) {
          groupedStatuses[job.student_id] = [];
        }
        groupedStatuses[job.student_id].push({
          step: job.step as 'EMAIL' | 'INVOICE',
          status: job.status as 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY',
          retries: job.retries,
          last_error: job.last_error,
          updated_at: job.updated_at,
        });
      });

      setStatuses(groupedStatuses);
    } catch (error) {
      console.error('Error fetching onboarding statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
    
    // Poll every 10 seconds if there are pending/retry jobs
    const hasActivJobs = Object.values(statuses).some(jobs =>
      jobs.some(job => job.status === 'PENDING' || job.status === 'RETRY')
    );

    if (hasActivJobs && enabled) {
      const interval = setInterval(fetchStatuses, 10000);
      return () => clearInterval(interval);
    }
  }, [studentIds, enabled, JSON.stringify(statuses)]);

  const getStudentStatus = (studentId: string): OnboardingJobStatus[] => {
    return statuses[studentId] || [];
  };

  const getJobStatus = (studentId: string, step: 'EMAIL' | 'INVOICE'): OnboardingJobStatus | null => {
    const studentJobs = getStudentStatus(studentId);
    return studentJobs.find(job => job.step === step) || null;
  };

  return {
    statuses,
    loading,
    getStudentStatus,
    getJobStatus,
    refetch: fetchStatuses,
  };
};