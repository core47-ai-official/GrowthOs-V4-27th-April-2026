import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, CalendarDays, Video, BookOpen, User, Clock, Layers, GripVertical, AlertTriangle } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, addWeeks, subWeeks, isSameDay, isSameMonth, isToday, differenceInCalendarDays } from 'date-fns';
import { DndContext, DragEndEvent, DragStartEvent, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

interface CalendarEvent {
  id: string;
  title: string;
  date: Date;
  type: 'recording' | 'session';
  batchName: string;
  batchId: string;
  moduleName?: string;
  courseName: string;
  hostName?: string;
  status: 'done' | 'upcoming' | 'cancelled';
  assignmentName?: string;
  // For drag: original entity id and original date
  entityId: string;
  originalDripDays: number | null;
}

interface BatchInfo {
  id: string;
  name: string;
  start_date: string;
  course_id: string | null;
  pathway_id: string | null;
}

// Draggable event pill
function DraggableEvent({ event, getStatusBg, readOnly }: { event: CalendarEvent; getStatusBg: (s: string) => string; readOnly?: boolean }) {
  const canDrag = !readOnly && (event.type === 'recording' || event.type === 'session');
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    data: event,
    disabled: !canDrag,
  });

  return (
    <HoverCard openDelay={300} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          ref={setNodeRef}
          {...(canDrag ? { ...listeners, ...attributes } : {})}
          className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate ${getStatusBg(event.status)} ${
            canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
          } ${isDragging ? 'opacity-30' : ''}`}
        >
          {canDrag && <GripVertical className="w-2.5 h-2.5 inline-block mr-0.5 text-muted-foreground/50" />}
          <span className="mr-0.5">{event.type === 'session' ? '🎥' : '📖'}</span>
          {event.title}
        </div>
      </HoverCardTrigger>
      <HoverCardContent side="top" align="start" className="w-64 p-3 text-xs z-50">
        <EventDetails event={event} getStatusBg={getStatusBg} />
      </HoverCardContent>
    </HoverCard>
  );
}

// Event detail popover content
function EventDetails({ event, getStatusBg }: { event: CalendarEvent; getStatusBg: (s: string) => string }) {
  return (
    <div className="space-y-2">
      <div className="font-semibold text-sm flex items-center gap-1.5">
        {event.type === 'session' ? <Video className="w-3.5 h-3.5 text-primary shrink-0" /> : <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />}
        {event.title}
      </div>
      <div className="space-y-1.5 text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="w-3 h-3 shrink-0" />
          <span>{format(event.date, 'EEEE, MMM d, yyyy')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Layers className="w-3 h-3 shrink-0" />
          <span>Batch: <span className="text-foreground font-medium">{event.batchName}</span></span>
        </div>
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3 h-3 shrink-0" />
          <span>Course: <span className="text-foreground font-medium">{event.courseName}</span></span>
        </div>
        {event.moduleName && (
          <div className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 shrink-0" />
            <span>Module: <span className="text-foreground font-medium">{event.moduleName}</span></span>
          </div>
        )}
        {event.hostName && (
          <div className="flex items-center gap-1.5">
            <User className="w-3 h-3 shrink-0" />
            <span>Host: <span className="text-foreground font-medium">{event.hostName}</span></span>
          </div>
        )}
        {event.assignmentName && (
          <div className="flex items-center gap-1.5 text-amber-600">
            <BookOpen className="w-3 h-3 shrink-0" />
            <span>Assignment: <span className="font-medium">{event.assignmentName}</span></span>
          </div>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${getStatusBg(event.status)}`}>
            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {event.type === 'session' ? 'Live Session' : 'Recording'}
          </Badge>
        </div>
      </div>
    </div>
  );
}

// Droppable day cell
function DroppableDay({ day, isCurrentMonth, isCurrentDay, viewMode, children }: {
  day: Date; isCurrentMonth: boolean; isCurrentDay: boolean; viewMode: string; children: React.ReactNode;
}) {
  const dayId = format(day, 'yyyy-MM-dd');
  const { setNodeRef, isOver } = useDroppable({ id: dayId, data: { date: day } });

  return (
    <div
      ref={setNodeRef}
      className={`bg-background ${viewMode === 'weekly' ? 'min-h-[140px]' : 'min-h-[90px]'} p-1 ${
        !isCurrentMonth && viewMode === 'monthly' ? 'opacity-40' : ''
      } ${isCurrentDay ? 'ring-2 ring-primary/30 ring-inset' : ''} ${
        isOver ? 'bg-primary/10 ring-2 ring-primary/50 ring-inset' : ''
      } transition-colors`}
    >
      {children}
    </div>
  );
}

export function ContentScheduleCalendar({ readOnly = false }: { readOnly?: boolean }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'monthly' | 'weekly'>('monthly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBatch, setSelectedBatch] = useState<string>('all');
  const [batches, setBatches] = useState<BatchInfo[]>([]);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [pendingReschedule, setPendingReschedule] = useState<{
    event: CalendarEvent;
    targetDate: Date;
    newDripDays: number;
    batchName: string;
  } | null>(null);
  const { toast } = useToast();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  useEffect(() => {
    fetchCalendarData();
  }, []);

  const fetchCalendarData = async () => {
    setLoading(true);
    try {
      // Fetch all active batches with start dates
      const { data: batchData } = await supabase
        .from('batches')
        .select('id, name, start_date, course_id, pathway_id')
        .eq('status', 'active');

      const activeBatches: BatchInfo[] = (batchData || []).filter(b => b.start_date);
      setBatches(activeBatches);

      if (!activeBatches.length) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Fetch all courses for names
      const { data: coursesData } = await supabase
        .from('courses')
        .select('id, title');
      const courseMap = new Map((coursesData || []).map(c => [c.id, c.title]));

      // Fetch all modules
      const { data: modulesData } = await supabase
        .from('modules')
        .select('id, title, course_id, order');
      const moduleMap = new Map((modulesData || []).map(m => [m.id, { title: m.title, course_id: m.course_id }]));

      // Fetch all recordings with drip_days
      const { data: recordingsData } = await supabase
        .from('available_lessons')
        .select('id, recording_title, drip_days, module, sequence_order');

      // Fetch assignments linked to recordings
      const { data: assignmentsData } = await supabase
        .from('assignments')
        .select('id, name, recording_id')
        .not('recording_id', 'is', null);
      const assignmentByRecording = new Map<string, string>();
      (assignmentsData || []).forEach((a: any) => {
        if (a.recording_id) assignmentByRecording.set(a.recording_id, a.name);
      });

      // Fetch all sessions with drip_days
      const { data: sessionsData } = await supabase
        .from('success_sessions')
        .select('id, title, course_id, batch_id, batch_ids, mentor_name, status, schedule_date, drip_days, start_time' as any) as { data: any[] | null };

      // Fetch mentor assignments for courses
      const { data: mentorAssignments } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, profiles!mentor_course_assignments_mentor_id_fkey(full_name)')
        .order('is_primary', { ascending: false });
      
      const courseMentorMap = new Map<string, string>();
      (mentorAssignments || []).forEach(ma => {
        if (!courseMentorMap.has(ma.course_id)) {
          courseMentorMap.set(ma.course_id, (ma.profiles as any)?.full_name || 'Unknown');
        }
      });

      // For pathway batches, fetch pathway courses
      const { data: pathwayCourses } = await supabase
        .from('pathway_courses')
        .select('pathway_id, course_id, step_number');

      const pathwayCourseMap = new Map<string, string[]>();
      (pathwayCourses || []).forEach(pc => {
        const existing = pathwayCourseMap.get(pc.pathway_id) || [];
        existing.push(pc.course_id);
        pathwayCourseMap.set(pc.pathway_id, existing);
      });

      const allEvents: CalendarEvent[] = [];
      const now = new Date();

      for (const batch of activeBatches) {
        const batchStart = new Date(batch.start_date);
        
        // Determine which courses belong to this batch
        let courseIds: string[] = [];
        if (batch.pathway_id) {
          courseIds = pathwayCourseMap.get(batch.pathway_id) || [];
        } else if (batch.course_id) {
          courseIds = [batch.course_id];
        }

        if (!courseIds.length) continue;

        // Get module IDs for these courses
        const relevantModuleIds = (modulesData || [])
          .filter(m => courseIds.includes(m.course_id))
          .map(m => m.id);

        // Map recordings to events
        (recordingsData || []).forEach(rec => {
          if (!rec.module || !relevantModuleIds.includes(rec.module)) return;
          if (rec.drip_days == null) return;

          const eventDate = new Date(batchStart);
          eventDate.setDate(eventDate.getDate() + rec.drip_days);

          const mod = moduleMap.get(rec.module);
          const courseId = mod?.course_id || '';

          allEvents.push({
            id: `${batch.id}-rec-${rec.id}`,
            title: rec.recording_title || 'Untitled Recording',
            date: eventDate,
            type: 'recording',
            batchName: batch.name,
            batchId: batch.id,
            moduleName: mod?.title || 'Unknown Module',
            courseName: courseMap.get(courseId) || 'Unknown Course',
            hostName: courseMentorMap.get(courseId),
            status: eventDate < now ? 'done' : 'upcoming',
            assignmentName: assignmentByRecording.get(rec.id),
            entityId: rec.id,
            originalDripDays: rec.drip_days,
          });
        });

        // Map sessions to events
        (sessionsData || []).forEach(session => {
          // Check batch_ids JSONB array (newer field)
          let batchIdsArray: string[] = [];
          if (session.batch_ids) {
            try {
              if (Array.isArray(session.batch_ids)) {
                batchIdsArray = session.batch_ids;
              } else if (typeof session.batch_ids === 'string') {
                batchIdsArray = JSON.parse(session.batch_ids);
              }
            } catch { /* ignore parse errors */ }
          }

          const hasBatchIds = batchIdsArray.length > 0;
          const hasLegacyBatchId = !!session.batch_id;

          // Only show sessions where this batch was explicitly selected
          // Check both legacy batch_id AND batch_ids array (session may have both)
          const matchesLegacy = hasLegacyBatchId && session.batch_id === batch.id;
          const matchesBatchIds = hasBatchIds && batchIdsArray.includes(batch.id);
          const sessionMatchesBatch = matchesLegacy || matchesBatchIds;
          // Sessions without any batch assignment are NOT shown on batch-specific calendars

          if (!sessionMatchesBatch) return;
          
          const dripDays = (session as any).drip_days;
          let eventDate: Date;
          
          if (dripDays != null) {
            eventDate = new Date(batchStart);
            eventDate.setDate(eventDate.getDate() + dripDays);
          } else if (session.schedule_date) {
            eventDate = new Date(session.schedule_date);
          } else if (session.start_time) {
            eventDate = new Date(session.start_time);
          } else {
            return;
          }

          let status: 'done' | 'upcoming' | 'cancelled' = 'upcoming';
          if (session.status === 'completed') status = 'done';
          else if (session.status === 'cancelled') status = 'cancelled';
          else if (eventDate < now) status = 'done';

          allEvents.push({
            id: `${batch.id}-ses-${session.id}`,
            title: session.title || 'Untitled Session',
            date: eventDate,
            type: 'session',
            batchName: batch.name,
            batchId: batch.id,
            courseName: courseMap.get(session.course_id) || 'Unknown Course',
            hostName: session.mentor_name || courseMentorMap.get(session.course_id),
            status,
            entityId: session.id,
            originalDripDays: dripDays ?? null,
          });
        });
      }

      setEvents(allEvents);
    } catch (error) {
      logger.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveEvent(event.active.data.current as CalendarEvent);
  }, []);

  // Extracted reschedule logic used by both normal drag and confirmed completed-session drag
  const executeReschedule = useCallback(async (draggedEvent: CalendarEvent, targetDate: Date, newDripDays: number) => {
    try {
      if (draggedEvent.type === 'recording') {
        const { error } = await supabase
          .from('available_lessons')
          .update({ drip_days: newDripDays })
          .eq('id', draggedEvent.entityId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('success_sessions')
          .update({ drip_days: newDripDays } as any)
          .eq('id', draggedEvent.entityId);
        if (error) throw error;
      }

      setEvents(prev => prev.map(e => {
        if (e.entityId === draggedEvent.entityId && e.batchId === draggedEvent.batchId) {
          return { ...e, date: targetDate, originalDripDays: newDripDays, status: targetDate < new Date() ? 'done' : 'upcoming' };
        }
        return e;
      }));

      toast({
        title: "Rescheduled",
        description: `"${draggedEvent.title}" moved to ${format(targetDate, 'MMM d, yyyy')} (Day ${newDripDays})`,
      });
    } catch (error) {
      logger.error('Error updating drip days:', error);
      toast({ title: "Error", description: "Failed to reschedule", variant: "destructive" });
    }
  }, [toast]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveEvent(null);
    const { active, over } = event;
    if (!over) return;

    // Block rescheduling when "All Batches" is selected
    if (selectedBatch === 'all') {
      toast({ title: "Select a batch", description: "Please select a specific batch before rescheduling content", variant: "destructive" });
      return;
    }

    const draggedEvent = active.data.current as CalendarEvent;
    const targetDateStr = over.id as string;
    const targetDate = new Date(targetDateStr + 'T00:00:00');

    if (isSameDay(draggedEvent.date, targetDate)) return;

    // Find batch start date
    const batch = batches.find(b => b.id === draggedEvent.batchId);
    if (!batch) return;
    const batchStart = new Date(batch.start_date);
    const newDripDays = differenceInCalendarDays(targetDate, batchStart);

    if (newDripDays < 0) {
      toast({ title: "Invalid", description: "Cannot schedule before batch start date", variant: "destructive" });
      return;
    }

    // Validation for sessions
    if (draggedEvent.type === 'session') {
      if (targetDate < draggedEvent.date) {
        toast({ title: "Cannot move backward", description: "Live sessions can only be moved to a later date", variant: "destructive" });
        return;
      }
      // Show confirmation dialog for completed sessions
      if (draggedEvent.status === 'done') {
        setPendingReschedule({
          event: draggedEvent,
          targetDate,
          newDripDays,
          batchName: batch.name,
        });
        return;
      }
    }

    // Execute the reschedule
    await executeReschedule(draggedEvent, targetDate, newDripDays);
  }, [batches, selectedBatch, toast, executeReschedule]);

  const handleConfirmCompletedReschedule = useCallback(async () => {
    if (!pendingReschedule) return;
    const { event, targetDate, newDripDays } = pendingReschedule;
    setPendingReschedule(null);
    await executeReschedule(event, targetDate, newDripDays);
  }, [pendingReschedule, executeReschedule]);

  const filteredEvents = useMemo(() => {
    if (selectedBatch === 'all') return events;
    return events.filter(e => e.batchId === selectedBatch);
  }, [events, selectedBatch]);

  const daysToDisplay = useMemo(() => {
    if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      const firstDay = startOfWeek(start, { weekStartsOn: 1 });
      const lastDay = endOfWeek(end, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: firstDay, end: lastDay });
    }
  }, [currentDate, viewMode]);

  const navigatePrev = () => {
    setCurrentDate(prev => viewMode === 'monthly' ? subMonths(prev, 1) : subWeeks(prev, 1));
  };

  const navigateNext = () => {
    setCurrentDate(prev => viewMode === 'monthly' ? addMonths(prev, 1) : addWeeks(prev, 1));
  };

  const getEventsForDay = (day: Date) => {
    return filteredEvents.filter(e => isSameDay(e.date, day));
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-100 border-green-300 text-green-800';
      case 'cancelled': return 'bg-red-100 border-red-300 text-red-800';
      default: return 'bg-muted/50 border-border text-foreground';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-muted-foreground';
    }
  };

  const headerLabel = viewMode === 'monthly'
    ? format(currentDate, 'MMMM yyyy')
    : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading schedule...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
    <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CalendarDays className="w-5 h-5 text-primary" />
            Content Schedule
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'weekly' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs"
                onClick={() => setViewMode('weekly')}
              >
                Week
              </Button>
              <Button
                variant={viewMode === 'monthly' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-none h-8 text-xs"
                onClick={() => setViewMode('monthly')}
              >
                Month
              </Button>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mt-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-sm">{headerLabel}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-1">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid with DnD */}
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
            {daysToDisplay.map(day => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isExpanded = expandedDay === format(day, 'yyyy-MM-dd');
              const maxVisible = viewMode === 'weekly' ? 8 : 3;

              return (
                <DroppableDay
                  key={day.toISOString()}
                  day={day}
                  isCurrentMonth={isCurrentMonth}
                  isCurrentDay={isToday(day)}
                  viewMode={viewMode}
                >
                  <div className={`text-xs font-medium mb-0.5 ${isToday(day) ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, isExpanded ? undefined : maxVisible).map(event => (
                      <DraggableEvent key={event.id} event={event} getStatusBg={getStatusBg} readOnly={readOnly} />
                    ))}
                    {dayEvents.length > maxVisible && !isExpanded && (
                      <div
                        className="text-[10px] text-primary font-medium cursor-pointer px-1"
                        onClick={() => setExpandedDay(isExpanded ? null : format(day, 'yyyy-MM-dd'))}
                      >
                        +{dayEvents.length - maxVisible} more
                      </div>
                    )}
                  </div>
                </DroppableDay>
              );
            })}
          </div>

          {/* Drag overlay */}
          <DragOverlay>
            {activeEvent && (
              <div className={`text-[10px] leading-tight px-1 py-0.5 rounded border truncate shadow-lg ${getStatusBg(activeEvent.status)} max-w-[150px]`}>
                <span className="mr-0.5">{activeEvent.type === 'session' ? '🎥' : '📖'}</span>
                {activeEvent.title}
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot('done')}`} />
            <span>Done</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot('upcoming')}`} />
            <span>Upcoming</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${getStatusDot('cancelled')}`} />
            <span>Cancelled</span>
          </div>
          <div className="flex items-center gap-1 ml-2">
            <span>📖 Recording</span>
          </div>
          <div className="flex items-center gap-1">
            <span>🎥 Live Session</span>
          </div>
          <div className="flex items-center gap-1 ml-2 text-muted-foreground/70">
            <GripVertical className="w-3 h-3" />
            <span>Drag to reschedule</span>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Confirmation dialog for rescheduling completed sessions */}
    <AlertDialog open={!!pendingReschedule} onOpenChange={(open) => { if (!open) setPendingReschedule(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Reschedule Completed Session
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-sm">
            <p>
              You are rescheduling <strong>"{pendingReschedule?.event.title}"</strong> which has already been completed and its date has passed.
            </p>
            <p>
              This change will apply for batch <strong>{pendingReschedule?.batchName}</strong>.
            </p>
            <p>
              New date: <strong>{pendingReschedule ? format(pendingReschedule.targetDate, 'EEEE, MMM d, yyyy') : ''}</strong> (Day {pendingReschedule?.newDripDays})
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmCompletedReschedule}>
            Yes, Reschedule
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
