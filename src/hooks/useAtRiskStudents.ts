import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AtRiskRules } from './useAtRiskRules';
import { safeLogger } from '@/lib/safe-logger';

export type AtRiskReason = 
  | 'no_login'
  | 'stuck_recording'
  | 'stuck_assignment'
  | 'missed_sessions';

export interface AtRiskStudent {
  user_id: string;
  student_id: string;
  name: string;
  email: string;
  phone?: string | null;
  batch_name?: string;
  reasons: {
    type: AtRiskReason;
    label: string;
    detail: string;
  }[];
  severity: 'warning' | 'critical';
  resolved_at?: string;
  first_flagged_at?: string;
  days_at_risk?: number;
}

interface StudentRecord {
  id: string;
  user_id: string;
  batch_id?: string;
}

export const useAtRiskStudents = (rules: AtRiskRules, configured: boolean) => {
  const [students, setStudents] = useState<AtRiskStudent[]>([]);
  const [resolvedByTeam, setResolvedByTeam] = useState<AtRiskStudent[]>([]);
  const [resolvedByStudent, setResolvedByStudent] = useState<AtRiskStudent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAtRiskStudents = useCallback(async () => {
    if (!configured) {
      setStudents([]);
      setResolvedByTeam([]);
      setResolvedByStudent([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // 1. Get all active users who are students (not suspended)
      const { data: usersData, error: usersErr } = await supabase
        .from('users')
        .select('id, full_name, email, phone, last_login_at, status, lms_status')
        .eq('role', 'student')
        .neq('status', 'suspended')
        .eq('lms_status', 'active');

      if (usersErr) throw usersErr;
      if (!usersData?.length) {
        setStudents([]);
        await fetchResolvedStudents([]);
        setLoading(false);
        return;
      }

      const userIds = usersData.map(u => u.id);

      // Get student records for student_id mapping
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, user_id')
        .in('user_id', userIds);

      // Get batch assignments from course_enrollments
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id, batch_id')
        .in('student_id', (studentsData || []).map(s => s.id))
        .not('batch_id', 'is', null);

      // Map student_id -> batch_id
      const studentBatchMap = new Map<string, string>();
      for (const e of (enrollments || [])) {
        if (e.batch_id) studentBatchMap.set(e.student_id, e.batch_id);
      }

      // Get batch names
      const batchIds = [...new Set([...studentBatchMap.values()])];
      let batchNameMap = new Map<string, string>();
      if (batchIds.length) {
        const { data: batches } = await supabase
          .from('batches')
          .select('id, name')
          .in('id', batchIds);
        batchNameMap = new Map((batches || []).map(b => [b.id, b.name]));
      }

      // Map user_id -> student record
      const userStudentMap = new Map<string, StudentRecord>();
      for (const s of (studentsData || [])) {
        if (s.user_id) {
          userStudentMap.set(s.user_id, {
            id: s.id,
            user_id: s.user_id,
            batch_id: studentBatchMap.get(s.id),
          });
        }
      }

      const now = new Date();
      const flaggedStudents: AtRiskStudent[] = [];

      const findOrCreate = (userId: string): AtRiskStudent => {
        let existing = flaggedStudents.find(f => f.user_id === userId);
        if (!existing) {
          const user = usersData.find(u => u.id === userId)!;
          const studentRec = userStudentMap.get(userId);
          existing = {
            user_id: userId,
            student_id: studentRec?.id || userId,
            name: user.full_name || 'Unknown',
            email: user.email || '',
            phone: user.phone || null,
            batch_name: studentRec?.batch_id ? batchNameMap.get(studentRec.batch_id) : undefined,
            reasons: [],
            severity: 'warning',
          };
          flaggedStudents.push(existing);
        }
        return existing;
      };

      // Rule 1: No login for X days
      if (rules.no_login_days > 0) {
        for (const user of usersData) {
          const lastLogin = user.last_login_at ? new Date(user.last_login_at) : null;
          if (lastLogin) {
            const daysSince = Math.floor((now.getTime() - lastLogin.getTime()) / (1000 * 60 * 60 * 24));
            if (daysSince >= rules.no_login_days) {
              const s = findOrCreate(user.id);
              s.reasons.push({ type: 'no_login', label: 'Inactive Login', detail: `Last login ${daysSince} days ago` });
            }
          } else {
            const s = findOrCreate(user.id);
            s.reasons.push({ type: 'no_login', label: 'Inactive Login', detail: 'Never logged in' });
          }
        }
      }

      // Rule 2: Stuck on recording for X days
      if (rules.stuck_recording_days > 0) {
        const cutoff = new Date(now.getTime() - rules.stuck_recording_days * 86400000).toISOString();
        const { data: views } = await supabase
          .from('recording_views')
          .select('user_id, created_at')
          .in('user_id', userIds)
          .order('created_at', { ascending: false });

        const latestView = new Map<string, string>();
        for (const v of (views || [])) {
          if (!latestView.has(v.user_id)) latestView.set(v.user_id, v.created_at);
        }

        for (const user of usersData) {
          const last = latestView.get(user.id);
          if (!last || new Date(last) < new Date(cutoff)) {
            const daysSince = last ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400000) : null;
            const s = findOrCreate(user.id);
            s.reasons.push({
              type: 'stuck_recording',
              label: 'Stuck on Recording',
              detail: daysSince !== null ? `No new recording in ${daysSince} days` : 'No recordings watched',
            });
          }
        }
      }

      // Rule 3: Stuck on assignment for X days
      if (rules.stuck_assignment_days > 0) {
        const cutoff = new Date(now.getTime() - rules.stuck_assignment_days * 86400000).toISOString();
        const { data: submissions } = await supabase
          .from('submissions')
          .select('student_id, created_at')
          .in('student_id', userIds)
          .order('created_at', { ascending: false });

        const latestSub = new Map<string, string>();
        for (const s of (submissions || [])) {
          if (!latestSub.has(s.student_id)) latestSub.set(s.student_id, s.created_at);
        }

        const { count } = await supabase.from('assignments').select('id', { count: 'exact', head: true });
        if (count && count > 0) {
          for (const user of usersData) {
            const last = latestSub.get(user.id);
            if (!last || new Date(last) < new Date(cutoff)) {
              const daysSince = last ? Math.floor((now.getTime() - new Date(last).getTime()) / 86400000) : null;
              const s = findOrCreate(user.id);
              s.reasons.push({
                type: 'stuck_assignment',
                label: 'Stuck on Assignment',
                detail: daysSince !== null ? `No submission in ${daysSince} days` : 'No assignments submitted',
              });
            }
          }
        }
      }

      // Rule 4: Missed X live sessions
      if (rules.missed_sessions_count > 0) {
        const { data: sessions } = await supabase
          .from('live_sessions' as any)
          .select('id, batch_id, batch_ids, status')
          .eq('status', 'completed')
          .order('start_time', { ascending: false })
          .limit(20);

        const sessionsArr = (sessions as any[]) || [];

        if (sessionsArr.length > 0) {
          const sessionIds = sessionsArr.map((s: any) => s.id);
          const { data: attendance } = await supabase
            .from('live_session_attendance' as any)
            .select('session_id, user_id, attended')
            .in('session_id', sessionIds);

          const attendanceArr = (attendance as any[]) || [];
          const attendedMap = new Map<string, Set<string>>();
          for (const a of attendanceArr) {
            if (a.attended) {
              if (!attendedMap.has(a.session_id)) attendedMap.set(a.session_id, new Set());
              attendedMap.get(a.session_id)!.add(a.user_id);
            }
          }

          for (const user of usersData) {
            const studentRec = userStudentMap.get(user.id);
            const batchId = studentRec?.batch_id;

            const accessible = sessionsArr.filter((s: any) => {
              if (!batchId) return !s.batch_id && !s.batch_ids;
              const match = String(s.batch_id) === batchId;
              const arrMatch = s.batch_ids && Array.isArray(s.batch_ids) && s.batch_ids.map(String).includes(batchId);
              return match || arrMatch || (!s.batch_id && !s.batch_ids);
            });

            const missed = accessible.filter((s: any) => {
              const attendees = attendedMap.get(s.id);
              return !attendees || !attendees.has(user.id);
            }).length;

            if (missed >= rules.missed_sessions_count) {
              const s = findOrCreate(user.id);
              s.reasons.push({
                type: 'missed_sessions',
                label: 'Missed Sessions',
                detail: `Missed ${missed} recent sessions`,
              });
            }
          }
        }
      }

      // Update severity based on reason count
      for (const s of flaggedStudents) {
        s.severity = s.reasons.length >= 2 ? 'critical' : 'warning';
      }

      // Log newly flagged students to activity logs for historical tracking
      await logNewFlags(flaggedStudents);

      // Compute first_flagged_at + days_at_risk for currently flagged students
      await enrichWithFirstFlagged(flaggedStudents);

      // Sort: critical first, then by longest at-risk first
      flaggedStudents.sort((a, b) => {
        if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
        const aDays = a.days_at_risk ?? 0;
        const bDays = b.days_at_risk ?? 0;
        if (aDays !== bDays) return bDays - aDays;
        return b.reasons.length - a.reasons.length;
      });

      safeLogger.info('At-risk students detected:', { count: flaggedStudents.length });
      setStudents(flaggedStudents);

      // Now compute resolved students with PER-REASON logic
      await fetchResolvedStudents(flaggedStudents);
    } catch (err) {
      console.error('Error fetching at-risk students:', err);
    } finally {
      setLoading(false);
    }
  }, [rules, configured]);

  const enrichWithFirstFlagged = async (currentlyFlagged: AtRiskStudent[]) => {
    if (!currentlyFlagged.length) return;
    try {
      const userIds = currentlyFlagged.map(s => s.user_id);
      const { data: flagsHistory } = await supabase
        .from('user_activity_logs')
        .select('user_id, occurred_at, metadata')
        .in('user_id', userIds)
        .eq('activity_type', 'at_risk_flagged')
        .order('occurred_at', { ascending: true });

      // Find earliest unresolved flag per user
      const earliestMap = new Map<string, string>();
      for (const flag of (flagsHistory || [])) {
        const meta = flag.metadata as any;
        // skip resolved flags when computing first_flagged
        if (meta?.resolved_at) continue;
        if (!earliestMap.has(flag.user_id)) {
          earliestMap.set(flag.user_id, flag.occurred_at);
        }
      }

      const now = Date.now();
      for (const s of currentlyFlagged) {
        const first = earliestMap.get(s.user_id);
        if (first) {
          s.first_flagged_at = first;
          s.days_at_risk = Math.floor((now - new Date(first).getTime()) / 86400000);
        } else {
          // Just flagged now
          s.first_flagged_at = new Date().toISOString();
          s.days_at_risk = 0;
        }
      }
    } catch (err) {
      safeLogger.warn('Failed to enrich first-flagged dates:', err);
    }
  };

  const logNewFlags = async (currentlyFlagged: AtRiskStudent[]) => {
    if (!currentlyFlagged.length) return;
    try {
      // Get existing active flags
      const { data: existingFlags } = await supabase
        .from('user_activity_logs')
        .select('user_id, metadata')
        .eq('activity_type', 'at_risk_flagged')
        .is('metadata->resolved_at' as any, null);

      const alreadyFlagged = new Set((existingFlags || []).map(f => f.user_id));

      const newFlags = currentlyFlagged.filter(s => !alreadyFlagged.has(s.user_id));
      if (newFlags.length === 0) return;

      const inserts = newFlags.map(s => ({
        user_id: s.user_id,
        activity_type: 'at_risk_flagged',
        metadata: {
          reasons: s.reasons.map(r => r.type),
          severity: s.severity,
          flagged_at: new Date().toISOString(),
        },
      }));

      await supabase.from('user_activity_logs').insert(inserts);
    } catch (err) {
      safeLogger.warn('Failed to log at-risk flags:', err);
    }
  };

  const fetchResolvedStudents = async (currentlyFlagged: AtRiskStudent[]) => {
    try {
      // Build map: userId -> Set of currently active reason types
      const currentReasonsByUser = new Map<string, Set<AtRiskReason>>();
      for (const s of currentlyFlagged) {
        currentReasonsByUser.set(s.user_id, new Set(s.reasons.map(r => r.type)));
      }

      // Get all historical at-risk flags from last 90 days
      const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
      const { data: historicalFlags } = await supabase
        .from('user_activity_logs')
        .select('user_id, metadata, occurred_at')
        .eq('activity_type', 'at_risk_flagged')
        .gte('occurred_at', cutoff)
        .order('occurred_at', { ascending: false });

      if (!historicalFlags?.length) {
        setResolvedByTeam([]);
        setResolvedByStudent([]);
        return;
      }

      // For each user, find their most recent flag — only consider resolved if
      // EVERY original reason from that flag is no longer in current reasons
      const candidateResolved = new Map<string, { reasons: AtRiskReason[]; severity: string; resolved_at: string }>();
      const seenUsers = new Set<string>();
      for (const flag of historicalFlags) {
        if (seenUsers.has(flag.user_id)) continue;
        seenUsers.add(flag.user_id);

        const meta = flag.metadata as any;
        const originalReasons: AtRiskReason[] = meta?.reasons || [];
        if (originalReasons.length === 0) continue;

        const currentReasons = currentReasonsByUser.get(flag.user_id) || new Set();

        // Per-reason check: all original reasons must be cleared
        const allCleared = originalReasons.every(r => !currentReasons.has(r));
        if (allCleared) {
          candidateResolved.set(flag.user_id, {
            reasons: originalReasons,
            severity: meta?.severity || 'warning',
            resolved_at: flag.occurred_at,
          });
        }
      }

      if (candidateResolved.size === 0) {
        setResolvedByTeam([]);
        setResolvedByStudent([]);
        return;
      }

      const resolvedIds = [...candidateResolved.keys()];

      // Get user details for resolved students
      const { data: resolvedUsers } = await supabase
        .from('users')
        .select('id, full_name, email, phone')
        .in('id', resolvedIds);

      // Check team intervention: admin notes added AFTER the user was first flagged
      // and BEFORE/AROUND resolution time (i.e. in the at-risk window)
      const { data: adminNotes } = await supabase
        .from('user_activity_logs')
        .select('user_id, occurred_at, metadata')
        .eq('activity_type', 'admin_note')
        .in('user_id', resolvedIds)
        .like('metadata->>note', '%[At-Risk Note]%')
        .gte('occurred_at', cutoff);

      // Build map: userId -> latest at-risk note timestamp (within window)
      const noteByUser = new Map<string, string>();
      for (const n of (adminNotes || [])) {
        if (!noteByUser.has(n.user_id)) {
          noteByUser.set(n.user_id, n.occurred_at);
        }
      }

      const teamResolved: AtRiskStudent[] = [];
      const studentResolved: AtRiskStudent[] = [];

      for (const user of (resolvedUsers || [])) {
        const meta = candidateResolved.get(user.id)!;
        const reasonTypes: AtRiskReason[] = meta.reasons;
        const entry: AtRiskStudent = {
          user_id: user.id,
          student_id: user.id,
          name: user.full_name || 'Unknown',
          email: user.email || '',
          phone: (user as any).phone || null,
          reasons: reasonTypes.map(type => ({
            type,
            label: type.replace(/_/g, ' '),
            detail: 'Resolved',
          })),
          severity: meta.severity as 'warning' | 'critical',
          resolved_at: meta.resolved_at,
        };

        if (noteByUser.has(user.id)) {
          teamResolved.push(entry);
        } else {
          studentResolved.push(entry);
        }
      }

      setResolvedByTeam(teamResolved);
      setResolvedByStudent(studentResolved);
    } catch (err) {
      safeLogger.warn('Failed to fetch resolved students:', err);
      setResolvedByTeam([]);
      setResolvedByStudent([]);
    }
  };

  useEffect(() => {
    fetchAtRiskStudents();
  }, [fetchAtRiskStudents]);

  return { students, resolvedByTeam, resolvedByStudent, loading, refetch: fetchAtRiskStudents };
};
