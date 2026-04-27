import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';

export interface MentorInfo {
  id: string;
  full_name: string;
  email: string;
}

/**
 * Resolve a mentor for each at-risk student using:
 * 1. Manual override stored in user_activity_logs (activity_type = 'at_risk_mentor_assignment')
 * 2. Auto-detect via course enrollment -> mentor_course_assignments
 * Returns map: studentUserId -> MentorInfo | null
 */
export const useAtRiskMentors = (studentUserIds: string[]) => {
  const [mentorMap, setMentorMap] = useState<Map<string, MentorInfo | null>>(new Map());
  const [allMentors, setAllMentors] = useState<MentorInfo[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMentors = useCallback(async () => {
    if (!studentUserIds.length) {
      setMentorMap(new Map());
      return;
    }
    setLoading(true);
    try {
      // 1. Load all mentor users for the assignment dialog
      const { data: mentorsData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'mentor')
        .order('full_name');

      const mentors: MentorInfo[] = (mentorsData || []).map(m => ({
        id: m.id,
        full_name: m.full_name || 'Unknown',
        email: m.email || '',
      }));
      setAllMentors(mentors);
      const mentorById = new Map(mentors.map(m => [m.id, m]));

      // 2. Fetch manual overrides (most recent per student)
      const { data: overrides } = await supabase
        .from('user_activity_logs')
        .select('user_id, metadata, occurred_at')
        .in('user_id', studentUserIds)
        .eq('activity_type', 'at_risk_mentor_assignment')
        .order('occurred_at', { ascending: false });

      const overrideMap = new Map<string, string | null>();
      for (const o of (overrides || [])) {
        if (!overrideMap.has(o.user_id)) {
          const meta = o.metadata as any;
          // null means explicitly unassigned
          overrideMap.set(o.user_id, meta?.mentor_id || null);
        }
      }

      // 3. Auto-detect via course enrollments for users without overrides
      const usersNeedingAuto = studentUserIds.filter(uid => !overrideMap.has(uid));

      let autoMentorMap = new Map<string, string>();
      if (usersNeedingAuto.length > 0) {
        // user_id -> students.id
        const { data: studentRecs } = await supabase
          .from('students')
          .select('id, user_id')
          .in('user_id', usersNeedingAuto);

        const studentIdToUserId = new Map<string, string>();
        for (const sr of (studentRecs || [])) {
          if (sr.user_id) studentIdToUserId.set(sr.id, sr.user_id);
        }

        const studentIds = [...studentIdToUserId.keys()];
        if (studentIds.length > 0) {
          // student.id -> course_id (active enrollments)
          const { data: enrollments } = await supabase
            .from('course_enrollments')
            .select('student_id, course_id')
            .in('student_id', studentIds);

          // course_id -> mentor_id (prefer is_primary)
          const courseIds = [...new Set((enrollments || []).map(e => e.course_id).filter(Boolean))];
          if (courseIds.length > 0) {
            const { data: assignments } = await supabase
              .from('mentor_course_assignments')
              .select('course_id, mentor_id, is_primary, is_global')
              .in('course_id', courseIds);

            const courseToMentor = new Map<string, string>();
            // Sort: is_primary first, then any
            const sorted = (assignments || []).slice().sort((a, b) => {
              if (a.is_primary && !b.is_primary) return -1;
              if (!a.is_primary && b.is_primary) return 1;
              return 0;
            });
            for (const a of sorted) {
              if (a.course_id && a.mentor_id && !courseToMentor.has(a.course_id)) {
                courseToMentor.set(a.course_id, a.mentor_id);
              }
            }

            // Also pick a global mentor as fallback (first one)
            const globalMentor = (assignments || []).find(a => a.is_global)?.mentor_id || null;

            for (const e of (enrollments || [])) {
              const userId = studentIdToUserId.get(e.student_id);
              if (!userId || autoMentorMap.has(userId)) continue;
              const mentorId = courseToMentor.get(e.course_id) || globalMentor;
              if (mentorId) autoMentorMap.set(userId, mentorId);
            }
          }
        }
      }

      // 4. Combine
      const finalMap = new Map<string, MentorInfo | null>();
      for (const uid of studentUserIds) {
        if (overrideMap.has(uid)) {
          const mid = overrideMap.get(uid);
          finalMap.set(uid, mid ? mentorById.get(mid) || null : null);
        } else {
          const mid = autoMentorMap.get(uid);
          finalMap.set(uid, mid ? mentorById.get(mid) || null : null);
        }
      }
      setMentorMap(finalMap);
    } catch (err) {
      safeLogger.warn('Failed to load at-risk mentors:', err);
      setMentorMap(new Map());
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(studentUserIds)]);

  useEffect(() => {
    fetchMentors();
  }, [fetchMentors]);

  const assignMentor = async (studentUserId: string, mentorId: string | null, performedBy: string) => {
    try {
      await supabase.from('user_activity_logs').insert({
        user_id: studentUserId,
        activity_type: 'at_risk_mentor_assignment',
        occurred_at: new Date().toISOString(),
        metadata: { mentor_id: mentorId, assigned_by: performedBy },
      });
      await fetchMentors();
      return true;
    } catch (err) {
      safeLogger.warn('Failed to assign mentor:', err);
      return false;
    }
  };

  return { mentorMap, allMentors, loading, assignMentor, refetch: fetchMentors };
};
