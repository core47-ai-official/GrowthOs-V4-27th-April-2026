import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useRecordingUnlocks } from '@/hooks/useRecordingUnlocks';
import { logger } from '@/lib/logger';

interface Recording {
  id: string;
  recording_title: string;
  recording_url?: string;
  sequence_order: number;
  duration_min?: number;
  module_id: string;
  isUnlocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentSubmitted: boolean;
  assignmentId?: string;
  assignmentTitle?: string;
}

interface Module {
  id: string;
  title: string;
  order: number;
  recordings: Recording[];
}

export const useModulesWithRecordings = () => {
  const { user } = useAuth();
  const { isRecordingUnlocked, loading: unlocksLoading } = useRecordingUnlocks();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id && !unlocksLoading) {
      fetchModulesWithRecordings();
    }
  }, [user?.id, unlocksLoading]);

  const fetchModulesWithRecordings = async () => {
    if (!user?.id) return;

  try {
      const corrId = `mods-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const t0 = performance.now();
      logger.debug('ModulesWithRecordings: start', { corrId, userId: user.id });
      
      const tModulesStart = performance.now();
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('id, title, order')
        .order('order');
      logger.performance('mods.fetch_modules', performance.now() - tModulesStart, { corrId });

      if (modulesError) throw modulesError;

      const tRecordingsStart = performance.now();
      const { data: recordingsData, error: recordingsError } = await supabase
        .from('available_lessons')
        .select(`
          id,
          recording_title,
          recording_url,
          sequence_order,
          duration_min,
          module,
          assignment_id
        `)
        .order('sequence_order');
      logger.performance('mods.fetch_recordings', performance.now() - tRecordingsStart, { corrId });

      if (recordingsError) throw recordingsError;

      const tViewsStart = performance.now();
      const { data: viewsData, error: viewsError } = await supabase
        .from('recording_views')
        .select('recording_id, watched')
        .eq('user_id', user.id);
      logger.performance('mods.fetch_views', performance.now() - tViewsStart, { corrId });

      if (viewsError) throw viewsError;

      const tAssignStart = performance.now();
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id, name');
      logger.performance('mods.fetch_assignments', performance.now() - tAssignStart, { corrId });

      if (assignmentsError) throw assignmentsError;

      const tSubsStart = performance.now();
      const { data: submissionsData, error: submissionsError } = await supabase
        .from('submissions')
        .select('assignment_id, status')
        .eq('student_id', user.id);
      logger.performance('mods.fetch_submissions', performance.now() - tSubsStart, { corrId });

      if (submissionsError) throw submissionsError;

      // Group recordings by module
      const tProcessStart = performance.now();
      const processedModules = (modulesData || []).map(module => {
        const moduleRecordings = (recordingsData || [])
          .filter(recording => recording.module === module.id)
          .map(recording => {
            const isUnlocked = isRecordingUnlocked(recording.id);
            const view = viewsData?.find(v => v.recording_id === recording.id);
            const assignment = assignmentsData?.find(a => a.id === recording.assignment_id);
            const submission = assignment ? submissionsData?.find(s => s.assignment_id === assignment.id) : null;

            return {
              id: recording.id,
              recording_title: recording.recording_title || 'Untitled Recording',
              recording_url: recording.recording_url,
              sequence_order: recording.sequence_order || 999,
              duration_min: recording.duration_min,
              module_id: recording.module,
              isUnlocked,
              isWatched: view?.watched || false,
              hasAssignment: !!assignment,
              assignmentSubmitted: !!submission && submission.status !== 'declined',
              assignmentId: assignment?.id,
              assignmentTitle: assignment?.name
            };
          })
          .sort((a, b) => a.sequence_order - b.sequence_order);

        return {
          id: module.id,
          title: module.title,
          order: module.order || 999,
          recordings: moduleRecordings
        };
      }).filter(module => module.recordings.length > 0);
      logger.performance('mods.process_grouping', performance.now() - tProcessStart, { corrId });

      logger.performance('mods.fetch_total', performance.now() - t0, { corrId });
      setModules(processedModules);
    } catch (error) {
      console.error('Error fetching modules with recordings:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshData = () => {
    fetchModulesWithRecordings();
  };

  return {
    modules,
    loading,
    refreshData
  };
};