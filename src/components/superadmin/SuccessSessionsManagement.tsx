import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, CalendarDays, Clock, Video, User, Link as LinkIcon, Plus, Edit, Trash2, BookOpen, Users2, Search, Send, Filter, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeQuery } from '@/lib/database-safety';
import type { SuccessSessionResult } from '@/types/database';
import { format, isSameDay } from 'date-fns';
import { notifyMentorOfSuccessSessionScheduled } from '@/lib/notification-service';
import { logUserActivity, ACTIVITY_TYPES } from '@/lib/activity-logger';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface SuccessSession {
  id: string;
  title: string;
  description: string;
  mentor_name: string;
  mentor_id?: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
  zoom_meeting_id?: string;
  zoom_passcode?: string;
  host_login_email?: string;
  host_login_pwd?: string;
  course_id?: string;
  batch_id?: string | null;
  batch_ids?: string[] | null;
  pathway_id?: string | null;
  drip_days?: number | null;
  created_at: string;
  created_by: string;
}

interface SessionFormData {
  title: string;
  description: string;
  mentor_name: string;
  mentor_id: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  link: string;
  zoom_meeting_id: string;
  zoom_passcode: string;
  host_login_email: string;
  host_login_pwd: string;
  status: string;
  course_id: string;
  batch_ids: string[];
}

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface Course {
  id: string;
  title: string;
}

interface Batch {
  id: string;
  name: string;
  course_id: string | null;
  status: string;
  start_date?: string;
}

interface Pathway {
  id: string;
  name: string;
}

interface PathwayCourse {
  course_id: string;
  pathway_id: string;
}

export function SuccessSessionsManagement() {
  const [sessions, setSessions] = useState<SuccessSession[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [pathwayCourses, setPathwayCourses] = useState<PathwayCourse[]>([]);
  const [filteredBatches, setFilteredBatches] = useState<Batch[]>([]);
  const [batchCourseMap, setBatchCourseMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [editingSession, setEditingSession] = useState<SuccessSession | null>(null);
  // Filter state
  const [filterSearch, setFilterSearch] = useState('');
  const [filterHost, setFilterHost] = useState('__all__');
  const [filterCourse, setFilterCourse] = useState('__all__');
  const [filterBatch, setFilterBatch] = useState('__all__');
  const [filterStatus, setFilterStatus] = useState('__all__');
  const [filterDate, setFilterDate] = useState<Date | undefined>(undefined);
  const [formData, setFormData] = useState<SessionFormData>({
    title: '',
    description: '',
    mentor_name: '',
    mentor_id: '',
    schedule_date: '',
    start_time: '',
    end_time: '',
    link: '',
    zoom_meeting_id: '',
    zoom_passcode: '',
    host_login_email: '',
    host_login_pwd: '',
    status: 'draft',
    course_id: '__all__',
    batch_ids: ['__all__']
  });
  const [batchPopoverOpen, setBatchPopoverOpen] = useState(false);
  const [publishing, setPublishing] = useState<string | null>(null);
  const formSubmittedRef = useRef(false);
  const { toast } = useToast();
  const { user: authUser } = useAuth();

  useEffect(() => {
    fetchSessions();
    fetchUsers();
    fetchCourses();
    fetchBatches();
    fetchBatchCourses();
    fetchPathways();
  }, []);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .order('start_time', { ascending: false });

      if (error) throw error;
      setSessions((data as any as SuccessSession[]) || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch success sessions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role')
        .in('role', ['admin', 'superadmin', 'mentor'])
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      });
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .order('title', { ascending: true });

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      console.error('Error fetching courses:', error);
    }
  };

  const fetchBatches = async () => {
    try {
      const { data, error } = await supabase
        .from('batches')
        .select('id, name, course_id, status, start_date')
        .order('name', { ascending: true });

      if (error) throw error;
      setBatches(data || []);
    } catch (error) {
      console.error('Error fetching batches:', error);
    }
  };

  const fetchBatchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('batch_courses')
        .select('batch_id, course_id');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data || []) {
        if (!map[row.course_id]) map[row.course_id] = [];
        map[row.course_id].push(row.batch_id);
      }
      setBatchCourseMap(map);
    } catch (error) {
      console.error('Error fetching batch_courses:', error);
    }
  };

  const fetchPathways = async () => {
    try {
      const [{ data: pathData }, { data: pcData }] = await Promise.all([
        supabase.from('learning_pathways').select('id, name').order('name'),
        supabase.from('pathway_courses').select('course_id, pathway_id')
      ]);
      setPathways(pathData || []);
      setPathwayCourses(pcData || []);
    } catch (error) {
      console.error('Error fetching pathways:', error);
    }
  };

  const getPathwayForCourse = (courseId?: string) => {
    if (!courseId) return null;
    const pc = pathwayCourses.find(p => p.course_id === courseId);
    if (!pc) return null;
    return pathways.find(p => p.id === pc.pathway_id)?.name || null;
  };

  // Filter batches when course_id changes
  useEffect(() => {
    if (formData.course_id && formData.course_id !== '__all__') {
      const matching = batches.filter(b => b.course_id === formData.course_id);
      setFilteredBatches(matching);
    } else {
      setFilteredBatches(batches);
    }
  }, [formData.course_id, batches]);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString: string) => {
    try {
      return format(new Date(timeString), 'h:mm a');
    } catch {
      return 'Invalid time';
    }
  };

  const getDayOfWeek = (dateString: string) => {
    try {
      return format(new Date(dateString), 'EEEE');
    } catch {
      return 'Invalid day';
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      mentor_name: '',
      mentor_id: '',
      schedule_date: '',
      start_time: '',
      end_time: '',
      link: '',
      zoom_meeting_id: '',
      zoom_passcode: '',
      host_login_email: '',
      host_login_pwd: '',
      status: 'draft',
      course_id: '__all__',
      batch_ids: ['__all__']
    });
    setEditingSession(null);
  };

  const extractTimeFromTimestamp = (timestamp: string | undefined | null): string => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return '';
      return format(date, 'HH:mm');
    } catch {
      return '';
    }
  };

  const handleOpenDialog = (session?: SuccessSession) => {
    formSubmittedRef.current = false;
    if (session) {
      setEditingSession(session);
      setFormData({
        title: session.title,
        description: session.description || '',
        mentor_name: session.mentor_name || '',
        mentor_id: session.mentor_id || '',
        schedule_date: session.schedule_date || '',
        start_time: extractTimeFromTimestamp(session.start_time),
        end_time: extractTimeFromTimestamp(session.end_time),
        link: session.link || '',
        zoom_meeting_id: session.zoom_meeting_id || '',
        zoom_passcode: session.zoom_passcode || '',
        host_login_email: session.host_login_email || '',
        host_login_pwd: session.host_login_pwd || '',
        status: session.status || 'upcoming',
        course_id: session.course_id || '__all__',
        batch_ids: session.batch_ids && Array.isArray(session.batch_ids) && session.batch_ids.length > 0
          ? session.batch_ids
          : session.batch_id ? [session.batch_id] : ['__all__']
      });
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = async () => {
    // If form was not submitted and has meaningful data, save as draft
    if (!formSubmittedRef.current && !editingSession && formData.title.trim()) {
      try {
        const selectedUser = users.find(user => user.id === formData.mentor_id);
        const combineDateTime = (date: string, time: string) => {
          if (!date || !time) return null;
          return `${date}T${time}:00`;
        };

        const baseSessionData = {
          title: formData.title,
          description: formData.description,
          mentor_name: selectedUser ? selectedUser.full_name : formData.mentor_name,
          mentor_id: formData.mentor_id || null,
          schedule_date: formData.schedule_date || null,
          start_time: combineDateTime(formData.schedule_date, formData.start_time),
          end_time: formData.end_time ? combineDateTime(formData.schedule_date, formData.end_time) : null,
          link: formData.link || null,
          zoom_meeting_id: formData.zoom_meeting_id || null,
          zoom_passcode: formData.zoom_passcode || null,
          host_login_email: formData.host_login_email || null,
          host_login_pwd: formData.host_login_pwd || null,
          status: 'draft',
          course_id: formData.course_id === '__all__' ? null : (formData.course_id || null),
          batch_id: null,
          batch_ids: formData.batch_ids.includes('__all__') ? null : formData.batch_ids.filter(id => id !== 'unbatched'),
          pathway_id: null as string | null
        };

        await supabase
          .from('success_sessions')
          .insert([baseSessionData] as any);

        toast({
          title: "Draft Saved",
          description: "Session saved as draft. You can continue editing it later.",
        });

        fetchSessions();
      } catch (error) {
        console.error('Error saving draft:', error);
      }
    }
    formSubmittedRef.current = false;
    setSubmitSuccess(false);
    setDialogOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    formSubmittedRef.current = true;
    try {
      // Find the selected user to get their name
      const selectedUser = users.find(user => user.id === formData.mentor_id);
      
      // Combine date with time to create proper timestamps
      const combineDateTime = (date: string, time: string) => {
        if (!date || !time) return null;
        return `${date}T${time}:00`;
      };

      const baseSessionData = {
        title: formData.title,
        description: formData.description,
        mentor_name: selectedUser ? selectedUser.full_name : formData.mentor_name,
        mentor_id: formData.mentor_id || null,
        schedule_date: formData.schedule_date,
        start_time: combineDateTime(formData.schedule_date, formData.start_time),
        end_time: formData.end_time ? combineDateTime(formData.schedule_date, formData.end_time) : null,
        link: formData.link,
        zoom_meeting_id: formData.zoom_meeting_id,
        zoom_passcode: formData.zoom_passcode,
        host_login_email: formData.host_login_email,
        host_login_pwd: formData.host_login_pwd,
        status: formData.status,
        course_id: formData.course_id === '__all__' ? null : (formData.course_id || null),
        pathway_id: null as string | null
      };

      // Resolve batch_ids for JSONB column: '__all__' means null (all batches)
      const resolvedBatchIds = formData.batch_ids.includes('__all__')
        ? null
        : formData.batch_ids.filter(id => id !== 'unbatched');

      if (editingSession) {
        const sessionData = {
          ...baseSessionData,
          batch_id: null,
          batch_ids: resolvedBatchIds && resolvedBatchIds.length > 0 ? resolvedBatchIds : null
        };
        const { error } = await supabase
          .from('success_sessions')
          .update(sessionData as any)
          .eq('id', editingSession.id);

        if (error) throw error;

        if (authUser?.id) {
          logUserActivity({
            user_id: authUser.id,
            activity_type: ACTIVITY_TYPES.SUCCESS_SESSION_SCHEDULED,
            metadata: {
              session_title: baseSessionData.title,
              session_date: baseSessionData.start_time || formData.schedule_date,
              scheduled_by: authUser.full_name || 'Admin',
              action: 'updated'
            }
          });
        }

        toast({
          title: "Success",
          description: "Session updated successfully",
        });
      } else {
        // Creating a single session record with batch_ids JSONB
        const courseId = baseSessionData.course_id;
        const relevantPathwayIds = courseId
          ? pathwayCourses.filter(pc => pc.course_id === courseId).map(pc => pc.pathway_id)
          : [];

        const sessionToInsert = {
          ...baseSessionData,
          batch_id: null,
          batch_ids: resolvedBatchIds && resolvedBatchIds.length > 0 ? resolvedBatchIds : null,
          pathway_id: relevantPathwayIds.length === 1 ? relevantPathwayIds[0] : null
        };

        const result = await safeQuery<SuccessSessionResult[]>(
          supabase
            .from('success_sessions')
            .insert([sessionToInsert] as any)
            .select(),
          'create success sessions'
        );

        if (!result.success) throw result.error;
        const newSessions = result.data || [];

        if (authUser?.id) {
          logUserActivity({
            user_id: authUser.id,
            activity_type: ACTIVITY_TYPES.SUCCESS_SESSION_SCHEDULED,
            metadata: {
              session_title: baseSessionData.title,
              session_date: baseSessionData.start_time || formData.schedule_date,
              scheduled_by: authUser.full_name || 'Admin',
              action: 'created',
              sessions_created: 1,
              batch_ids: resolvedBatchIds
            }
          });
        }

        // Notify mentor
        if (formData.mentor_id && newSessions.length > 0) {
          try {
            await notifyMentorOfSuccessSessionScheduled(
              formData.mentor_id,
              formData.title,
              baseSessionData.start_time || formData.schedule_date,
              newSessions[0].id
            );
          } catch (notificationError) {
            console.error('Failed to notify mentor:', notificationError);
          }
        }

        // Notify batch students for each batch in batch_ids
        if (resolvedBatchIds && resolvedBatchIds.length > 0 && newSessions.length > 0) {
          for (const batchId of resolvedBatchIds) {
            if (batchId) {
              try {
                await supabase.functions.invoke('send-batch-content-notification', {
                  body: {
                    batch_id: batchId,
                    item_type: 'LIVE_SESSION',
                    item_id: newSessions[0].id,
                    title: baseSessionData.title,
                    description: baseSessionData.description,
                    meeting_link: baseSessionData.link,
                    start_datetime: baseSessionData.start_time
                  }
                });
              } catch (notifyError) {
                console.error('Failed to notify batch students:', notifyError);
              }
            }
          }
        }

        toast({
          title: "Success",
          description: resolvedBatchIds && resolvedBatchIds.length > 1
            ? `Session created for ${resolvedBatchIds.length} batches`
            : "Session created successfully",
        });
      }

      fetchSessions();
      setSubmitSuccess(true);
      setTimeout(() => {
        setSubmitSuccess(false);
        setDialogOpen(false);
        resetForm();
        formSubmittedRef.current = false;
      }, 1500);
    } catch (error) {
      toast({
        title: "Error",
        description: editingSession ? "Failed to update session" : "Failed to create session",
        variant: "destructive"
      });
    }
  };

  const handlePublish = async (session: SuccessSession) => {
    if (!session.link || !session.start_time) {
      toast({ title: "Cannot Publish", description: "Session must have a Zoom link and start time before publishing.", variant: "destructive" });
      return;
    }
    setPublishing(session.id);
    try {
      const { error } = await supabase
        .from('success_sessions')
        .update({ status: 'upcoming' })
        .eq('id', session.id);
      if (error) throw error;

      // Notify batch students via email + in-app for all batch_ids
      const sessionBatchIds: string[] = (session as any).batch_ids || (session.batch_id ? [session.batch_id] : []);
      for (const batchId of sessionBatchIds) {
        if (batchId) {
          try {
            await supabase.functions.invoke('send-batch-content-notification', {
              body: {
                batch_id: batchId,
                item_type: 'LIVE_SESSION',
                item_id: session.id,
                title: session.title,
                description: session.description,
                meeting_link: session.link,
                start_datetime: session.start_time
              }
            });
          } catch (notifyError) {
            console.error('Failed to notify batch students:', notifyError);
          }
        }
      }

      toast({ title: "Published!", description: "Session is now visible to students and notifications have been sent." });
      fetchSessions();
    } catch (error) {
      toast({ title: "Error", description: "Failed to publish session", variant: "destructive" });
    } finally {
      setPublishing(null);
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      const { error } = await supabase
        .from('success_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Session deleted successfully",
      });

      fetchSessions();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete session",
        variant: "destructive"
      });
    }
  };

  const handleToggleShared = async (session: SuccessSession) => {
    try {
      if (session.pathway_id) {
        // Currently scoped to a pathway — make it shared (null pathway_id)
        const { error } = await supabase
          .from('success_sessions')
          .update({ pathway_id: null } as any)
          .eq('id', session.id);
        if (error) throw error;
        toast({ title: "Shared", description: "Session is now shared across all pathways" });
      } else {
        // Currently shared — scope it to pathways (clone per pathway)
        const courseId = session.course_id;
        if (!courseId) {
          toast({ title: "Cannot scope", description: "Session has no course assigned", variant: "destructive" });
          return;
        }
        const relevantPathwayIds = pathwayCourses
          .filter(pc => pc.course_id === courseId)
          .map(pc => pc.pathway_id);

        if (relevantPathwayIds.length === 0) {
          toast({ title: "No pathways", description: "This course is not part of any pathway", variant: "destructive" });
          return;
        }

        // Update original to first pathway
        const { error: updateError } = await supabase
          .from('success_sessions')
          .update({ pathway_id: relevantPathwayIds[0] } as any)
          .eq('id', session.id);
        if (updateError) throw updateError;

        // Clone for remaining pathways
        if (relevantPathwayIds.length > 1) {
          const { id, created_at, created_by, ...sessionBase } = session;
          const clones = relevantPathwayIds.slice(1).map(pid => ({
            ...sessionBase,
            pathway_id: pid
          }));
          const { error: insertError } = await supabase
            .from('success_sessions')
            .insert(clones as any);
          if (insertError) throw insertError;
        }

        toast({ title: "Separated", description: `Session split into ${relevantPathwayIds.length} pathway-specific sessions` });
      }
      fetchSessions();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update session sharing", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading success sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            Success Sessions Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage scheduled success sessions and their status</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button 
              onClick={() => handleOpenDialog()}
              className="hover-scale bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => { if (submitSuccess) e.preventDefault(); }}>
            {submitSuccess ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 animate-fade-in">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {editingSession ? 'Session Updated!' : 'Session Scheduled!'}
                </p>
                <p className="text-sm text-muted-foreground">Closing automatically...</p>
              </div>
            ) : (
            <>
            <DialogHeader>
              <DialogTitle>
                {editingSession ? 'Edit Success Session' : 'Schedule New Success Session'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Session Title *</label>
                  <Input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    required
                    placeholder="Enter session title"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Host/Mentor *</label>
                  <Select 
                    value={formData.mentor_id} 
                    onValueChange={(value) => setFormData({...formData, mentor_id: value})}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a mentor, admin, or superadmin" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50 max-h-60">
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.full_name}</span>
                            <span className="text-xs text-muted-foreground">{user.email} • {user.role}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="Enter session description"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Zoom Meeting ID *</label>
                  <Input
                    type="text"
                    value={formData.zoom_meeting_id}
                    onChange={(e) => setFormData({...formData, zoom_meeting_id: e.target.value})}
                    required
                    placeholder="Enter Zoom Meeting ID"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Zoom Passcode *</label>
                  <Input
                    type="text"
                    value={formData.zoom_passcode}
                    onChange={(e) => setFormData({...formData, zoom_passcode: e.target.value})}
                    required
                    placeholder="Enter Zoom Passcode"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Host Login Email *</label>
                  <Input
                    type="email"
                    value={formData.host_login_email}
                    onChange={(e) => setFormData({...formData, host_login_email: e.target.value})}
                    required
                    placeholder="Enter host login email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Host Login Password *</label>
                  <Input
                    type="password"
                    value={formData.host_login_pwd}
                    onChange={(e) => setFormData({...formData, host_login_pwd: e.target.value})}
                    required
                    placeholder="Enter host login password"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Schedule Date *</label>
                  <Input
                    type="date"
                    value={formData.schedule_date}
                    onChange={(e) => setFormData({...formData, schedule_date: e.target.value})}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time *</label>
                  <Input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    required
                    step="900"
                    placeholder="HH:MM"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <Input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    step="900"
                    placeholder="HH:MM"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Session Link *</label>
                  <Input
                    type="url"
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    placeholder="https://..."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status *</label>
                  <Select value={formData.status} onValueChange={(value) => setFormData({...formData, status: value})} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="upcoming">Upcoming</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Course & Batch Targeting */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    Target Course
                  </label>
                  <Select
                    value={formData.course_id}
                    onValueChange={(value) => setFormData({ ...formData, course_id: value, batch_ids: ['__all__'] })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All students (no filter)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All students (no filter)</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 flex items-center gap-1">
                    <Users2 className="w-4 h-4 text-muted-foreground" />
                    Target Batch
                  </label>
                  <Popover open={batchPopoverOpen} onOpenChange={setBatchPopoverOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between font-normal">
                        <span className="truncate">
                          {formData.batch_ids.includes('__all__')
                            ? 'All Batches'
                            : formData.batch_ids.length === 1
                              ? (formData.batch_ids[0] === 'unbatched'
                                ? 'Unbatched students'
                                : filteredBatches.find(b => b.id === formData.batch_ids[0])?.name || formData.batch_ids[0])
                              : `${formData.batch_ids.length} batches selected`}
                        </span>
                        <Users2 className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-2 max-h-[240px] overflow-y-auto" align="start">
                      <div className="space-y-1">
                        {/* All Batches option */}
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                          <Checkbox
                            checked={formData.batch_ids.includes('__all__')}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setFormData({ ...formData, batch_ids: ['__all__'] });
                              } else {
                                setFormData({ ...formData, batch_ids: [] });
                              }
                            }}
                          />
                          <span className="font-medium">All Batches</span>
                        </label>
                        {/* Unbatched option */}
                        <label className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                          <Checkbox
                            checked={formData.batch_ids.includes('unbatched') || formData.batch_ids.includes('__all__')}
                            onCheckedChange={(checked) => {
                              if (formData.batch_ids.includes('__all__')) {
                                // Deselect "All Batches", keep only other batches minus unbatched
                                const allBatchIds = filteredBatches.map(b => b.id);
                                setFormData({ ...formData, batch_ids: checked ? ['unbatched', ...allBatchIds] : allBatchIds });
                                return;
                              }
                              const without = formData.batch_ids.filter(id => id !== 'unbatched');
                              if (checked) {
                                setFormData({ ...formData, batch_ids: [...without, 'unbatched'] });
                              } else {
                                setFormData({ ...formData, batch_ids: without.length ? without : ['__all__'] });
                              }
                            }}
                          />
                          <span>Unbatched students</span>
                        </label>
                        <div className="border-t my-1" />
                        {filteredBatches.map((batch) => (
                          <label key={batch.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm">
                            <Checkbox
                              checked={formData.batch_ids.includes(batch.id) || formData.batch_ids.includes('__all__')}
                              onCheckedChange={(checked) => {
                                if (formData.batch_ids.includes('__all__')) {
                                  // Deselect "All Batches", select all others except this one if unchecking
                                  const allBatchIds = filteredBatches.map(b => b.id).filter(id => id !== batch.id);
                                  const withUnbatched = [...allBatchIds, 'unbatched'];
                                  setFormData({ ...formData, batch_ids: checked ? [...withUnbatched, batch.id] : withUnbatched });
                                  return;
                                }
                                const without = formData.batch_ids.filter(id => id !== batch.id);
                                if (checked) {
                                  setFormData({ ...formData, batch_ids: [...without, batch.id] });
                                } else {
                                  setFormData({ ...formData, batch_ids: without.length ? without : ['__all__'] });
                                }
                              }}
                            />
                            <span>{batch.name}</span>
                          </label>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit" className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                  {editingSession ? 'Update Session' : 'Schedule Session'}
                </Button>
              </div>
            </form>
            </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Upcoming 7 Days Sessions */}
      <UpcomingSessionsPreview
        sessions={sessions}
        courses={courses}
        batches={batches}
        batchCourseMap={batchCourseMap}
        pathways={pathways}
        pathwayCourses={pathwayCourses}
        onEdit={handleOpenDialog}
      />

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-orange-50 to-red-50 border-b space-y-3">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-orange-600" />
            All Success Sessions
          </CardTitle>

          {/* Filter Row */}
          <div className="flex flex-wrap gap-2 items-end">
            <div className="relative flex-1 min-w-[180px] max-w-[260px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title..."
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={filterHost} onValueChange={setFilterHost}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="All Hosts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Hosts</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCourse} onValueChange={v => { setFilterCourse(v); setFilterBatch('__all__'); }}>
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Courses</SelectItem>
                {courses.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterBatch} onValueChange={setFilterBatch}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Batches</SelectItem>
                {(filterCourse !== '__all__' ? batches.filter(b => b.course_id === filterCourse) : batches).map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 text-sm gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {filterDate ? format(filterDate, 'MMM d, yyyy') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={filterDate}
                  onSelect={setFilterDate}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            {(filterSearch || filterHost !== '__all__' || filterCourse !== '__all__' || filterBatch !== '__all__' || filterStatus !== '__all__' || filterDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setFilterSearch('');
                  setFilterHost('__all__');
                  setFilterCourse('__all__');
                  setFilterBatch('__all__');
                  setFilterStatus('__all__');
                  setFilterDate(undefined);
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            const filtered = sessions.filter(s => {
              if (filterSearch && !s.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
              if (filterHost !== '__all__' && s.mentor_id !== filterHost) return false;
              if (filterCourse !== '__all__' && s.course_id !== filterCourse) return false;
              if (filterBatch !== '__all__') {
                const sBatchIds: string[] = (s as any).batch_ids || (s.batch_id ? [s.batch_id] : []);
                if (sBatchIds.length === 0 || !sBatchIds.includes(filterBatch)) return false;
              }
              if (filterStatus !== '__all__' && s.status !== filterStatus) return false;
              if (filterDate) {
                try {
                  const sessionDate = new Date(s.schedule_date || s.start_time);
                  if (!isSameDay(sessionDate, filterDate)) return false;
                } catch { return false; }
              }
              return true;
            });
            if (filtered.length === 0) return (
              <div className="text-center py-16 animate-fade-in">
                <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-muted-foreground mb-2">No sessions found</h3>
                <p className="text-muted-foreground">{sessions.length > 0 ? 'Try adjusting your filters' : 'Schedule your first success session to get started'}</p>
              </div>
            );
            return (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="font-semibold min-w-[200px]">Session Title</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Host</TableHead>
                    <TableHead className="font-semibold min-w-[160px]">Pathway / Course / Batch</TableHead>
                    <TableHead className="font-semibold min-w-[180px]">Schedule</TableHead>
                    <TableHead className="font-semibold min-w-[100px]">Status</TableHead>
                    <TableHead className="font-semibold min-w-[140px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((session, index) => (
                    <TableRow 
                      key={session.id} 
                      className="hover:bg-gray-50 transition-colors animate-fade-in"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <TableCell className="font-medium min-w-[200px]">
                        <div className="font-semibold truncate max-w-[180px]" title={session.title}>
                          {session.title}
                        </div>
                        {session.description && (
                          <div className="text-sm text-muted-foreground mt-1 truncate max-w-[180px]" title={session.description}>
                            {session.description}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="flex items-center">
                          <User className="w-4 h-4 mr-2 text-muted-foreground flex-shrink-0" />
                          <span className="font-medium truncate">{session.mentor_name || 'TBD'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const pathwayName = session.pathway_id 
                              ? pathways.find(p => p.id === session.pathway_id)?.name
                              : getPathwayForCourse(session.course_id);
                            return pathwayName ? (
                              <Badge variant="secondary" className="text-[10px] w-fit">
                                🎯 {pathwayName}
                              </Badge>
                            ) : !session.pathway_id && session.course_id && pathwayCourses.filter(pc => pc.course_id === session.course_id).length > 0 ? (
                              <Badge variant="outline" className="text-[10px] w-fit border-primary/30 text-primary">
                                🔗 Shared
                              </Badge>
                            ) : null;
                          })()}
                          <span className="truncate text-sm font-medium">
                            {courses.find(c => c.id === session.course_id)?.title || 'All Courses'}
                          </span>
                          {(() => {
                            const rawBatchIds = (session as any).batch_ids;
                            let sessionBatchIds: string[] = [];
                            if (Array.isArray(rawBatchIds)) {
                              sessionBatchIds = rawBatchIds.map(String);
                            } else if (typeof rawBatchIds === 'string') {
                              try { const p = JSON.parse(rawBatchIds); sessionBatchIds = Array.isArray(p) ? p.map(String) : []; } catch { /* ignore */ }
                            } else if (session.batch_id) {
                              sessionBatchIds = [session.batch_id];
                            }
                            if (sessionBatchIds.length === 0) {
                              return <Badge variant="outline" className="text-xs w-fit">All Batches</Badge>;
                            }
                            const batchNames = sessionBatchIds.map(bid => batches.find(b => b.id === bid)?.name || bid);
                            // Try to compress consecutive numeric batch names into ranges
                            const nums = batchNames.map(n => parseInt(n, 10));
                            const allNumeric = nums.every(n => !isNaN(n));
                            if (allNumeric && nums.length > 2) {
                              const sorted = [...nums].sort((a, b) => a - b);
                              const isConsecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
                              if (isConsecutive) {
                                return (
                                  <Badge variant="outline" className="text-xs w-fit">
                                    {sorted[0]} to {sorted[sorted.length - 1]}
                                  </Badge>
                                );
                              }
                            }
                            return (
                              <div className="flex flex-wrap gap-0.5">
                                {batchNames.map((name, i) => (
                                  <Badge key={i} variant="outline" className="text-xs w-fit">
                                    {name}
                                  </Badge>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium whitespace-nowrap">{formatDate(session.schedule_date)}</span>
                            <span className="text-xs text-muted-foreground">({getDayOfWeek(session.schedule_date)})</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3 flex-shrink-0" />
                            <span className="whitespace-nowrap">
                              {formatTime(session.start_time)}{session.end_time ? ` – ${formatTime(session.end_time)}` : ''}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <Badge 
                          variant="secondary"
                          className={`${getStatusColor(session.status)} capitalize whitespace-nowrap`}
                        >
                          {session.status || 'Unknown'}
                        </Badge>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex space-x-2">
                          {session.status === 'draft' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handlePublish(session)}
                              disabled={!session.link || !session.start_time || publishing === session.id}
                              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                              title={!session.link || !session.start_time ? "Add Zoom link & start time first" : "Publish & notify students"}
                            >
                              <Send className="w-4 h-4 mr-1" />
                              {publishing === session.id ? 'Publishing...' : 'Publish'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (session.link) {
                                window.open(session.link, '_blank');
                              } else {
                                toast({
                                  title: "No Link",
                                  description: "No session link available",
                                  variant: "destructive"
                                });
                              }
                            }}
                            className="hover-scale hover:bg-blue-50 hover:border-blue-300"
                            disabled={!session.link}
                            title="Open session link"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(session)}
                            className="hover-scale hover:bg-green-50 hover:border-green-300"
                            title="Edit session"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {session.course_id && pathwayCourses.some(pc => pc.course_id === session.course_id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleShared(session)}
                              className={`hover-scale ${session.pathway_id ? 'hover:bg-blue-50 hover:border-blue-300' : 'hover:bg-purple-50 hover:border-purple-300'}`}
                              title={session.pathway_id ? 'Make shared across pathways' : 'Separate per pathway'}
                            >
                              {session.pathway_id ? <LinkIcon className="w-4 h-4" /> : <Users2 className="w-4 h-4" />}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(session.id)}
                            className="hover-scale hover:bg-red-50 hover:border-red-300"
                            title="Delete session"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}

interface UpcomingSessionsPreviewProps {
  sessions: SuccessSession[];
  courses: Course[];
  batches: Batch[];
  batchCourseMap: Record<string, string[]>;
  pathways: Pathway[];
  pathwayCourses: PathwayCourse[];
  onEdit: (session: SuccessSession) => void;
}

interface ComputedWeekSession {
  session: SuccessSession;
  computedDate: Date;
  batchId: string;
  batchName: string;
}

function UpcomingSessionsPreview({ sessions, courses, batches, batchCourseMap, pathways, pathwayCourses, onEdit }: UpcomingSessionsPreviewProps) {
  const [selectedBatch, setSelectedBatch] = useState('__all__');
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const now = new Date();
  const sevenDaysLater = new Date(now);
  sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

  const getPathway = (session: SuccessSession) => {
    // Use pathway_id directly if available
    if (session.pathway_id) {
      return pathways.find(p => p.id === session.pathway_id)?.name || null;
    }
    // Fallback: look up via course
    if (!session.course_id) return null;
    const pc = pathwayCourses.find(p => p.course_id === session.course_id);
    if (!pc) return null;
    return pathways.find(p => p.id === pc.pathway_id)?.name || null;
  };

  // Compute per-batch schedule dates using drip_days + batch start_date
  const computedSessions: ComputedWeekSession[] = [];

  for (const session of sessions) {
    if (session.status === 'cancelled') continue;

    const dripDays = (session as any).drip_days as number | null;

    // For drip-based sessions, compute date per batch regardless of status
    // (a session can be "completed" for one batch but upcoming for another)
    const skipNonDrip = session.status === 'completed' && dripDays == null;

    // Resolve batch IDs from both legacy batch_id and new batch_ids JSONB
    const sessionBatchIdList: string[] = Array.isArray((session as any).batch_ids)
      ? (session as any).batch_ids
      : typeof (session as any).batch_ids === 'string'
        ? (() => { try { const p = JSON.parse((session as any).batch_ids); return Array.isArray(p) ? p : []; } catch { return []; } })()
        : session.batch_id ? [session.batch_id] : [];

    if (dripDays != null) {
      let relevantBatches: Batch[];
      if (sessionBatchIdList.length > 0) {
        relevantBatches = batches.filter(b => sessionBatchIdList.includes(b.id));
      } else if (session.course_id) {
        const junctionBatchIds = batchCourseMap[session.course_id] || [];
        relevantBatches = batches.filter(b =>
          b.start_date && (b.course_id === session.course_id || junctionBatchIds.includes(b.id))
        );
      } else {
        relevantBatches = batches.filter(b => b.start_date);
      }

      for (const batch of relevantBatches) {
        if (!batch.start_date) continue;
        const batchStart = new Date(batch.start_date);
        const computedDate = new Date(batchStart);
        computedDate.setDate(computedDate.getDate() + dripDays);

        if (computedDate >= now && computedDate <= sevenDaysLater) {
          computedSessions.push({
            session,
            computedDate,
            batchId: batch.id,
            batchName: batch.name,
          });
        }
      }
    } else if (!skipNonDrip && session.schedule_date) {
      try {
        const sessionDate = new Date(session.schedule_date);
        if (sessionDate >= now && sessionDate <= sevenDaysLater) {
          if (sessionBatchIdList.length > 0) {
            // Create an entry per batch so each batch shows individually
            for (const bid of sessionBatchIdList) {
              const bName = batches.find(b => b.id === bid)?.name || bid;
              computedSessions.push({
                session,
                computedDate: sessionDate,
                batchId: bid,
                batchName: bName,
              });
            }
          } else {
            computedSessions.push({
              session,
              computedDate: sessionDate,
              batchId: '__all__',
              batchName: 'All Batches',
            });
          }
        }
      } catch { /* skip invalid dates */ }
    }
  }

  // Build pathway/course filter options
  const filterOptions: { id: string; label: string; type: 'pathway' | 'course' }[] = [];
  const pathwaysInSessions = new Set<string>();
  const coursesInSessions = new Set<string>();

  for (const cs of computedSessions) {
    if (cs.session.course_id) {
      coursesInSessions.add(cs.session.course_id);
    }
    if (cs.session.pathway_id) {
      pathwaysInSessions.add(cs.session.pathway_id);
    } else if (cs.session.course_id) {
      // Fallback for sessions without pathway_id
      const pcs = pathwayCourses.filter(pc => pc.course_id === cs.session.course_id);
      pcs.forEach(pc => pathwaysInSessions.add(pc.pathway_id));
    }
  }

  pathways.filter(p => pathwaysInSessions.has(p.id)).forEach(p => {
    filterOptions.push({ id: `pathway:${p.id}`, label: `🎯 ${p.name}`, type: 'pathway' });
  });
  courses.filter(c => coursesInSessions.has(c.id)).forEach(c => {
    filterOptions.push({ id: `course:${c.id}`, label: c.title, type: 'course' });
  });

  const toggleFilter = (filterId: string) => {
    setSelectedFilters(prev =>
      prev.includes(filterId) ? prev.filter(f => f !== filterId) : [...prev, filterId]
    );
  };

  // Apply batch filter
  let filtered = selectedBatch === '__all__'
    ? computedSessions
    : computedSessions.filter(cs => cs.batchId === selectedBatch);

  // Apply pathway/course multi-select filter
  if (selectedFilters.length > 0) {
    const selectedPathwayIds = new Set<string>();
    const selectedCourseIds = new Set<string>();
    for (const f of selectedFilters) {
      if (f.startsWith('pathway:')) {
        selectedPathwayIds.add(f.replace('pathway:', ''));
      } else if (f.startsWith('course:')) {
        selectedCourseIds.add(f.replace('course:', ''));
      }
    }
    filtered = filtered.filter(cs => {
      // Match by pathway_id directly
      if (cs.session.pathway_id && selectedPathwayIds.has(cs.session.pathway_id)) return true;
      // Match by course_id
      if (cs.session.course_id && selectedCourseIds.has(cs.session.course_id)) return true;
      // Fallback: match course via pathway_courses junction
      if (cs.session.course_id && selectedPathwayIds.size > 0) {
        return pathwayCourses.some(pc => 
          pc.course_id === cs.session.course_id && selectedPathwayIds.has(pc.pathway_id)
        );
      }
      return false;
    });
  }

  filtered.sort((a, b) => a.computedDate.getTime() - b.computedDate.getTime());

  // Deduplicate by session ID: merge batch names into a single entry
  const deduped: (ComputedWeekSession & { allBatchNames: string[] })[] = [];
  const seenSessionIds = new Map<string, number>();
  for (const cs of filtered) {
    const existing = seenSessionIds.get(cs.session.id);
    if (existing !== undefined) {
      if (cs.batchName && !deduped[existing].allBatchNames.includes(cs.batchName)) {
        deduped[existing].allBatchNames.push(cs.batchName);
      }
    } else {
      seenSessionIds.set(cs.session.id, deduped.length);
      deduped.push({ ...cs, allBatchNames: [cs.batchName] });
    }
  }

   const batchesForDropdown = batches.filter(b => b.status === 'active' || computedSessions.some(cs => cs.batchId === b.id));

  const needsAttention = (session: SuccessSession) => {
    return !session.zoom_meeting_id || !session.zoom_passcode || session.link === 'TBD' || !session.link;
  };

  // Always show the section, even if empty

  return (
    <Card className="shadow-lg border-0 bg-gradient-to-br from-amber-50 to-orange-50 animate-fade-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <CalendarDays className="w-5 h-5 mr-2 text-amber-600" />
            Upcoming Live Classes — Next 7 Days
            <Badge variant="secondary" className="ml-2">{deduped.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {filterOptions.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                    <Filter className="w-3 h-3" />
                    Pathway / Course
                    {selectedFilters.length > 0 && (
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{selectedFilters.length}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-3 bg-popover z-50" align="end">
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Filter by pathway or course</p>
                    {filterOptions.map(opt => (
                      <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-sm hover:bg-accent/50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={selectedFilters.includes(opt.id)}
                          onCheckedChange={() => toggleFilter(opt.id)}
                        />
                        <span className="truncate">{opt.label}</span>
                      </label>
                    ))}
                    {selectedFilters.length > 0 && (
                      <Button variant="ghost" size="sm" className="w-full text-xs mt-1" onClick={() => setSelectedFilters([])}>
                        Clear all
                      </Button>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
              <SelectTrigger className="w-[200px] h-8 text-xs">
                <SelectValue placeholder="Filter by batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Batches</SelectItem>
                {batchesForDropdown.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {deduped.length === 0 ? (
          <div className="text-center py-8">
            <CalendarDays className="w-10 h-10 mx-auto mb-2 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No live classes scheduled in the next 7 days</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Sessions will appear here based on course timelines and batch start dates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deduped.map((cs, idx) => {
              const { session, computedDate, allBatchNames } = cs;
              const missing = needsAttention(session);
              const courseName = courses.find(c => c.id === session.course_id)?.title;
              const pathwayName = getPathway(session);

              return (
                <div
                  key={`${session.id}-${idx}`}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors hover:bg-background/80 ${
                    missing ? 'border-amber-300 bg-amber-50/50' : 'border-green-300 bg-green-50/50'
                  }`}
                  onClick={() => onEdit(session)}
                >
                  {missing ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <Video className="w-4 h-4 text-green-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{session.title}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{format(computedDate, 'EEE, MMM d')}</span>
                      {session.start_time && <span>• {format(new Date(session.start_time), 'h:mm a')}</span>}
                      {pathwayName && <span>• 🎯 {pathwayName}</span>}
                      {courseName && <span>• {courseName}</span>}
                      {allBatchNames.map(bn => (
                        <Badge key={bn} variant="outline" className="text-[10px] px-1.5 py-0">{bn}</Badge>
                      ))}
                    </div>
                  </div>
                  {missing && (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 shrink-0">
                      Needs Zoom Details
                    </Badge>
                  )}
                  {session.status === 'draft' && (
                    <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-700 shrink-0">
                      Draft
                    </Badge>
                  )}
                  {session.mentor_name && (
                    <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {session.mentor_name}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
