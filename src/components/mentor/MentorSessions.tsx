import { useState, useEffect } from 'react';
import { safeLogger } from '@/lib/safe-logger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Video, Users, Eye, EyeOff, Play, ExternalLink, AlertTriangle, Copy, Check, BookOpen, GraduationCap, Unlock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

interface UnlockInfo {
  unlockedRecordings: number;
  totalRecordings: number;
  unlockedAssignments: number;
  totalAssignments: number;
}

interface MentorSession {
  id: string;
  title: string;
  description: string;
  mentor_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
  zoom_meeting_id?: string;
  zoom_passcode?: string;
  host_login_email?: string;
  host_login_pwd?: string;
  isAssignedToMe?: boolean;
  batch_id?: string;
  batch_name?: string;
  course_id?: string;
  course_title?: string;
  pathway_id?: string;
  pathway_name?: string;
  unlockInfo?: UnlockInfo;
}

export function MentorSessions() {
  const { user } = useAuth();
  const [upcomingSessions, setUpcomingSessions] = useState<MentorSession[]>([]);
  const [completedSessions, setCompletedSessions] = useState<MentorSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCredentials, setShowCredentials] = useState<{ [key: string]: boolean }>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchMentorSessions();
    }
  }, [user?.id]);

  const fetchMentorSessions = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .eq('mentor_id', user.id)
        .order('start_time', { ascending: true });

      if (error) throw error;

      const rawSessions = data || [];

      // Collect unique IDs - handle both legacy batch_id and new batch_ids JSONB array
      const batchIdSet = new Set<string>();
      rawSessions.forEach(s => {
        if (s.batch_id) batchIdSet.add(s.batch_id);
        // Parse batch_ids JSONB array
        const batchIdsField = (s as any).batch_ids;
        if (batchIdsField) {
          try {
            const parsed = typeof batchIdsField === 'string' ? JSON.parse(batchIdsField) : batchIdsField;
            if (Array.isArray(parsed)) parsed.forEach((id: string) => batchIdSet.add(id));
          } catch { /* ignore parse errors */ }
        }
      });
      const batchIds = [...batchIdSet];
      const courseIds = [...new Set(rawSessions.map(s => s.course_id).filter(Boolean))] as string[];
      const pathwayIds: string[] = [];

      // Parallel fetches for batch, course, pathway names
      const [batchesRes, coursesRes] = await Promise.all([
        batchIds.length > 0
          ? supabase.from('batches').select('id, name, start_date, course_id, pathway_id').in('id', batchIds)
          : Promise.resolve({ data: [], error: null }),
        courseIds.length > 0
          ? supabase.from('courses').select('id, title').in('id', courseIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const batchMap = new Map<string, { name: string; start_date: string; course_id: string | null; pathway_id: string | null }>();
      (batchesRes.data || []).forEach((b: any) => {
        batchMap.set(b.id, { name: b.name, start_date: b.start_date, course_id: b.course_id, pathway_id: b.pathway_id });
        if (b.pathway_id) pathwayIds.push(b.pathway_id);
      });

      // Also collect pathway_ids from sessions themselves (if stored directly)
      rawSessions.forEach(s => {
        if ((s as any).pathway_id) pathwayIds.push((s as any).pathway_id);
      });

      const uniquePathwayIds = [...new Set(pathwayIds)];

      const pathwaysRes = uniquePathwayIds.length > 0
        ? await supabase.from('learning_pathways').select('id, name').in('id', uniquePathwayIds)
        : { data: [], error: null };

      const courseMap = new Map<string, string>();
      (coursesRes.data || []).forEach((c: any) => courseMap.set(c.id, c.title));

      const pathwayMap = new Map<string, string>();
      (pathwaysRes.data || []).forEach((p: any) => pathwayMap.set(p.id, p.name));

      // Collect all course IDs we need unlock info for
      // For pathway-based sessions, resolve courses via pathway_courses
      const allCourseIds = new Set<string>();
      const pathwayCourseMap = new Map<string, string[]>();

      // Collect direct course IDs
      rawSessions.forEach(s => {
        if (s.course_id) allCourseIds.add(s.course_id);
        if (s.batch_id) {
          const batch = batchMap.get(s.batch_id);
          if (batch?.course_id) allCourseIds.add(batch.course_id);
        }
      });

      // Also resolve courses from pathways
      if (uniquePathwayIds.length > 0) {
        const { data: pathwayCourses } = await supabase
          .from('pathway_courses')
          .select('pathway_id, course_id')
          .in('pathway_id', uniquePathwayIds)
          .order('step_number');

        (pathwayCourses || []).forEach(pc => {
          allCourseIds.add(pc.course_id);
          if (!pathwayCourseMap.has(pc.pathway_id)) pathwayCourseMap.set(pc.pathway_id, []);
          pathwayCourseMap.get(pc.pathway_id)!.push(pc.course_id);
        });

        // Also fetch titles for these newly discovered courses
        const newCourseIds = [...allCourseIds].filter(id => !courseMap.has(id));
        if (newCourseIds.length > 0) {
          const { data: extraCourses } = await supabase.from('courses').select('id, title').in('id', newCourseIds);
          (extraCourses || []).forEach((c: any) => courseMap.set(c.id, c.title));
        }
      }

      // Fetch unlock info
      const unlockData = await fetchUnlockInfo([...allCourseIds], batchMap, rawSessions, pathwayCourseMap);

      const sessions: MentorSession[] = rawSessions.map(session => {
        // Resolve batch info from legacy batch_id or batch_ids JSONB array
        let batch = session.batch_id ? batchMap.get(session.batch_id) : null;
        let resolvedBatchName = batch?.name;
        let resolvedBatchId = session.batch_id;
        
        if (!batch) {
          // Try batch_ids JSONB array
          const batchIdsField = (session as any).batch_ids;
          if (batchIdsField) {
            try {
              const parsed = typeof batchIdsField === 'string' ? JSON.parse(batchIdsField) : batchIdsField;
              if (Array.isArray(parsed) && parsed.length > 0) {
                const names = parsed.map((id: string) => batchMap.get(id)?.name).filter(Boolean);
                resolvedBatchName = names.join(', ') || undefined;
                resolvedBatchId = parsed[0]; // Use first batch for course/pathway resolution
                batch = batchMap.get(parsed[0]) || null;
              }
            } catch { /* ignore */ }
          }
        }
        
        const effectiveCourseId = session.course_id || batch?.course_id || null;
        const effectivePathwayId = (session as any).pathway_id || batch?.pathway_id || null;

        // For pathway sessions, aggregate unlock info across all pathway courses
        let unlockInfo: UnlockInfo | undefined;
        if (effectivePathwayId && pathwayCourseMap.has(effectivePathwayId)) {
          const pCourseIds = pathwayCourseMap.get(effectivePathwayId)!;
          const aggregated: UnlockInfo = { unlockedRecordings: 0, totalRecordings: 0, unlockedAssignments: 0, totalAssignments: 0 };
          pCourseIds.forEach(cid => {
            const key = `${session.batch_id || ''}_${cid}`;
            const info = unlockData.get(key);
            if (info) {
              aggregated.unlockedRecordings += info.unlockedRecordings;
              aggregated.totalRecordings += info.totalRecordings;
              aggregated.unlockedAssignments += info.unlockedAssignments;
              aggregated.totalAssignments += info.totalAssignments;
            }
          });
          if (aggregated.totalRecordings > 0) unlockInfo = aggregated;
        } else {
          const unlockKey = `${session.batch_id || ''}_${effectiveCourseId || ''}`;
          unlockInfo = unlockData.get(unlockKey);
        }

        return {
          id: session.id,
          title: session.title,
          description: session.description || '',
          mentor_name: session.mentor_name || 'Unassigned',
          schedule_date: session.schedule_date || '',
          start_time: session.start_time,
          end_time: session.end_time || '',
          link: session.link,
          status: session.status || 'upcoming',
          zoom_meeting_id: session.zoom_meeting_id || '',
          zoom_passcode: session.zoom_passcode || '',
          host_login_email: session.host_login_email || '',
          host_login_pwd: session.host_login_pwd || '',
          isAssignedToMe: true,
          batch_id: resolvedBatchId || undefined,
          batch_name: resolvedBatchName,
          course_id: effectiveCourseId || undefined,
          course_title: effectiveCourseId ? courseMap.get(effectiveCourseId) : undefined,
          pathway_id: effectivePathwayId || undefined,
          pathway_name: effectivePathwayId ? pathwayMap.get(effectivePathwayId) : undefined,
          unlockInfo,
        };
      });
      
      processSessions(sessions);
    } catch (error: any) {
      safeLogger.error('Error fetching mentor sessions', error);
      toast({
        title: "Error", 
        description: "Failed to fetch your sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUnlockInfo = async (
    courseIds: string[],
    batchMap: Map<string, { name: string; start_date: string; course_id: string | null; pathway_id: string | null }>,
    rawSessions: any[],
    pathwayCourseMap: Map<string, string[]>
  ): Promise<Map<string, UnlockInfo>> => {
    const result = new Map<string, UnlockInfo>();
    if (courseIds.length === 0) return result;

    try {
      // Get modules for each course using the RPC
      const modulePromises = courseIds.map(cid =>
        supabase.rpc('get_course_modules', { p_course_id: cid }).then(res => ({
          courseId: cid,
          modules: (res.data || []) as { module_title: string; module_id: string; recording_count: number; assignment_count: number }[]
        }))
      );
      const moduleResults = await Promise.all(modulePromises);

      // Build course -> module IDs map (available_lessons.module is a FK to modules.id)
      const courseModuleIds = new Map<string, string[]>();
      moduleResults.forEach(({ courseId, modules }) => {
        courseModuleIds.set(courseId, modules.map(m => m.module_id));
      });

      // Get all module IDs we need
      const allModuleIds = [...new Set(moduleResults.flatMap(r => r.modules.map(m => m.module_id)))];
      
      if (allModuleIds.length === 0) return result;

      // Fetch available_lessons for these modules using module ID
      const { data: lessons } = await supabase
        .from('available_lessons')
        .select('id, module, drip_days, assignment_id')
        .in('module', allModuleIds);

      if (!lessons) return result;

      // Group lessons by module ID
      const lessonsByModule = new Map<string, typeof lessons>();
      lessons.forEach(l => {
        const mod = l.module || '';
        if (!lessonsByModule.has(mod)) lessonsByModule.set(mod, []);
        lessonsByModule.get(mod)!.push(l);
      });

      // For each batch+course combo, calculate unlocks
      const today = new Date();
      today.setHours(23, 59, 59, 999);

      // Build all batch+course combos we need
      const combos = new Set<string>();
      rawSessions.forEach(session => {
        const batch = session.batch_id ? batchMap.get(session.batch_id) : null;
        const effectivePathwayId = session.pathway_id || batch?.pathway_id;

        if (effectivePathwayId && pathwayCourseMap.has(effectivePathwayId)) {
          // Add combos for all courses in the pathway
          pathwayCourseMap.get(effectivePathwayId)!.forEach(cid => {
            combos.add(`${session.batch_id || ''}_${cid}`);
          });
        } else {
          const effectiveCourseId = session.course_id || batch?.course_id;
          if (effectiveCourseId) combos.add(`${session.batch_id || ''}_${effectiveCourseId}`);
        }
      });

      combos.forEach(combo => {
        const [batchId, courseId] = combo.split('_');
        if (!courseId) return;

        const batch = batchId ? batchMap.get(batchId) : null;
        const moduleIds = courseModuleIds.get(courseId) || [];
        const courseLessons = moduleIds.flatMap(mid => lessonsByModule.get(mid) || []);

        const startDate = batch?.start_date ? new Date(batch.start_date) : null;

        let unlockedRecordings = 0;
        let unlockedAssignments = 0;
        let totalAssignments = 0;

        courseLessons.forEach(lesson => {
          const hasAssignment = !!lesson.assignment_id;
          if (hasAssignment) totalAssignments++;

          if (startDate) {
            const unlockDate = new Date(startDate);
            unlockDate.setDate(unlockDate.getDate() + (lesson.drip_days || 0));
            if (unlockDate <= today) {
              unlockedRecordings++;
              if (hasAssignment) unlockedAssignments++;
            }
          } else {
            unlockedRecordings++;
            if (hasAssignment) unlockedAssignments++;
          }
        });

        result.set(combo, {
          unlockedRecordings,
          totalRecordings: courseLessons.length,
          unlockedAssignments,
          totalAssignments,
        });
      });
    } catch (error) {
      safeLogger.error('Error fetching unlock info', error);
    }

    return result;
  };

  const processSessions = (sessions: MentorSession[]) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const upcoming = sessions.filter(session => {
      const sessionStart = new Date(session.start_time);
      sessionStart.setHours(0, 0, 0, 0);
      return sessionStart >= now;
    });
    
    const completed = sessions.filter(session => {
      const sessionStart = new Date(session.start_time);
      sessionStart.setHours(0, 0, 0, 0);
      return sessionStart < now;
    });

    setUpcomingSessions(upcoming);
    setCompletedSessions(completed);
  };

  const canStartSession = (session: MentorSession) => {
    const now = new Date();
    const sessionStart = new Date(session.start_time);
    
    if (!session.end_time) {
      return session.isAssignedToMe && session.status === 'upcoming' && now >= new Date(sessionStart.getTime() - 15 * 60 * 1000);
    }
    
    const sessionEnd = new Date(session.end_time);
    const cutoffTime = new Date(sessionEnd.getTime() + 60 * 60 * 1000);
    
    return session.isAssignedToMe && session.status === 'upcoming' && now >= new Date(sessionStart.getTime() - 15 * 60 * 1000) && now <= cutoffTime;
  };

  const handleStartSession = async (session: MentorSession) => {
    try {
      if (!session.host_login_email || !session.host_login_pwd) {
        toast({
          title: "Missing Credentials",
          description: "Host login credentials not configured for this session",
          variant: "destructive"
        });
        return;
      }

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = 'https://zoom.us/signin';
      form.target = '_blank';

      const emailField = document.createElement('input');
      emailField.type = 'hidden';
      emailField.name = 'email';
      emailField.value = session.host_login_email;
      form.appendChild(emailField);

      const passwordField = document.createElement('input');
      passwordField.type = 'hidden';
      passwordField.name = 'password';
      passwordField.value = session.host_login_pwd;
      form.appendChild(passwordField);

      if (session.zoom_meeting_id) {
        const redirectField = document.createElement('input');
        redirectField.type = 'hidden';
        redirectField.name = 'redirect_uri';
        redirectField.value = `https://zoom.us/wc/join/${session.zoom_meeting_id}`;
        form.appendChild(redirectField);
      }

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);

      toast({
        title: "Starting Session",
        description: `Opening Zoom for: ${session.title}`,
      });

      safeLogger.activity('Session started', { 
        sessionTitle: session.title, 
        mentorId: user?.id 
      });
    } catch (error) {
      safeLogger.error('Error starting session', error);
      toast({
        title: "Error",
        description: "Failed to start session",
        variant: "destructive"
      });
    }
  };

  const toggleCredentials = (sessionId: string) => {
    setShowCredentials(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }));
  };

  const formatDateTime = (dateTimeString: string) => {
    try {
      return format(new Date(dateTimeString), 'MMM dd, yyyy • h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const maskValue = (value: string, show: boolean) => {
    if (show || !value) return value;
    return `•••${value.slice(-4)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your sessions...</p>
        </div>
      </div>
    );
  }

  const copyToClipboard = (value: string, fieldId: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const CopyableField = ({ label, value, fieldId, isMasked = false }: { label: string; value: string; fieldId: string; isMasked?: boolean }) => (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
        <p className="font-mono text-sm flex-1">{value ? (isMasked ? '••••••••' : value) : 'Not provided'}</p>
        {value && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 shrink-0" onClick={() => copyToClipboard(value, fieldId)}>
            {copiedField === fieldId ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
        )}
      </div>
    </div>
  );

  const SessionContextBadges = ({ session }: { session: MentorSession }) => (
    <div className="flex flex-wrap gap-2 mt-2">
      {session.batch_name && (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          <Users className="w-3 h-3 mr-1" />
          Batch: {session.batch_name}
        </Badge>
      )}
      {session.pathway_name ? (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          🎯 Pathway: {session.pathway_name}
        </Badge>
      ) : session.course_title ? (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
          <BookOpen className="w-3 h-3 mr-1" />
          Course: {session.course_title}
        </Badge>
      ) : null}
      {session.unlockInfo && (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Unlock className="w-3 h-3 mr-1" />
          {session.unlockInfo.unlockedRecordings}/{session.unlockInfo.totalRecordings} Recordings
          {session.unlockInfo.totalAssignments > 0 && ` · ${session.unlockInfo.unlockedAssignments} Assignments`}
        </Badge>
      )}
    </div>
  );

  const SessionCard = ({ session, isUpcoming = true }: { session: MentorSession; isUpcoming?: boolean }) => {
    const canStart = canStartSession(session);
    const showCreds = showCredentials[session.id];
    const needsSetup = !session.zoom_meeting_id && !session.zoom_passcode && !session.link;

    return (
      <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/60">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <CardTitle className="text-xl text-primary">{session.title}</CardTitle>
              {session.description && (
                <p className="text-muted-foreground">{session.description}</p>
              )}
              {session.mentor_name && (
                <p className="text-sm text-muted-foreground">
                  Mentor: <span className="font-medium">{session.mentor_name}</span>
                  {session.isAssignedToMe && <Badge variant="outline" className="ml-2 bg-primary/10">Assigned to you</Badge>}
                </p>
              )}
              <SessionContextBadges session={session} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {needsSetup && (
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Needs Setup
                </Badge>
              )}
              <Badge variant={isUpcoming ? "default" : "secondary"}>
                {session.status}
              </Badge>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Session Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Date & Time</div>
                <div className="text-sm text-muted-foreground">
                  {formatDateTime(session.start_time)}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
              <Clock className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Duration</div>
                <div className="text-sm text-muted-foreground">
                  {format(new Date(session.start_time), 'h:mm a')}
                  {session.end_time && ` - ${format(new Date(session.end_time), 'h:mm a')}`}
                </div>
              </div>
            </div>
          </div>

          {/* Zoom Details */}
          {isUpcoming && (session.zoom_meeting_id || session.zoom_passcode) && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-blue-900">Zoom Meeting Details</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleCredentials(session.id)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  {showCreds ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {showCreds ? 'Hide' : 'Show'}
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium text-blue-700">Meeting ID: </span>
                  <span className="font-mono">{maskValue(session.zoom_meeting_id || '', showCreds)}</span>
                </div>
                <div>
                  <span className="font-medium text-blue-700">Passcode: </span>
                  <span className="font-mono">{maskValue(session.zoom_passcode || '', showCreds)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              {isUpcoming ? (
                session.isAssignedToMe ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    <Users className="w-3 h-3 mr-1" />
                    Ready to Host
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-50 text-gray-700">
                    <Users className="w-3 h-3 mr-1" />
                    Not Assigned to You
                  </Badge>
                )
              ) : (
                <Badge variant="outline" className="bg-gray-50 text-gray-700">
                  Completed
                </Badge>
              )}
            </div>
            
            <div className="flex gap-2">
              {isUpcoming && canStart ? (
                <Button
                  onClick={() => handleStartSession(session)}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Session
                </Button>
              ) : isUpcoming && !session.isAssignedToMe ? (
                <Button variant="outline" disabled>
                  <Users className="w-4 h-4 mr-2" />
                  Not Your Session
                </Button>
              ) : isUpcoming ? (
                <Button variant="outline" disabled>
                  <Clock className="w-4 h-4 mr-2" />
                  Not Yet Time
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => {
                    if (session.link) {
                      window.open(session.link, '_blank');
                    }
                  }}
                  disabled={!session.link}
                >
                  <Video className="w-4 h-4 mr-2" />
                  View Recording
                </Button>
              )}
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Eye className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{session.title}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <SessionContextBadges session={session} />
                    <div className="grid grid-cols-2 gap-4">
                      <CopyableField label="Meeting ID" value={session.zoom_meeting_id || ''} fieldId={`mid-${session.id}`} />
                      <CopyableField label="Passcode" value={session.zoom_passcode || ''} fieldId={`pass-${session.id}`} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <CopyableField label="Host Email" value={session.host_login_email || ''} fieldId={`email-${session.id}`} />
                      <CopyableField label="Host Password" value={session.host_login_pwd || ''} fieldId={`pwd-${session.id}`} isMasked={true} />
                    </div>
                    {isUpcoming && canStart && (
                      <div className="pt-4 border-t">
                        <Button
                          onClick={() => handleStartSession(session)}
                          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Session in Zoom
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-primary">🎯 My Success Sessions</h1>
        <p className="text-muted-foreground mt-2">Host and manage your assigned success sessions</p>
      </div>

      {/* Upcoming Sessions */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-1 h-6 bg-primary rounded-full"></div>
          <h2 className="text-xl font-semibold">Upcoming Sessions</h2>
          <Badge variant="secondary" className="ml-2">
            {upcomingSessions.length}
          </Badge>
        </div>
        
        {upcomingSessions.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Upcoming Sessions</h3>
              <p className="text-muted-foreground">
                You don't have any sessions assigned yet. Contact your admin for session assignments.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {upcomingSessions.map((session) => (
              <SessionCard key={session.id} session={session} isUpcoming={true} />
            ))}
          </div>
        )}
      </div>

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-6 bg-secondary rounded-full"></div>
            <h2 className="text-xl font-semibold">Completed Sessions</h2>
            <Badge variant="secondary" className="ml-2">
              {completedSessions.length}
            </Badge>
          </div>
          
          <div className="grid gap-6">
            {completedSessions.map((session) => (
              <SessionCard key={session.id} session={session} isUpcoming={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
