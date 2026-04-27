import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConnectAccountsDialog } from '@/components/ConnectAccountsDialog';
import { OnboardingVideoModal } from '@/components/OnboardingVideoModal';
import { useAuth } from '@/hooks/useAuth';
import { useCourses } from '@/hooks/useCourses';
import { useCourseRecordings } from '@/hooks/useCourseRecordings';
import { useActivePathwayAccess } from '@/hooks/useActivePathwayAccess';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';
import { InactiveLMSBanner } from '@/components/InactiveLMSBanner';
import { useToast } from '@/hooks/use-toast';
import { extractFinancialGoalForDisplay } from '@/utils/dreamGoalUtils';
import { safeQuery, safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';
import { CourseSelector } from '@/components/courses/CourseSelector';
import type { UserDataResult, StudentDataResult } from '@/types/database';
import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';

// Extracted dashboard components
import { LiveSessionBanner } from '@/components/dashboard/LiveSessionBanner';
import { LearningJourneyCard } from '@/components/dashboard/LearningJourneyCard';
import { ContinueLearningCard } from '@/components/dashboard/ContinueLearningCard';
import { NextAssignmentCard } from '@/components/dashboard/NextAssignmentCard';
import { ProgressSummaryCard } from '@/components/dashboard/ProgressSummaryCard';

interface Assignment {
  id: string;
  name: string;
  description?: string;
  due_days?: number;
  created_at?: string;
}

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  icon: string;
}

export function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const {
    enrolledCourses,
    activeCourse,
    setActiveCourse,
    loading: coursesLoading,
    isMultiCourseEnabled,
  } = useCourses();

  const {
    recordings,
    courseProgress: computedProgress,
    loading: recordingsLoading,
  } = useCourseRecordings(activeCourse?.id || null);

  const {
    isInPathwayMode,
    pathwayState,
    pathwayCourses,
    loading: pathwayLoading,
  } = useActivePathwayAccess();

  const loading = coursesLoading || recordingsLoading || pathwayLoading;

  // State
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dreamGoal, setDreamGoal] = useState('');
  const [courseProgress, setCourseProgress] = useState(0);
  const [nextAssignment, setNextAssignment] = useState<Assignment | null>(null);
  const [assignmentDueStatus, setAssignmentDueStatus] = useState<'future' | 'overdue'>('future');
  const [shopifyConnected, setShopifyConnected] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [leaderboardPosition, setLeaderboardPosition] = useState<{ rank: number; total: number } | null>(null);
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [userLMSStatus, setUserLMSStatus] = useState('active');
  const [firstOnboardingAnswer, setFirstOnboardingAnswer] = useState('');
  const [firstOnboardingRange, setFirstOnboardingRange] = useState<{ min: string; max: string } | null>(null);
  const [batchEnrollment, setBatchEnrollment] = useState<{ batchId: string; batchName: string } | null>(null);
  const [upcomingSession, setUpcomingSession] = useState<{
    id: string; title: string; start_time: string; mentor_name: string; link?: string; description?: string;
  } | null>(null);
  const [currentLockReason, setCurrentLockReason] = useState<{
    reason: string; unlockDate?: string; nextLesson?: string;
  } | null>(null);
  const [showOnboardingVideo, setShowOnboardingVideo] = useState(false);
  const [onboardingVideoUrl, setOnboardingVideoUrl] = useState('');
  const [checkingVideo, setCheckingVideo] = useState(true);

  // Check for onboarding video requirement
  useEffect(() => {
    const checkOnboardingVideo = async () => {
      if (!user?.id) return;
      try {
        const { data: settings } = await supabase
          .from('company_settings').select('onboarding_video_url').eq('id', 1).maybeSingle();
        const { data: student } = await supabase
          .from('students').select('onboarding_completed, onboarding_video_watched').eq('user_id', user.id).maybeSingle();
        const videoUrl = settings?.onboarding_video_url;
        if (videoUrl && videoUrl.trim() !== '' && student?.onboarding_completed && !student?.onboarding_video_watched) {
          setOnboardingVideoUrl(videoUrl);
          setShowOnboardingVideo(true);
        }
      } catch (error) {
        logger.error('Error checking onboarding video:', error);
      } finally {
        setCheckingVideo(false);
      }
    };
    checkOnboardingVideo();
  }, [user?.id]);

  useEffect(() => {
    if (user?.id && !loading) fetchDashboardData();
  }, [user?.id, loading]);

  useEffect(() => {
    if (computedProgress !== undefined) setCourseProgress(computedProgress);
  }, [computedProgress]);

  const fetchDashboardData = async () => {
    if (!user?.id) return;
    try {
      // Fetch user data
      const userResult = await safeQuery<UserDataResult>(
        supabase.from('users').select('dream_goal_summary, shopify_credentials, meta_ads_credentials, lms_status').eq('id', user.id).single(),
        `fetch user data for dashboard ${user.id}`
      );
      if (userResult.data) {
        setDreamGoal(userResult.data.dream_goal_summary || '');
        setShopifyConnected(!!userResult.data.shopify_credentials);
        setMetaConnected(!!userResult.data.meta_ads_credentials);
        setUserLMSStatus(userResult.data.lms_status || 'active');
      }

      // Fetch student data
      const studentRes = await safeMaybeSingle<StudentDataResult>(
        supabase.from('students').select('id, answers_json, goal_brief').eq('user_id', user.id).maybeSingle(),
        `fetch student data for ${user.id}`
      );
      const studentData = studentRes.data;

      // Parse onboarding answers
      try {
        let firstAnswerText = '';
        let answers: any = studentData?.answers_json;
        if (typeof answers === 'string') { try { answers = JSON.parse(answers); } catch {} }
        if (answers) {
          if (Array.isArray(answers)) {
            const val1: any = answers[0]?.value;
            if (Array.isArray(val1)) firstAnswerText = val1.join(', ');
            else if (val1 && typeof val1 === 'object') firstAnswerText = (val1.name || val1.url || '');
            else if (val1 !== null && val1 !== undefined) firstAnswerText = String(val1);
          } else if (typeof answers === 'object') {
            const entries = Object.values(answers as Record<string, any>) as any[];
            const sorted = entries.sort((a, b) => (a?.order || 0) - (b?.order || 0));
            if (sorted[0]) {
              const val1: any = sorted[0]?.value;
              if (Array.isArray(val1)) firstAnswerText = val1.join(', ');
              else if (val1 && typeof val1 === 'object') firstAnswerText = (val1.name || val1.url || '');
              else if (val1 !== null && val1 !== undefined) firstAnswerText = String(val1);
            }
          }
        }
        if (!firstAnswerText && studentData?.goal_brief) firstAnswerText = String(studentData.goal_brief);
        
        // Range parsing
        let rangeMin = '', rangeMax = '';
        try {
          if (answers) {
            const getRange = (v: any) => {
              if (Array.isArray(v) && v.length >= 2) return { min: String(v[0]), max: String(v[1]) };
              if (typeof v === 'string') {
                const parts = v.split(/\s*(?:to|-)\s*/i).map(s => s.trim()).filter(Boolean);
                if (parts.length >= 2) return { min: parts[0], max: parts[1] };
              }
              if (v && typeof v === 'object' && (v.min || v.max)) return { min: String(v.min ?? ''), max: String(v.max ?? '') };
              return null;
            };
            const firstVal = Array.isArray(answers) ? answers[0]?.value :
              (Object.values(answers as Record<string, any>) as any[]).sort((a, b) => (a?.order || 0) - (b?.order || 0))[0]?.value;
            const range = getRange(firstVal);
            if (range) { rangeMin = range.min; rangeMax = range.max; }
          }
        } catch {}
        setFirstOnboardingRange(rangeMin && rangeMax ? { min: rangeMin, max: rangeMax } : null);
        if (firstAnswerText) {
          setFirstOnboardingAnswer(firstAnswerText);
          if (!userResult.data?.dream_goal_summary) setDreamGoal(firstAnswerText);
        } else if (!userResult.data?.dream_goal_summary && studentData?.goal_brief) {
          setDreamGoal(String(studentData.goal_brief));
        }
      } catch (e) { logger.warn('Failed to parse onboarding answers', e); }

      // Calculate progress from recordings
      if (recordings && recordings.length > 0) {
        const watchedRecordings = recordings.filter(r => r.isWatched).length;
        const submittedAssignments = recordings.filter(r => r.hasAssignment && r.assignmentSubmitted).length;
        const totalItems = recordings.length + recordings.filter(r => r.hasAssignment).length;
        const completedItems = watchedRecordings + submittedAssignments;
        setCourseProgress(totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0);
        const firstLocked = recordings.find(r => !r.isUnlocked);
        setCurrentLockReason(firstLocked ? {
          reason: firstLocked.lockReason || 'locked',
          unlockDate: firstLocked.dripUnlockDate || undefined,
          nextLesson: firstLocked.recording_title,
        } : null);
      }

      // Fetch next assignment
      const { data: assignments } = await supabase.from('assignments').select('*').order('created_at', { ascending: true });
      const { data: submissions } = await supabase.from('submissions').select('assignment_id').eq('student_id', user.id);
      const { data: assignmentRecordings } = await supabase.from('available_lessons').select('id, assignment_id');
      const submittedIds = submissions?.map(s => s.assignment_id) || [];
      const unlockedRecordingIds = new Set((recordings || []).filter(r => r.isUnlocked).map(r => r.id));
      const pendingAssignments = (assignments || []).filter(a => {
        if (submittedIds.includes(a.id)) return false;
        const linked = assignmentRecordings?.find(r => r.assignment_id === a.id);
        if (linked && !unlockedRecordingIds.has(linked.id)) return false;
        return true;
      });
      if (pendingAssignments.length > 0) {
        setNextAssignment(pendingAssignments[0]);
        const dueDate = new Date(pendingAssignments[0].created_at || '');
        dueDate.setDate(dueDate.getDate() + (pendingAssignments[0].due_days || 7));
        setAssignmentDueStatus(new Date() > dueDate ? 'overdue' : 'future');
      } else { setNextAssignment(null); }

      // Fetch milestones
      try {
        const { data: allMilestones } = await supabase.from('milestones').select('*').eq('is_active', true).order('display_order', { ascending: true });
        let completedMilestoneIds = new Set<string>();
        try {
          const { data: userMilestones } = await supabase.from('user_milestones').select('milestone_id').eq('user_id', user.id);
          completedMilestoneIds = new Set(userMilestones?.map(um => um.milestone_id) || []);
        } catch {}
        setMilestones((allMilestones || []).map(m => ({ id: m.id, title: m.name, completed: completedMilestoneIds.has(m.id), icon: m.icon || '🏆' })));
      } catch {}

      // Fetch leaderboard (batch-scoped if student has a batch)
      try {
        const studentId = studentData?.id;
        let studentBatchId: string | null = null;
        if (studentId) {
          const { data: enrollment } = await supabase
            .from('course_enrollments')
            .select('batch_id')
            .eq('student_id', studentId)
            .eq('status', 'active')
            .not('batch_id', 'is', null)
            .maybeSingle();
          studentBatchId = enrollment?.batch_id || null;
        }

        safeLogger.info('[Dashboard] Leaderboard fetch', { studentId, batchId: studentBatchId });

        if (studentBatchId) {
          // Get all students in same batch
          const { data: batchEnrollments } = await supabase
            .from('course_enrollments')
            .select('student_id')
            .eq('batch_id', studentBatchId)
            .eq('status', 'active');
          
          const batchStudentIds = batchEnrollments?.map(e => e.student_id) || [];
          
          // Get user_ids from student_ids
          const { data: batchStudents } = await supabase
            .from('students')
            .select('user_id')
            .in('id', batchStudentIds);
          
          const batchUserIds = batchStudents?.map(s => s.user_id) || [];
          
          safeLogger.info('[Dashboard] Batch users found', { count: batchUserIds.length });

          // Get snapshots for batch members, sorted by score
          const { data: batchSnapshots } = await supabase
            .from('leaderboard_snapshots')
            .select('user_id, score, progress')
            .in('user_id', batchUserIds)
            .order('score', { ascending: false });
          
          safeLogger.info('[Dashboard] Batch snapshots found', { count: batchSnapshots?.length || 0 });

          if (batchSnapshots && batchSnapshots.length > 0) {
            const userIndex = batchSnapshots.findIndex(s => s.user_id === user.id);
            const rank = userIndex >= 0 ? userIndex + 1 : batchSnapshots.length + 1;
            setLeaderboardPosition({ rank, total: batchSnapshots.length });
          } else {
            // No snapshots yet but batch exists - show position as 1 of batch size
            setLeaderboardPosition({ rank: 1, total: batchUserIds.length || 1 });
          }
        } else {
          // Fallback: global rank
          const { data: userSnapshot } = await supabase.from('leaderboard_snapshots').select('rank').eq('user_id', user.id).maybeSingle();
          const { count: totalActiveStudents } = await supabase.from('leaderboard_snapshots').select('*', { count: 'exact', head: true });
          
          safeLogger.info('[Dashboard] Global rank', { rank: userSnapshot?.rank, total: totalActiveStudents });

          if (userSnapshot?.rank && totalActiveStudents) {
            setLeaderboardPosition({ rank: userSnapshot.rank, total: totalActiveStudents });
          } else if (totalActiveStudents) {
            setLeaderboardPosition({ rank: totalActiveStudents + 1, total: totalActiveStudents });
          } else {
            // No leaderboard data at all - still show something
            setLeaderboardPosition({ rank: 1, total: 1 });
          }
        }
      } catch (err) {
        safeLogger.error('[Dashboard] Leaderboard fetch error:', err);
      }

      // Fetch batch enrollment
      let fetchedBatchId: string | null = null;
      try {
        const studentId = studentData?.id;
        if (studentId) {
          const { data: enrollment } = await supabase
            .from('course_enrollments').select('batch_id, batches!inner(id, name)')
            .eq('student_id', studentId).not('batch_id', 'is', null).maybeSingle();
          if (enrollment?.batch_id && enrollment?.batches) {
            fetchedBatchId = enrollment.batch_id;
            setBatchEnrollment({ batchId: enrollment.batch_id, batchName: (enrollment.batches as any).name });
          }
        }
      } catch {}

      // Fetch upcoming live session
      try {
        const nowDate = new Date();
        let sessionQuery = supabase
          .from('success_sessions').select('id, title, start_time, end_time, mentor_name, link, description, status')
          .in('status', ['upcoming', 'live']).not('link', 'is', null).neq('link', '')
          .order('start_time', { ascending: true }).limit(5);
        const currentBatchId = fetchedBatchId;
        if (currentBatchId) {
          sessionQuery = sessionQuery.or(`batch_id.eq.${currentBatchId},batch_ids.cs.["${currentBatchId}"],and(batch_id.is.null,batch_ids.is.null)`);
        } else if (activeCourse?.id) {
          sessionQuery = sessionQuery.or(`course_id.eq.${activeCourse.id},and(course_id.is.null,batch_id.is.null,batch_ids.is.null)`);
        }
        const { data: sessionData } = await sessionQuery;
        if (sessionData && sessionData.length > 0) {
          const validSessions = sessionData.filter((s: any) => {
            const start = new Date(s.start_time);
            const end = s.end_time ? new Date(s.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
            return nowDate < end;
          });
          const liveSession = validSessions.find((s: any) => new Date(s.start_time) <= nowDate);
          const upcomingSes = validSessions.find((s: any) => new Date(s.start_time) > nowDate);
          setUpcomingSession(liveSession || upcomingSes || null);
        } else { setUpcomingSession(null); }
      } catch {}

    } catch (error) {
      logger.error('Error fetching dashboard data:', error);
      setHasError(true);
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load dashboard data');
      toast({ title: "Dashboard Loading Error", description: "Some dashboard features may not work properly. Please refresh the page.", variant: "destructive" });
    }
  };

  // Early returns
  if (!user) {
    return <div className="flex justify-center items-center h-64"><div className="text-lg">Loading user data...</div></div>;
  }
  if (loading || checkingVideo) {
    return <div className="flex justify-center items-center h-64"><div className="text-lg">Loading your dashboard...</div></div>;
  }
  if (showOnboardingVideo && onboardingVideoUrl) {
    return <OnboardingVideoModal videoUrl={onboardingVideoUrl} userId={user.id} onComplete={() => { setShowOnboardingVideo(false); window.location.reload(); }} />;
  }
  if (hasError) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <AlertCircle className="w-12 h-12 text-destructive" />
        <div className="text-lg text-destructive">Dashboard Error</div>
        <div className="text-sm text-muted-foreground max-w-md text-center">{errorMessage || 'Something went wrong loading your dashboard.'}</div>
        <Button onClick={() => { setHasError(false); setErrorMessage(''); fetchDashboardData(); }} variant="outline">Try Again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-6">
      <InactiveLMSBanner show={user?.role === 'student' && userLMSStatus === 'inactive'} />

      {/* Live Session Banner */}
      {upcomingSession && <LiveSessionBanner session={upcomingSession} />}

      {/* Course Selector */}
      {!isInPathwayMode && isMultiCourseEnabled && enrolledCourses.length > 1 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <h2 className="text-base sm:text-lg font-medium">Your Courses</h2>
          <CourseSelector courses={enrolledCourses} activeCourseId={activeCourse?.id || null} onCourseChange={setActiveCourse} loading={coursesLoading} />
        </div>
      )}

      {/* Learning Journey Card */}
      <LearningJourneyCard
        isInPathwayMode={isInPathwayMode}
        pathwayState={pathwayState}
        pathwayCourses={pathwayCourses}
        courseProgress={courseProgress}
        firstOnboardingAnswer={firstOnboardingAnswer}
        dreamGoal={dreamGoal}
      />

      {/* Two-Card Grid: Continue Learning + Next Assignment */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <ContinueLearningCard
          isInPathwayMode={isInPathwayMode}
          pathwayState={pathwayState}
          activeCourseTitle={activeCourse?.title || ''}
          currentLockReason={currentLockReason}
        />
        <NextAssignmentCard
          nextAssignment={nextAssignment}
          assignmentDueStatus={assignmentDueStatus}
        />
      </div>

      {/* Progress Summary: Milestones + Leaderboard in tabs */}
      <ProgressSummaryCard milestones={milestones} leaderboardPosition={leaderboardPosition} />

      {/* Connect Accounts Dialog */}
      <ConnectAccountsDialog open={connectDialogOpen} onOpenChange={setConnectDialogOpen} userId={user?.id} />
    </div>
  );
}
