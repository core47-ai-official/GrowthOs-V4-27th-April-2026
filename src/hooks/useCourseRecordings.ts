import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface CourseRecording {
  id: string;
  recording_title: string;
  recording_url?: string;
  sequence_order: number;
  duration_min?: number;
  module_id: string;
  module_title: string;
  module_order: number;
  isUnlocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentId?: string;
  assignmentSubmitted: boolean;
  lockReason?: string | null;
  dripUnlockDate?: string | null;
}

export interface CourseModule {
  id: string;
  title: string;
  order: number;
  recordings: CourseRecording[];
  isLocked: boolean;
  totalLessons: number;
  watchedLessons: number;
}

interface UseCourseRecordingsReturn {
  modules: CourseModule[];
  recordings: CourseRecording[];
  loading: boolean;
  error: Error | null;
  courseProgress: number;
  refreshData: () => Promise<void>;
}

export function useCourseRecordings(courseId: string | null): UseCourseRecordingsReturn {
  const { user } = useAuth();
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [recordings, setRecordings] = useState<CourseRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [courseProgress, setCourseProgress] = useState(0);

  const fetchData = useCallback(async () => {
    if (!user?.id || !courseId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch modules for this course
      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('id, title, order')
        .eq('course_id', courseId)
        .order('order', { ascending: true });

      if (modulesError) throw modulesError;

      // Fetch lessons for these modules
      const moduleIds = modulesData?.map(m => m.id) || [];
      
      let lessonsData: any[] = [];
      if (moduleIds.length > 0) {
        const { data, error: lessonsError } = await supabase
          .from('available_lessons')
          .select('id, recording_title, recording_url, sequence_order, duration_min, module, assignment_id')
          .in('module', moduleIds)
          .order('sequence_order', { ascending: true });

        if (lessonsError) throw lessonsError;
        lessonsData = data || [];
      }

      // Fetch unlock status, student LMS status, views, and submissions in parallel
      const [unlockResult, studentResult, viewsResult, submissionsResult] = await Promise.all([
        supabase.rpc('get_course_sequential_unlock_status', {
          p_user_id: user.id,
          p_course_id: courseId
        }),
        supabase.from('users').select('lms_status').eq('id', user.id).maybeSingle(),
        supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id),
        supabase
          .from('submissions')
          .select('assignment_id, status, version, created_at')
          .eq('student_id', user.id),
      ]);

      const unlockData = unlockResult.data;
      const studentLMSStatus = studentResult.data?.lms_status || 'active';

      const unlockStatusMap = new Map<string, { isUnlocked: boolean; lockReason?: string; dripUnlockDate?: string }>();
      (unlockData || []).forEach((u: any) => {
        unlockStatusMap.set(u.recording_id, {
          isUnlocked: u.is_unlocked,
          lockReason: u.lock_reason,
          dripUnlockDate: u.drip_unlock_date
        });
      });

      const watchedMap = new Map((viewsResult.data || []).map(v => [v.recording_id, v.watched]));

      const latestSubmissionByAssignment = new Map<string, { status: string; version: number; createdAt: number }>();
      (submissionsResult.data || []).forEach((submission: any) => {
        const version = Number(submission.version || 0);
        const createdAt = submission.created_at ? new Date(submission.created_at).getTime() : 0;
        const existing = latestSubmissionByAssignment.get(submission.assignment_id);

        if (!existing || version > existing.version || (version === existing.version && createdAt > existing.createdAt)) {
          latestSubmissionByAssignment.set(submission.assignment_id, {
            status: submission.status,
            version,
            createdAt
          });
        }
      });

      const submittedAssignments = new Set(
        Array.from(latestSubmissionByAssignment.entries())
          .filter(([, submission]) => submission.status !== 'declined')
          .map(([assignmentId]) => assignmentId)
      );

      const approvedAssignments = new Set(
        Array.from(latestSubmissionByAssignment.entries())
          .filter(([, submission]) => submission.status === 'approved')
          .map(([assignmentId]) => assignmentId)
      );

      // Process recordings
      const processedRecordings: CourseRecording[] = lessonsData.map(lesson => {
        const module = modulesData?.find(m => m.id === lesson.module);
        const unlockStatus = unlockStatusMap.get(lesson.id);
        return {
          id: lesson.id,
          recording_title: lesson.recording_title || 'Untitled',
          recording_url: lesson.recording_url,
          sequence_order: lesson.sequence_order || 0,
          duration_min: lesson.duration_min,
          module_id: lesson.module,
          module_title: module?.title || 'Unknown Module',
          module_order: module?.order || 0,
          isUnlocked: unlockStatus?.isUnlocked || false,
          isWatched: watchedMap.get(lesson.id) || false,
          hasAssignment: !!lesson.assignment_id,
          assignmentId: lesson.assignment_id,
          assignmentSubmitted: lesson.assignment_id ? submittedAssignments.has(lesson.assignment_id) : false,
          lockReason: unlockStatus?.lockReason || null,
          dripUnlockDate: unlockStatus?.dripUnlockDate || null
        };
      });

      // Consistency fix: if prior assignment is already approved, don't keep next lesson locked
      // due to stale/multi-row submission join states from RPC.
      const sortedRecordings = [...processedRecordings].sort((a, b) => {
        if (a.module_order !== b.module_order) return a.module_order - b.module_order;
        return a.sequence_order - b.sequence_order;
      });

      for (let i = 1; i < sortedRecordings.length; i++) {
        const current = sortedRecordings[i];
        const blockingByPreviousAssignment =
          current.lockReason === 'previous_assignment_not_approved' ||
          current.lockReason === 'previous_assignment_not_submitted';

        if (!current.isUnlocked && blockingByPreviousAssignment) {
          // Walk backwards to find the actual blocking predecessor
          let allPredecessorsMet = true;
          for (let j = i - 1; j >= 0; j--) {
            const pred = sortedRecordings[j];
            if (!pred.isWatched) { allPredecessorsMet = false; break; }
            if (pred.hasAssignment && pred.assignmentId && !approvedAssignments.has(pred.assignmentId)) {
              allPredecessorsMet = false;
              break;
            }
          }
          if (allPredecessorsMet) {
            current.isUnlocked = true;
            current.lockReason = null;
          }
        }
      }

      // Frontend override: if LMS is active but RPC returns fees_not_cleared, apply sequential logic
      if (studentLMSStatus === 'active') {
        const sortedBySequence = [...processedRecordings].sort((a, b) => {
          if (a.module_order !== b.module_order) return a.module_order - b.module_order;
          return a.sequence_order - b.sequence_order;
        });
        
        const hasFeesNotCleared = sortedBySequence.some(r => r.lockReason === 'fees_not_cleared');
        if (hasFeesNotCleared) {
          let canUnlockNext = true;
          for (const rec of sortedBySequence) {
            if (rec.lockReason !== 'fees_not_cleared' && rec.lockReason !== 'fees_cleared') continue;
            const original = processedRecordings.find(r => r.id === rec.id)!;
            if (canUnlockNext) {
              original.isUnlocked = true;
              original.lockReason = null;
              // Determine if this blocks the next one
              if (!original.isWatched) {
                canUnlockNext = false;
              } else if (original.hasAssignment && !approvedAssignments.has(original.assignmentId)) {
                canUnlockNext = false;
              }
            } else {
              // Keep locked but fix the reason
              original.lockReason = 'previous_lesson_not_watched';
            }
          }
        }
      }

      setRecordings(processedRecordings);

      // Group into modules
      const moduleMap = new Map<string, CourseModule>();
      
      for (const mod of modulesData || []) {
        const moduleRecordings = processedRecordings.filter(r => r.module_id === mod.id);
        const watchedCount = moduleRecordings.filter(r => r.isWatched).length;
        const isLocked = moduleRecordings.length > 0 && moduleRecordings.every(r => !r.isUnlocked);
        
        moduleMap.set(mod.id, {
          id: mod.id,
          title: mod.title,
          order: mod.order || 0,
          recordings: moduleRecordings,
          isLocked,
          totalLessons: moduleRecordings.length,
          watchedLessons: watchedCount
        });
      }

      const sortedModules = Array.from(moduleMap.values()).sort((a, b) => a.order - b.order);
      setModules(sortedModules);

      // Calculate progress
      const totalRecordings = processedRecordings.length;
      const watchedRecordings = processedRecordings.filter(r => r.isWatched).length;
      const progress = totalRecordings > 0 ? Math.round((watchedRecordings / totalRecordings) * 100) : 0;
      setCourseProgress(progress);

    } catch (err) {
      logger.error('Error fetching course recordings:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch course data'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, courseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    modules,
    recordings,
    loading,
    error,
    courseProgress,
    refreshData: fetchData
  };
}
