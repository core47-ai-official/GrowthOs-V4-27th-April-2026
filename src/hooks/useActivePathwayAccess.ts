import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface PathwayState {
  pathwayId: string;
  pathwayName: string;
  currentCourseId: string;
  currentCourseTitle: string;
  currentStepNumber: number;
  totalSteps: number;
  hasPendingChoice: boolean;
  choiceGroup: number | null;
}

export interface PathwayCourse {
  courseId: string;
  courseTitle: string;
  stepNumber: number;
  choiceGroup: number | null;
  isAvailable: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  requiresChoice: boolean;
  choiceOptions: Array<{ course_id: string; course_title: string }> | null;
  isChoicePoint: boolean;
  isSelectedChoice: boolean;
}

interface UseActivePathwayAccessReturn {
  isInPathwayMode: boolean;
  pathwayState: PathwayState | null;
  pathwayCourses: PathwayCourse[];
  loading: boolean;
  error: Error | null;
  advancePathway: (selectedCourseId?: string) => Promise<{ success: boolean; error?: string; completed?: boolean; awaitingChoice?: boolean }>;
  makeChoice: (courseId: string) => Promise<{ success: boolean; error?: string }>;
  refreshPathwayState: () => Promise<void>;
}

export function useActivePathwayAccess(): UseActivePathwayAccessReturn {
  const { user } = useAuth();
  const [pathwayState, setPathwayState] = useState<PathwayState | null>(null);
  const [pathwayCourses, setPathwayCourses] = useState<PathwayCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPathwayState = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the RPC to get active pathway
      const { data: pathwayData, error: pathwayError } = await supabase
        .rpc('get_student_active_pathway', { p_user_id: user.id });

      if (pathwayError) {
        logger.error('Error fetching active pathway:', pathwayError);
        throw pathwayError;
      }

      // If no pathway data, user is not in pathway mode
      if (!pathwayData || pathwayData.length === 0) {
        setPathwayState(null);
        setPathwayCourses([]);
        setLoading(false);
        return;
      }

      const pathway = pathwayData[0];
      const state: PathwayState = {
        pathwayId: pathway.pathway_id,
        pathwayName: pathway.pathway_name,
        currentCourseId: pathway.current_course_id,
        currentCourseTitle: pathway.current_course_title,
        currentStepNumber: pathway.current_step_number,
        totalSteps: pathway.total_steps,
        hasPendingChoice: pathway.has_pending_choice,
        choiceGroup: pathway.choice_group
      };
      setPathwayState(state);

      // Fetch pathway course map
      const { data: courseMapData, error: courseMapError } = await supabase
        .rpc('get_student_pathway_course_map', { 
          p_user_id: user.id, 
          p_pathway_id: pathway.pathway_id 
        });

      if (courseMapError) {
        logger.error('Error fetching pathway course map:', courseMapError);
      } else if (courseMapData) {
        const courses: PathwayCourse[] = courseMapData.map((c: any) => ({
          courseId: c.course_id,
          courseTitle: c.course_title,
          stepNumber: c.step_number,
          choiceGroup: c.choice_group,
          isAvailable: c.is_available,
          isCompleted: c.is_completed,
          isCurrent: c.is_current,
          requiresChoice: c.requires_choice,
          choiceOptions: c.choice_options,
          isChoicePoint: c.is_choice_point || false,
          isSelectedChoice: c.is_selected_choice || false
        }));
        setPathwayCourses(courses);
      }
    } catch (err) {
      logger.error('Error in useActivePathwayAccess:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch pathway state'));
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchPathwayState();
  }, [fetchPathwayState]);

  const advancePathway = useCallback(async (selectedCourseId?: string): Promise<{ success: boolean; error?: string; completed?: boolean; awaitingChoice?: boolean }> => {
    if (!user?.id || !pathwayState) {
      return { success: false, error: 'No active pathway' };
    }

    try {
      const { data, error: advanceError } = await supabase
        .rpc('advance_pathway', {
          p_user_id: user.id,
          p_pathway_id: pathwayState.pathwayId,
          p_selected_course_id: selectedCourseId || null
        });

      if (advanceError) {
        logger.error('Error advancing pathway:', advanceError);
        return { success: false, error: advanceError.message };
      }

      const result = data as any;
      if (!result.success) {
        return { success: false, error: result.error };
      }

      // Refresh state after advancing
      await fetchPathwayState();
      
      // Check if student is now at a choice point
      if (result.awaiting_choice) {
        return { 
          success: true, 
          awaitingChoice: true,
          completed: false 
        };
      }
      
      return { 
        success: true, 
        completed: result.completed || false 
      };
    } catch (err) {
      logger.error('Error in advancePathway:', err);
      return { success: false, error: 'Failed to advance pathway' };
    }
  }, [user?.id, pathwayState, fetchPathwayState]);

  const makeChoice = useCallback(async (courseId: string): Promise<{ success: boolean; error?: string }> => {
    return advancePathway(courseId);
  }, [advancePathway]);

  return {
    isInPathwayMode: pathwayState !== null,
    pathwayState,
    pathwayCourses,
    loading,
    error,
    advancePathway,
    makeChoice,
    refreshPathwayState: fetchPathwayState
  };
}
