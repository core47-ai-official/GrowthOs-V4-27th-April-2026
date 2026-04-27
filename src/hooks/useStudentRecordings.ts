import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRecordingUnlocks } from '@/hooks/useRecordingUnlocks';
import { safeLogger } from '@/lib/safe-logger';

interface Recording {
  id: string;
  recording_title: string;
  recording_url?: string;
  sequence_order: number;
  duration_min?: number;
  module?: string;
  isUnlocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentSubmitted: boolean;
  /** True if the latest submission for this recording's assignment was declined. */
  assignmentDeclined: boolean;
}

export const useStudentRecordings = () => {
  const { user } = useAuth();
  const { isRecordingUnlocked, loading: unlocksLoading } = useRecordingUnlocks();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && !unlocksLoading) {
      fetchRecordings();
    }
  }, [user?.id, unlocksLoading]);

  const fetchRecordings = async () => {
    if (!user?.id) return;

    try {
      safeLogger.info('StudentRecordings: Fetching recordings for user:', { userId: user.id });
      safeLogger.info('StudentRecordings: User role:', { role: user.role });
      
      // Fetch all recordings with their modules
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('available_lessons')
        .select(`
          id,
          recording_title,
          recording_url,
          sequence_order,
          duration_min,
          module,
          assignment_id,
          modules!inner(id, title, order)
        `)
        .order('sequence_order');

      if (recordingsError) throw recordingsError;
      safeLogger.info('StudentRecordings: Found recordings:', { count: recordingsData?.length || 0 });

      // Fetch assignments separately
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, name, description, submission_type, instructions, due_days');

      if (assignmentsError) throw assignmentsError;

      // Fetch recording views for this user
      const { data: viewsData, error: viewsError } = await supabase
        .from('recording_views')
        .select('recording_id, watched')
        .eq('user_id', user.id);

      if (viewsError) throw viewsError;

      // Fetch user's submissions (with version + created_at so we can pick the LATEST per assignment)
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('assignment_id, status, version, created_at')
        .eq('student_id', user.id);

      if (submissionsError) throw submissionsError;

      // Build a map: assignment_id -> latest submission (highest version, then most recent created_at).
      // Without this, .find() returns the FIRST submission, which lies about state when a
      // student resubmits (e.g., v1 approved, v2 declined would still show "approved").
      const latestSubmissionByAssignment = new Map<string, { status: string; version: number; createdAt: number }>();
      (submissionsData || []).forEach((s: any) => {
        const version = Number(s.version || 0);
        const createdAt = s.created_at ? new Date(s.created_at).getTime() : 0;
        const existing = latestSubmissionByAssignment.get(s.assignment_id);
        if (!existing || version > existing.version || (version === existing.version && createdAt > existing.createdAt)) {
          latestSubmissionByAssignment.set(s.assignment_id, { status: s.status, version, createdAt });
        }
      });

      // Process the data
      const processedRecordings = (recordingsData || []).map(recording => {
        const isUnlocked = isRecordingUnlocked(recording.id);
        const view = viewsData?.find(v => v.recording_id === recording.id);
        const assignment = assignmentsData?.find(a => a.id === recording.assignment_id);
        const latestSubmission = assignment ? latestSubmissionByAssignment.get(assignment.id) : undefined;
        const isDeclined = latestSubmission?.status === 'declined';
        // "Submitted" excludes declined: a declined submission requires resubmission and shouldn't show as done.
        const isSubmitted = !!latestSubmission && !isDeclined;

        return {
          id: recording.id,
          recording_title: recording.recording_title || 'Untitled Recording',
          recording_url: recording.recording_url,
          sequence_order: recording.sequence_order || 999,
          duration_min: recording.duration_min,
          module: recording.module,
          isUnlocked,
          isWatched: view?.watched || false,
          hasAssignment: !!assignment,
          assignmentSubmitted: isSubmitted,
          assignmentDeclined: isDeclined,
        };
      });

      safeLogger.info('StudentRecordings: Processed recordings:', { count: processedRecordings.length });
      setRecordings(processedRecordings);
    } catch (error) {
      console.error('Error fetching student recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshRecordings = () => {
    fetchRecordings();
  };

  return {
    recordings,
    loading,
    refreshRecordings
  };
};