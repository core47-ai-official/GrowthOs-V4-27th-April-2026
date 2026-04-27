import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

interface SubmissionHistory {
  id: string;
  version: number;
  content: string;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  notes?: string;
}

interface AssignmentWithHistory {
  assignment_id: string;
  assignment_name: string;
  recording_id?: string;
  current_status: 'pending' | 'approved' | 'declined' | 'not_submitted';
  latest_version: number;
  submissions: SubmissionHistory[];
  can_resubmit: boolean;
}

export const useSequentialSubmissions = (assignmentId?: string) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchSubmissionHistory();
    }
  }, [user?.id, assignmentId]);

  const fetchSubmissionHistory = async () => {
    if (!user?.id) return;

    try {
      let query = supabase
        .from('assignments')
        .select(`
          id,
          name,
          submissions!inner(
            id,
            version,
            content,
            status,
            created_at,
            reviewed_at,
            reviewed_by,
            notes
          )
        `)
        .eq('submissions.student_id', user.id);

      if (assignmentId) {
        query = query.eq('id', assignmentId);
      }

      const { data: assignmentData, error } = await query;

      if (error) throw error;

      const processedAssignments: AssignmentWithHistory[] = (assignmentData || []).map(assignment => {
        const submissions = assignment.submissions || [];
        
        // Type-safe status mapping function
        const getValidStatus = (status: string): 'pending' | 'approved' | 'declined' => {
          if (status === 'pending' || status === 'approved' || status === 'declined') {
            return status;
          }
          return 'pending'; // Default fallback
        };
        
        // Transform submissions with proper typing
        const typedSubmissions: SubmissionHistory[] = submissions.map(sub => ({
          id: sub.id,
          version: sub.version,
          content: sub.content,
          status: getValidStatus(sub.status),
          created_at: sub.created_at,
          reviewed_at: sub.reviewed_at || undefined,
          reviewed_by: sub.reviewed_by || undefined,
          notes: sub.notes || undefined
        }));
        
        const sortedSubmissions = typedSubmissions.sort((a, b) => b.version - a.version);
        const latestSubmission = sortedSubmissions[0];
        
        return {
          assignment_id: assignment.id,
          assignment_name: assignment.name,
          recording_id: null, // No longer directly linked to recordings
          current_status: latestSubmission ? latestSubmission.status : 'not_submitted',
          latest_version: latestSubmission?.version || 0,
          submissions: sortedSubmissions,
          can_resubmit: latestSubmission?.status === 'declined' || !latestSubmission
        };
      });

      setAssignments(processedAssignments);

    } catch (error) {
      logger.error('Error fetching submission history:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitAssignment = async (assignmentId: string, content: string) => {
    if (!user?.id) return { success: false, error: 'User not found' };

    try {
      // Query database for the actual latest version to prevent conflicts
      const { data: existingSubmissions, error: queryError } = await supabase
        .from('submissions')
        .select('version')
        .eq('student_id', user.id)
        .eq('assignment_id', assignmentId)
        .order('version', { ascending: false })
        .limit(1);

      if (queryError) throw queryError;

      const nextVersion = (existingSubmissions?.[0]?.version || 0) + 1;

      // Insert new submission with correct version
      const { error } = await supabase
        .from('submissions')
        .insert({
          assignment_id: assignmentId,
          student_id: user.id,
          content,
          version: nextVersion,
          status: 'pending'
        });

      if (error) throw error;

      // Refresh data
      await fetchSubmissionHistory();

      return { success: true };
    } catch (error) {
      logger.error('Error submitting assignment:', error);
      return { success: false, error: 'Failed to submit assignment' };
    }
  };

  const getAssignmentHistory = (assignmentId: string): AssignmentWithHistory | undefined => {
    return assignments.find(a => a.assignment_id === assignmentId);
  };

  return {
    assignments,
    loading,
    submitAssignment,
    getAssignmentHistory,
    refreshHistory: fetchSubmissionHistory
  };
};