import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, Save, Loader2, Video, Plus, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { addDays, format } from 'date-fns';

interface ContentTimelineDialogProps {
  type: 'course' | 'pathway';
  entityId: string;
  entityName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface RecordingItem {
  id: string;
  recording_title: string | null;
  sequence_order: number | null;
  duration_min: number | null;
  drip_days: number | null;
  module_id: string | null;
  module_title: string;
  course_id: string | null;
  course_title: string;
  step_number: number | null;
}

interface SessionItem {
  id: string;
  title: string;
  schedule_date: string | null;
  drip_days: number | null;
  course_id: string | null;
  course_title: string;
  step_number: number | null;
}

export function ContentTimelineDialog({ type, entityId, entityName, open, onOpenChange }: ContentTimelineDialogProps) {
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedDripDays, setEditedDripDays] = useState<Record<string, number | null>>({});
  const [editedSessionDripDays, setEditedSessionDripDays] = useState<Record<string, number | null>>({});
  const [editedSessionTitles, setEditedSessionTitles] = useState<Record<string, string>>({});
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [addingSessionForCourse, setAddingSessionForCourse] = useState<string | null>(null);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionDripDays, setNewSessionDripDays] = useState<number | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open && entityId) {
      fetchAll();
      setEditedDripDays({});
      setEditedSessionDripDays({});
      setEditedSessionTitles({});
      setEditingTitleId(null);
      setAddingSessionForCourse(null);
      setNewSessionTitle('');
      setNewSessionDripDays(null);
    }
  }, [open, entityId]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      if (type === 'course') {
        const items = await fetchCourseRecordings(entityId);
        setRecordings(items || []);
        await fetchCourseSessions([{ courseId: entityId, courseTitle: entityName, stepNumber: null }]);
      } else {
        await fetchPathwayAll(entityId);
      }
    } catch (error) {
      logger.error('Error fetching timeline data:', error);
      toast({ title: "Error", description: "Failed to load timeline", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourseRecordings = async (courseId: string, courseTitle?: string, stepNumber?: number | null): Promise<RecordingItem[]> => {
    const { data: modules } = await supabase
      .from('modules')
      .select('id, title, order')
      .eq('course_id', courseId)
      .order('order', { ascending: true });

    if (!modules?.length) return [];

    const moduleIds = modules.map(m => m.id);
    const { data: lessons } = await supabase
      .from('available_lessons')
      .select('id, recording_title, sequence_order, duration_min, drip_days, module')
      .in('module', moduleIds)
      .order('sequence_order', { ascending: true });

    return (lessons || []).map(l => {
      const mod = modules.find(m => m.id === l.module);
      return {
        id: l.id,
        recording_title: l.recording_title,
        sequence_order: l.sequence_order,
        duration_min: l.duration_min,
        drip_days: l.drip_days,
        module_id: l.module,
        module_title: mod?.title || 'Unknown Module',
        course_id: courseId,
        course_title: courseTitle || entityName,
        step_number: stepNumber ?? null,
      };
    });
  };

  const fetchCourseSessions = async (courses: { courseId: string; courseTitle: string; stepNumber: number | null }[]) => {
    const courseIds = courses.map(c => c.courseId);
    const { data } = await supabase
      .from('success_sessions')
      .select('id, title, schedule_date, course_id, drip_days' as any)
      .in('course_id', courseIds)
      .order('schedule_date', { ascending: true }) as { data: any[] | null };

    const items: SessionItem[] = (data || []).map(s => {
      const course = courses.find(c => c.courseId === s.course_id);
      return {
        id: s.id,
        title: s.title,
        schedule_date: s.schedule_date,
        drip_days: (s as any).drip_days ?? null,
        course_id: s.course_id,
        course_title: course?.courseTitle || 'Unknown Course',
        step_number: course?.stepNumber ?? null,
      };
    });
    setSessions(items);
  };

  const fetchPathwayAll = async (pathwayId: string) => {
    const { data: pathwayCourses } = await supabase
      .from('pathway_courses')
      .select('course_id, step_number, courses(title)')
      .eq('pathway_id', pathwayId)
      .order('step_number', { ascending: true });

    if (!pathwayCourses?.length) {
      setRecordings([]);
      setSessions([]);
      return;
    }

    const courses = pathwayCourses.map(pc => ({
      courseId: pc.course_id,
      courseTitle: (pc.courses as any)?.title || 'Unknown Course',
      stepNumber: pc.step_number,
    }));

    const allItems: RecordingItem[] = [];
    for (const c of courses) {
      const items = await fetchCourseRecordings(c.courseId, c.courseTitle, c.stepNumber);
      allItems.push(...items);
    }
    setRecordings(allItems);
    await fetchCourseSessions(courses);
  };

  const handleDripDaysChange = (recordingId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setEditedDripDays(prev => ({ ...prev, [recordingId]: numValue }));
  };

  const handleSessionDripDaysChange = (sessionId: string, value: string) => {
    const numValue = value === '' ? null : parseInt(value);
    setEditedSessionDripDays(prev => ({ ...prev, [sessionId]: numValue }));
  };

  const getDripDaysValue = (recording: RecordingItem): number | null => {
    if (recording.id in editedDripDays) return editedDripDays[recording.id];
    return recording.drip_days;
  };

  const getSessionDripDaysValue = (session: SessionItem): number | null => {
    if (session.id in editedSessionDripDays) return editedSessionDripDays[session.id];
    return session.drip_days;
  };

  const hasChanges = Object.keys(editedDripDays).length > 0 || Object.keys(editedSessionDripDays).length > 0 || Object.keys(editedSessionTitles).length > 0;

  /**
   * Compute schedule_date for a session based on earliest batch start_date + drip_days.
   * Returns ISO date string or null if no batch found or drip_days is null.
   */
  const computeScheduleDate = async (courseId: string, dripDays: number | null): Promise<string | null> => {
    if (dripDays == null) return null;

    try {
      // Check batch_courses for direct course associations
      const { data: batchCourses } = await supabase
        .from('batch_courses')
        .select('batch_id, batches!inner(start_date)')
        .eq('course_id', courseId);

      // Check batch_pathways for pathway associations containing this course
      const { data: pathwayCourses } = await supabase
        .from('pathway_courses')
        .select('pathway_id')
        .eq('course_id', courseId);

      let batchStartDates: string[] = (batchCourses || [])
        .map((bc: any) => bc.batches?.start_date)
        .filter(Boolean);

      if (pathwayCourses?.length) {
        const pathwayIds = pathwayCourses.map(pc => pc.pathway_id);
        const { data: batchPathways } = await supabase
          .from('batch_pathways')
          .select('batch_id, batches!inner(start_date)')
          .in('pathway_id', pathwayIds);

        const pathwayBatchDates = (batchPathways || [])
          .map((bp: any) => bp.batches?.start_date)
          .filter(Boolean);
        batchStartDates = [...batchStartDates, ...pathwayBatchDates];
      }

      // Also check legacy batch.course_id direct link
      const { data: legacyBatches } = await supabase
        .from('batches')
        .select('start_date')
        .eq('course_id', courseId)
        .eq('status', 'active');

      if (legacyBatches?.length) {
        batchStartDates = [...batchStartDates, ...legacyBatches.map(b => b.start_date).filter(Boolean)];
      }

      if (!batchStartDates.length) return null;

      // Pick earliest start date
      const earliest = batchStartDates.sort()[0];
      const scheduleDate = addDays(new Date(earliest), dripDays);
      return format(scheduleDate, 'yyyy-MM-dd');
    } catch (error) {
      logger.error('Error computing schedule_date:', error);
      return null;
    }
  };

  const handleSave = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      // Save recording drip days
      for (const [id, drip_days] of Object.entries(editedDripDays)) {
        const { error } = await supabase
          .from('available_lessons')
          .update({ drip_days })
          .eq('id', id);
        if (error) throw error;
      }
      // Save session drip days, titles, and auto-calculate schedule_date
      for (const [id, drip_days] of Object.entries(editedSessionDripDays)) {
        const session = sessions.find(s => s.id === id);
        const courseId = session?.course_id;
        const schedule_date = courseId ? await computeScheduleDate(courseId, drip_days) : null;

        const titleUpdate = editedSessionTitles[id];
        const updatePayload: any = { drip_days, schedule_date };
        if (titleUpdate !== undefined) updatePayload.title = titleUpdate;
        const { error } = await supabase
          .from('success_sessions')
          .update(updatePayload)
          .eq('id', id);
        if (error) throw error;
      }
      // Save session titles that weren't already saved with drip days
      for (const [id, title] of Object.entries(editedSessionTitles)) {
        if (id in editedSessionDripDays) continue; // already handled
        const { error } = await supabase
          .from('success_sessions')
          .update({ title } as any)
          .eq('id', id);
        if (error) throw error;
      }

      const totalUpdates = Object.keys(editedDripDays).length + Object.keys(editedSessionDripDays).length + Object.keys(editedSessionTitles).length;
      toast({ title: "Success", description: `Updated ${totalUpdates} item(s)` });
      setEditedDripDays({});
      setEditedSessionDripDays({});
      setEditedSessionTitles({});
      await fetchAll();
    } catch (error) {
      logger.error('Error saving drip days:', error);
      toast({ title: "Error", description: "Failed to save changes", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStartAddSession = (courseId: string) => {
    setAddingSessionForCourse(courseId);
    setNewSessionTitle('');
    setNewSessionDripDays(null);
  };

  const handleCancelAddSession = () => {
    setAddingSessionForCourse(null);
    setNewSessionTitle('');
    setNewSessionDripDays(null);
  };

  const handleConfirmAddSession = async (courseId: string) => {
    const trimmedTitle = newSessionTitle.trim();
    if (!trimmedTitle || trimmedTitle.length > 200) {
      toast({ title: "Validation", description: "Title is required (max 200 chars)", variant: "destructive" });
      return;
    }

    setCreatingSession(true);
    try {
      // Auto-resolve mentor for this course
      const { data: mentorAssignment } = await supabase
        .from('mentor_course_assignments')
        .select('mentor_id, profiles!mentor_course_assignments_mentor_id_fkey(full_name)')
        .eq('course_id', courseId)
        .order('is_primary', { ascending: false })
        .limit(1)
        .maybeSingle();

      const mentorId = mentorAssignment?.mentor_id || null;
      const mentorName = (mentorAssignment?.profiles as any)?.full_name || null;

      // Auto-calculate schedule_date from batch start_date + drip_days
      const schedule_date = await computeScheduleDate(courseId, newSessionDripDays);

      // When opened from a pathway context, set pathway_id
      const pathwayId = type === 'pathway' ? entityId : null;

      // If opened from course context, check if course belongs to multiple pathways and clone
      let sessionsToInsert: any[] = [];
      if (type === 'course') {
        const { data: pcLinks } = await supabase
          .from('pathway_courses')
          .select('pathway_id')
          .eq('course_id', courseId);
        const pathwayIds = (pcLinks || []).map(pc => pc.pathway_id);
        
        if (pathwayIds.length > 1) {
          // Clone per pathway
          sessionsToInsert = pathwayIds.map(pid => ({
            title: trimmedTitle,
            course_id: courseId,
            mentor_id: mentorId,
            mentor_name: mentorName,
            link: 'TBD',
            start_time: new Date().toISOString(),
            status: 'upcoming',
            drip_days: newSessionDripDays,
            schedule_date,
            pathway_id: pid,
          }));
        } else {
          sessionsToInsert = [{
            title: trimmedTitle,
            course_id: courseId,
            mentor_id: mentorId,
            mentor_name: mentorName,
            link: 'TBD',
            start_time: new Date().toISOString(),
            status: 'upcoming',
            drip_days: newSessionDripDays,
            schedule_date,
            pathway_id: pathwayIds[0] || null,
          }];
        }
      } else {
        sessionsToInsert = [{
          title: trimmedTitle,
          course_id: courseId,
          mentor_id: mentorId,
          mentor_name: mentorName,
          link: 'TBD',
          start_time: new Date().toISOString(),
          status: 'upcoming',
          drip_days: newSessionDripDays,
          schedule_date,
          pathway_id: pathwayId,
        }];
      }

      const { error } = await supabase
        .from('success_sessions')
        .insert(sessionsToInsert as any);

      if (error) throw error;

      toast({ title: "Success", description: `Live session "${trimmedTitle}" created` });
      handleCancelAddSession();
      await fetchAll();
    } catch (error) {
      logger.error('Error creating session:', error);
      toast({ title: "Error", description: "Failed to create session", variant: "destructive" });
    } finally {
      setCreatingSession(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSessionId(sessionId);
    try {
      const { error } = await supabase
        .from('success_sessions')
        .delete()
        .eq('id', sessionId);
      if (error) throw error;
      toast({ title: "Deleted", description: "Live session removed" });
      await fetchAll();
    } catch (error) {
      logger.error('Error deleting session:', error);
      toast({ title: "Error", description: "Failed to delete session", variant: "destructive" });
    } finally {
      setDeletingSessionId(null);
    }
  };

  // Group recordings by course then by module
  const groupedByCourse = recordings.reduce((acc, r) => {
    const courseKey = r.course_id || 'unknown';
    if (!acc[courseKey]) {
      acc[courseKey] = { title: r.course_title, stepNumber: r.step_number, modules: {} };
    }
    const moduleKey = r.module_id || 'unknown';
    if (!acc[courseKey].modules[moduleKey]) {
      acc[courseKey].modules[moduleKey] = { title: r.module_title, recordings: [] };
    }
    acc[courseKey].modules[moduleKey].recordings.push(r);
    return acc;
  }, {} as Record<string, { title: string; stepNumber: number | null; modules: Record<string, { title: string; recordings: RecordingItem[] }> }>);

  // Group sessions by course
  const sessionsByCourse = sessions.reduce((acc, s) => {
    const courseKey = s.course_id || 'unknown';
    if (!acc[courseKey]) acc[courseKey] = [];
    acc[courseKey].push(s);
    return acc;
  }, {} as Record<string, SessionItem[]>);

  // Merge course keys from both recordings and sessions
  const allCourseKeys = new Set([...Object.keys(groupedByCourse), ...Object.keys(sessionsByCourse)]);
  
  const courseEntries = Array.from(allCourseKeys).map(key => {
    const recData = groupedByCourse[key];
    const sesData = sessionsByCourse[key] || [];
    return {
      courseId: key,
      title: recData?.title || sesData[0]?.course_title || 'Unknown Course',
      stepNumber: recData?.stepNumber ?? sesData[0]?.step_number ?? null,
      modules: recData?.modules || {},
      sessions: sesData,
    };
  }).sort((a, b) => (a.stepNumber ?? 0) - (b.stepNumber ?? 0));

  const hasContent = recordings.length > 0 || sessions.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Content Timeline - {entityName}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasContent ? (
          <p className="text-center text-muted-foreground py-8">
            No recordings or sessions found. Add modules, recordings, or live sessions first.
          </p>
        ) : (
          <div className="space-y-4">
            {courseEntries.map((courseData) => (
              <div key={courseData.courseId} className="space-y-3">
                {type === 'pathway' && (
                  <div className="flex items-center gap-2 pt-2 border-t first:border-t-0 first:pt-0">
                    <Badge variant="outline" className="text-xs">
                      Step {courseData.stepNumber}
                    </Badge>
                    <span className="font-semibold text-sm">{courseData.title}</span>
                  </div>
                )}

                {Object.entries(courseData.modules).map(([moduleId, moduleData]) => (
                  <div key={moduleId} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-1">
                      {moduleData.title}
                    </p>
                    <div className="border rounded-md divide-y">
                      {moduleData.recordings.map((rec) => {
                        const currentValue = getDripDaysValue(rec);
                        const isEdited = rec.id in editedDripDays;
                        return (
                          <div key={rec.id} className="flex items-center gap-3 px-3 py-2">
                            <span className="text-xs text-muted-foreground w-6 text-right shrink-0">
                              {rec.sequence_order ?? '-'}
                            </span>
                            <span className="text-sm flex-1 truncate">{rec.recording_title || 'Untitled'}</span>
                            {rec.duration_min != null && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {rec.duration_min}m
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                min={0}
                                value={currentValue ?? ''}
                                onChange={(e) => handleDripDaysChange(rec.id, e.target.value)}
                                className={`w-20 h-8 text-sm ${isEdited ? 'border-primary ring-1 ring-primary/30' : ''}`}
                                placeholder="0"
                              />
                              <span className="text-xs text-muted-foreground">days</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {(courseData.sessions.length > 0 || true) && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide pl-1 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5" />
                      Live Sessions
                    </p>
                    <div className="border rounded-md divide-y">
                      {courseData.sessions.map((session) => {
                        const currentValue = getSessionDripDaysValue(session);
                        const isEdited = session.id in editedSessionDripDays;
                        return (
                          <div key={session.id} className="flex items-center gap-3 px-3 py-2">
                            <Video className="w-4 h-4 text-muted-foreground shrink-0" />
                            {editingTitleId === session.id ? (
                              <Input
                                type="text"
                                value={editedSessionTitles[session.id] ?? session.title}
                                onChange={(e) => setEditedSessionTitles(prev => ({ ...prev, [session.id]: e.target.value }))}
                                onBlur={() => setEditingTitleId(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') setEditingTitleId(null);
                                }}
                                className="h-7 text-sm flex-1"
                                autoFocus
                                maxLength={200}
                              />
                            ) : (
                              <span
                                className="text-sm flex-1 truncate cursor-pointer hover:text-primary transition-colors"
                                onClick={() => setEditingTitleId(session.id)}
                                title="Click to edit title"
                              >
                                {editedSessionTitles[session.id] ?? session.title ?? 'Untitled Session'}
                              </span>
                            )}
                            {session.schedule_date && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(session.schedule_date).toLocaleDateString()}
                              </span>
                            )}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Input
                                type="number"
                                min={0}
                                value={currentValue ?? ''}
                                onChange={(e) => handleSessionDripDaysChange(session.id, e.target.value)}
                                className={`w-20 h-8 text-sm ${isEdited ? 'border-primary ring-1 ring-primary/30' : ''}`}
                                placeholder="0"
                              />
                              <span className="text-xs text-muted-foreground">days</span>
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteSession(session.id)}
                              disabled={deletingSessionId === session.id}
                            >
                              {deletingSessionId === session.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        );
                      })}

                      {/* Inline add session row */}
                      {addingSessionForCourse === courseData.courseId ? (
                        <div className="flex items-center gap-2 px-3 py-2">
                          <Video className="w-4 h-4 text-muted-foreground shrink-0" />
                          <Input
                            type="text"
                            value={newSessionTitle}
                            onChange={(e) => setNewSessionTitle(e.target.value)}
                            className="h-8 text-sm flex-1"
                            placeholder="Session title..."
                            maxLength={200}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleConfirmAddSession(courseData.courseId);
                              if (e.key === 'Escape') handleCancelAddSession();
                            }}
                          />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Input
                              type="number"
                              min={0}
                              value={newSessionDripDays ?? ''}
                              onChange={(e) => setNewSessionDripDays(e.target.value === '' ? null : parseInt(e.target.value))}
                              className="w-20 h-8 text-sm"
                              placeholder="0"
                            />
                            <span className="text-xs text-muted-foreground">days</span>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={() => handleConfirmAddSession(courseData.courseId)}
                            disabled={creatingSession}
                          >
                            {creatingSession ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 text-primary" />}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 shrink-0"
                            onClick={handleCancelAddSession}
                            disabled={creatingSession}
                          >
                            <X className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleStartAddSession(courseData.courseId)}
                          className="flex items-center gap-2 px-3 py-2 w-full text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Add Live Session
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
