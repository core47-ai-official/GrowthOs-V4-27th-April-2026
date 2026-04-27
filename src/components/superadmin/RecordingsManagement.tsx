import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Edit, Trash2, Video, ChevronDown, RefreshCw, GripVertical, HelpCircle, Eye, Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RecordingRatingDetails } from './RecordingRatingDetails';
import { RecordingAttachmentsManager } from './RecordingAttachmentsManager';
import { safeLogger } from '@/lib/safe-logger';
import { VideoPreviewDialog } from '@/components/VideoPreviewDialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Recording {
  id: string;
  recording_title: string;
  recording_url: string;
  duration_min: number;
  sequence_order: number;
  notes: string;
  description?: string | null;
  assignment_id: string | null;
  drip_days: number;
  module: {
    id: string;
    title: string;
    course_id: string | null;
    course?: {
      id: string;
      title: string;
    } | null;
  };
}

interface Module {
  id: string;
  title: string;
  course_id: string | null;
}

interface Course {
  id: string;
  title: string;
  is_published?: boolean;
}

interface Assignment {
  id: string;
  name: string;
}

// Sortable Recording Row Component
function SortableRecordingRow({ 
  recording, 
  index, 
  isExpanded, 
  onToggleExpand, 
  onEdit, 
  onDelete,
  onRefresh,
  onView,
  courses,
  readOnly
}: {
  recording: Recording;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (recording: Recording) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
  onView: (recording: Recording) => void;
  courses: Course[];
  readOnly?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: recording.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <div 
        ref={setNodeRef}
        style={style}
        className="grid grid-cols-[24px_24px_1fr_100px_80px_160px] items-center gap-4 p-4 hover:bg-muted/50 transition-colors animate-fade-in"
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors flex justify-center"
        >
          <GripVertical className="w-5 h-5" />
        </div>
        <div className="flex justify-center">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-6 w-6 hover:bg-transparent"
            >
              <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
        <div className="font-medium truncate">{recording.recording_title}</div>
        <div className="text-center text-sm text-muted-foreground">
          {recording.duration_min} min
        </div>
        <div className="text-center">
          <Badge variant="outline">{recording.sequence_order || 0}</Badge>
        </div>
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(recording)}
            className="hover-scale hover:bg-green-50 hover:border-green-300"
            title="Preview video"
          >
            <Eye className="w-4 h-4" />
          </Button>
          {!readOnly && <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(recording)}
            className="hover-scale hover:bg-blue-50 hover:border-blue-300"
            title="Edit recording"
          >
            <Edit className="w-4 h-4" />
          </Button>}
          {!readOnly && <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(recording.id)}
            className="hover-scale hover:bg-red-50 hover:border-red-300"
            title="Delete recording"
          >
            <Trash2 className="w-4 h-4" />
          </Button>}
        </div>
      </div>
      
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4 bg-gray-50/50">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Module:</p>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
              {recording.module?.title || 'Unassigned'}
            </Badge>
          </div>
          {recording.description && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
              <p className="text-sm text-gray-600">{recording.description}</p>
            </div>
          )}
          {recording.notes && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
              <p className="text-sm text-gray-600">{recording.notes}</p>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Video URL:</p>
            <a 
              href={recording.recording_url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline break-all"
            >
              {recording.recording_url}
            </a>
          </div>
          <div className="pt-2">
            <RecordingRatingDetails 
              recordingId={recording.id} 
              recordingTitle={recording.recording_title}
              onDelete={onRefresh}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RecordingsManagement({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingUnlocks, setSyncingUnlocks] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [showUrlExamples, setShowUrlExamples] = useState(false);
  const [previewRecording, setPreviewRecording] = useState<{ title: string; url: string } | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');
  const [filterModuleId, setFilterModuleId] = useState<string>('all');
  
  const [formData, setFormData] = useState({
    recording_title: '',
    recording_url: '',
    duration_min: 0,
    sequence_order: 0,
    notes: '',
    description: '',
    course_id: '',
    module_id: '',
    assignment_id: '',
    drip_days: 0
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRecordings();
    fetchCourses();
    fetchModules();
    fetchAssignments();
  }, []);

  const fetchRecordings = async () => {
    try {
      safeLogger.info('Fetching recordings...');
      const { data, error } = await supabase
        .from('available_lessons')
        .select(`
          *,
          module:modules(id, title, course_id)
        `)
        .order('sequence_order');

      if (error) {
        safeLogger.error('Error fetching recordings:', error);
        throw error;
      }
      
      safeLogger.info('Recordings fetched:', { data });
      setRecordings((data || []).map(r => {
        const mod = r.module as { id: string; title: string; course_id: string | null } | null;
        return { 
          ...r, 
          drip_days: (r as any).drip_days || 0,
          module: mod 
            ? { id: mod.id, title: mod.title, course_id: mod.course_id || null } 
            : { id: '', title: '', course_id: null }
        };
      }));
    } catch (error) {
      safeLogger.error('Failed to fetch recordings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch recordings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title, is_published')
        .order('sequence_order');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      safeLogger.error('Error fetching courses:', error);
    }
  };

  const fetchModules = async () => {
    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title, course_id')
        .order('order');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      safeLogger.error('Error fetching modules:', error);
    }
  };

  // Filter modules based on selected course (for form)
  const filteredModules = formData.course_id 
    ? modules.filter(m => m.course_id === formData.course_id)
    : modules;

  // Filter modules based on filter course (for filter dropdown)
  const filterModulesForCourse = filterCourseId !== 'all' 
    ? modules.filter(m => m.course_id === filterCourseId)
    : modules;

  // Apply search and filter to recordings
  const filteredRecordings = recordings.filter(recording => {
    // Search filter
    const matchesSearch = searchQuery === '' || 
      recording.recording_title.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Course filter
    const matchesCourse = filterCourseId === 'all' || 
      recording.module?.course_id === filterCourseId;
    
    // Module filter  
    const matchesModule = filterModuleId === 'all' || 
      recording.module?.id === filterModuleId;
    
    return matchesSearch && matchesCourse && matchesModule;
  });

  // Group recordings by course for display
  const groupedRecordings = useMemo(() => {
    if (filterCourseId !== 'all') return null; // No grouping when a specific course is filtered
    
    const groups = new Map<string, { courseTitle: string; recordings: Recording[] }>();
    
    for (const recording of filteredRecordings) {
      const courseId = recording.module?.course_id || '__none__';
      const courseTitle = courses.find(c => c.id === courseId)?.title || 'No Course (Global)';
      
      if (!groups.has(courseId)) {
        groups.set(courseId, { courseTitle, recordings: [] });
      }
      groups.get(courseId)!.recordings.push(recording);
    }
    
    // Sort: named courses first (by title), "No Course" last
    const sorted = Array.from(groups.entries()).sort(([aId, a], [bId, b]) => {
      if (aId === '__none__') return 1;
      if (bId === '__none__') return -1;
      return a.courseTitle.localeCompare(b.courseTitle);
    });
    
    return sorted;
  }, [filteredRecordings, filterCourseId, courses]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      safeLogger.error('Error fetching assignments:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    safeLogger.info('Form submission started with data:', { formData });
    
    try {
      const recordingData = {
        recording_title: formData.recording_title,
        recording_url: formData.recording_url,
        duration_min: formData.duration_min || null,
        sequence_order: formData.sequence_order || null,
        notes: formData.notes || null,
        description: formData.description || null,
        module: formData.module_id || null,
        assignment_id: formData.assignment_id || null,
        drip_days: formData.drip_days || 0
      };

      safeLogger.info('Prepared recording data:', { recordingData });

      if (editingRecording) {
        safeLogger.info('Updating recording with ID:', { recordingId: editingRecording.id });
        const { error } = await supabase
          .from('available_lessons')
          .update(recordingData)
          .eq('id', editingRecording.id);

        if (error) {
          safeLogger.error('Update error:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Recording updated successfully"
        });
      } else {
        safeLogger.info('Creating new recording...');
        const { error } = await supabase
          .from('available_lessons')
          .insert(recordingData);

        if (error) {
          safeLogger.error('Insert error:', error);
          throw error;
        }

        toast({
          title: "Success",
          description: "Recording created successfully"
        });
      }

      setDialogOpen(false);
      setEditingRecording(null);
      setFormData({
        recording_title: '',
        recording_url: '',
        duration_min: 0,
        sequence_order: 0,
        notes: '',
        description: '',
        course_id: '',
        module_id: '',
        assignment_id: '',
        drip_days: 0
      });
      
      // Refresh recordings
      await fetchRecordings();
    } catch (error) {
      safeLogger.error('Error saving recording:', error);
      toast({
        title: "Error",
        description: "Failed to save recording",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (recording: Recording) => {
    setEditingRecording(recording);
    setFormData({
      recording_title: recording.recording_title,
      recording_url: recording.recording_url,
      duration_min: recording.duration_min,
      sequence_order: recording.sequence_order,
      notes: recording.notes,
      description: recording.description || '',
      course_id: recording.module?.course_id || '',
      module_id: recording.module?.id || '',
      assignment_id: recording.assignment_id || '',
      drip_days: (recording as any).drip_days || 0
    });
    setDialogOpen(true);
  };

  const toggleRecordingExpansion = (recordingId: string) => {
    setExpandedRecordings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordingId)) {
        newSet.delete(recordingId);
      } else {
        newSet.add(recordingId);
      }
      return newSet;
    });
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle recording reordering
  const handleRecordingDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = recordings.findIndex((r) => r.id === active.id);
    const newIndex = recordings.findIndex((r) => r.id === over.id);

    const newRecordings = arrayMove(recordings, oldIndex, newIndex);
    
    // Update order numbers sequentially
    const updatedRecordings = newRecordings.map((recording, index) => ({
      ...recording,
      sequence_order: index + 1
    }));
    
    // Update UI immediately
    setRecordings(updatedRecordings);

    // Update order in database
    try {
      const updates = updatedRecordings.map((recording, index) => ({
        id: recording.id,
        sequence_order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('available_lessons')
          .update({ sequence_order: update.sequence_order })
          .eq('id', update.id);
      }

      toast({
        title: "Success",
        description: "Recording order updated"
      });
    } catch (error) {
      safeLogger.error('Error updating recording order:', error);
      toast({
        title: "Error",
        description: "Failed to update recording order",
        variant: "destructive"
      });
      // Revert on error
      fetchRecordings();
    }
  };

  const handleRecordingDeleted = (recordingId: string) => {
    setRecordings(prev => prev.filter(r => r.id !== recordingId));
    setExpandedRecordings(prev => {
      const newSet = new Set(prev);
      newSet.delete(recordingId);
      return newSet;
    });
  };

  const handleDelete = async (recordingId: string) => {
    if (!confirm('Are you sure you want to delete this recording?')) return;

    try {
      safeLogger.info('Deleting recording with ID:', { recordingId });
      const { error } = await supabase
        .from('available_lessons')
        .delete()
        .eq('id', recordingId);

      if (error) {
        safeLogger.error('Delete error:', error);
        throw error;
      }

      toast({
        title: "Success",
        description: "Recording deleted successfully"
      });
      
      await fetchRecordings();
    } catch (error) {
      safeLogger.error('Error deleting recording:', error);
      toast({
        title: "Error",
        description: "Failed to delete recording",
        variant: "destructive"
      });
    }
  };

  const handleSyncAllUsersUnlocks = async () => {
    setSyncingUnlocks(true);
    try {
      const { data, error } = await supabase.rpc('sync_all_users_unlock_progress');
      
      if (error) throw error;
      
      toast({
        title: "Success",
        description: data || "Synced unlock progress for all users"
      });
    } catch (error) {
      safeLogger.error('Error syncing user unlocks:', error);
      toast({
        title: "Error",
        description: "Failed to sync user unlock progress",
        variant: "destructive"
      });
    } finally {
      setSyncingUnlocks(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading recordings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Recordings Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage video recordings and their assignments</p>
        </div>
        {!readOnly && <div className="flex gap-3">
          <Button 
            onClick={handleSyncAllUsersUnlocks}
            disabled={syncingUnlocks}
            variant="outline"
            className="hover-scale bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white hover:text-white border-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncingUnlocks ? 'animate-spin' : ''}`} />
            {syncingUnlocks ? 'Syncing...' : 'Sync All User Unlocks'}
          </Button>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                onClick={() => {
                  setEditingRecording(null);
                  setFormData({
                    recording_title: '',
                    recording_url: '',
                    duration_min: 0,
                    sequence_order: 0,
                    notes: '',
                    description: '',
                    course_id: '',
                    module_id: '',
                    assignment_id: '',
                    drip_days: 0
                  });
                }}
                className="hover-scale bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Recording
              </Button>
            </DialogTrigger>
          <DialogContent className="w-[95vw] sm:max-w-4xl h-[85vh] sm:h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingRecording ? 'Edit Recording' : 'Add New Recording'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title <span className="text-destructive">*</span></label>
                <Input
                  value={formData.recording_title}
                  onChange={(e) => setFormData({ ...formData, recording_title: e.target.value })}
                  placeholder="Enter recording title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Video URL <span className="text-destructive">*</span></label>
                <Input
                  value={formData.recording_url}
                  onChange={(e) => setFormData({ ...formData, recording_url: e.target.value })}
                  placeholder="Enter video URL"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
                <Collapsible open={showUrlExamples} onOpenChange={setShowUrlExamples}>
                  <CollapsibleTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <HelpCircle className="w-3 h-3 mr-1" />
                      {showUrlExamples ? 'Hide' : 'Show'} URL format examples
                      <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${showUrlExamples ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2">
                    <div className="bg-muted/50 rounded-md p-3 text-xs space-y-3 border">
                      <div>
                        <p className="font-semibold text-foreground mb-1">BunnyStream (Recommended):</p>
                        <code className="block bg-background px-2 py-1 rounded text-[11px] break-all">
                          https://iframe.mediadelivery.net/embed/494424/e2054877-6f57-4cc0-aac9-96af6137af3d
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">YouTube:</p>
                        <code className="block bg-background px-2 py-1 rounded text-[11px] break-all">
                          https://www.youtube.com/watch?v=dQw4w9WgXcQ
                        </code>
                        <code className="block bg-background px-2 py-1 rounded text-[11px] break-all mt-1">
                          https://youtu.be/dQw4w9WgXcQ
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Google Drive:</p>
                        <code className="block bg-background px-2 py-1 rounded text-[11px] break-all">
                          https://drive.google.com/file/d/FILE_ID/preview
                        </code>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground mb-1">Direct Embed URL:</p>
                        <code className="block bg-background px-2 py-1 rounded text-[11px] break-all">
                          https://www.youtube.com/embed/dQw4w9WgXcQ
                        </code>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Duration (minutes) <span className="text-destructive">*</span></label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.duration_min}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setFormData({ ...formData, duration_min: Math.max(0, value) });
                    }}
                    placeholder="Duration"
                    className="transition-all duration-200 focus:scale-[1.02]"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Overall Sequence <span className="text-destructive">*</span></label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.sequence_order}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setFormData({ ...formData, sequence_order: Math.max(0, value) });
                    }}
                    placeholder="Order"
                    className="transition-all duration-200 focus:scale-[1.02]"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Drip Days</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.drip_days}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setFormData({ ...formData, drip_days: Math.max(0, value) });
                    }}
                    placeholder="Days after enrollment"
                    className="transition-all duration-200 focus:scale-[1.02]"
                  />
                  <p className="text-xs text-muted-foreground">
                    Days after enrollment before this recording becomes available (0 = immediately)
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Course</label>
                  <Select
                    value={formData.course_id || 'all'}
                    onValueChange={(value) => setFormData({ ...formData, course_id: value === 'all' ? '' : value, module_id: '' })}
                  >
                    <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                      <SelectValue placeholder="Select a course (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      <SelectItem value="all">All Courses</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Filter modules by course</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Module <span className="text-destructive">*</span></label>
                  <Select
                    value={formData.module_id}
                    onValueChange={(value) => setFormData({ ...formData, module_id: value })}
                    required
                  >
                    <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                      <SelectValue placeholder="Select a module" />
                    </SelectTrigger>
                    <SelectContent className="bg-white z-50">
                      {filteredModules.map((module) => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Assignment to Unlock After Watching</label>
                <Select
                  value={formData.assignment_id}
                  onValueChange={(value) => setFormData({ ...formData, assignment_id: value })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select an assignment" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {assignments.map((assignment) => (
                      <SelectItem key={assignment.id} value={assignment.id}>
                        {assignment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed description of this recording (visible to students)"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[160px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Notes</label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Internal notes or instructions (optional)"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Attachments</label>
                {editingRecording?.id ? (
                  <RecordingAttachmentsManager recordingId={editingRecording.id} />
                ) : (
                  <p className="text-sm text-muted-foreground">Save the recording first to upload attachments.</p>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                  className="hover-scale"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  className="hover-scale bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                >
                  {editingRecording ? 'Update' : 'Create'} Recording
                </Button>
              </div>
            </form>
          </DialogContent>
          </Dialog>
        </div>}
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <div className="flex flex-col gap-4">
            <CardTitle className="flex items-center text-xl">
              <Video className="w-6 h-6 mr-3 text-purple-600" />
              All Recordings
            </CardTitle>
            
            {/* Search and Filter Controls */}
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search Input */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-white"
                />
              </div>
              
              {/* Course Filter */}
              <Select
                value={filterCourseId}
                onValueChange={(value) => {
                  setFilterCourseId(value);
                  setFilterModuleId('all'); // Reset module filter when course changes
                }}
              >
                <SelectTrigger className="w-[200px] bg-white">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by course" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title} {course.is_published === false && <span className="text-muted-foreground">(Draft)</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Module Filter */}
              <Select
                value={filterModuleId}
                onValueChange={setFilterModuleId}
                disabled={filterCourseId === 'all'}
              >
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder="Filter by module" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="all">All Modules</SelectItem>
                  {filterModulesForCourse.map((module) => (
                    <SelectItem key={module.id} value={module.id}>
                      {module.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {(searchQuery || filterCourseId !== 'all' || filterModuleId !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterCourseId('all');
                    setFilterModuleId('all');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRecordings.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                {recordings.length === 0 ? 'No recordings found' : 'No recordings match your filters'}
              </h3>
              <p className="text-muted-foreground">
                {recordings.length === 0 ? 'Upload your first recording to get started' : 'Try adjusting your search or filters'}
              </p>
            </div>
          ) : groupedRecordings ? (
            /* Grouped by course view */
            <div data-testid="recordings-table" className="w-full">
              {groupedRecordings.map(([courseId, group]) => (
                <Collapsible key={courseId} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-3 w-full p-4 bg-muted/50 border-b hover:bg-muted/70 transition-colors">
                    <ChevronDown className="w-4 h-4 transition-transform [&[data-state=open]]:rotate-180" />
                    <span className="font-semibold text-base">{group.courseTitle}</span>
                    <Badge variant="secondary" className="ml-auto">{group.recordings.length} recordings</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {/* Header */}
                    <div className="grid grid-cols-[24px_24px_1fr_100px_80px_160px] items-center gap-4 p-4 bg-muted/30 border-b font-semibold text-sm">
                      <div></div>
                      <div></div>
                      <div>Title <span className="text-xs font-normal text-muted-foreground ml-2">Drag to reorder</span></div>
                      <div className="text-center">Duration</div>
                      <div className="text-center">Order</div>
                      {!readOnly && <div className="text-center">Actions</div>}
                    </div>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleRecordingDragEnd}
                    >
                      <div className="divide-y">
                        <SortableContext
                          items={group.recordings.map(r => r.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {group.recordings.map((recording, index) => (
                            <SortableRecordingRow
                              key={recording.id}
                              recording={recording}
                              index={index}
                              isExpanded={expandedRecordings.has(recording.id)}
                              onToggleExpand={() => toggleRecordingExpansion(recording.id)}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              onRefresh={fetchRecordings}
                              onView={(rec) => setPreviewRecording({ title: rec.recording_title, url: rec.recording_url })}
                              courses={courses}
                              readOnly={readOnly}
                            />
                          ))}
                        </SortableContext>
                      </div>
                    </DndContext>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            /* Flat list when specific course is filtered */
            <div data-testid="recordings-table" className="w-full">
              {/* Header */}
              <div className="grid grid-cols-[24px_24px_1fr_100px_80px_160px] items-center gap-4 p-4 bg-muted/30 border-b font-semibold text-sm">
                <div></div>
                <div></div>
                <div>Title <span className="text-xs font-normal text-muted-foreground ml-2">Drag to reorder</span></div>
                <div className="text-center">Duration</div>
                <div className="text-center">Order</div>
                {!readOnly && <div className="text-center">Actions</div>}
              </div>
              
              {/* Body */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRecordingDragEnd}
              >
                <div className="divide-y">
                  <SortableContext
                    items={filteredRecordings.map(r => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredRecordings.map((recording, index) => (
                      <SortableRecordingRow
                        key={recording.id}
                        recording={recording}
                        index={index}
                        isExpanded={expandedRecordings.has(recording.id)}
                        onToggleExpand={() => toggleRecordingExpansion(recording.id)}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onRefresh={fetchRecordings}
                        onView={(rec) => setPreviewRecording({ title: rec.recording_title, url: rec.recording_url })}
                        courses={courses}
                        readOnly={readOnly}
                      />
                    ))}
                  </SortableContext>
                </div>
              </DndContext>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Video Preview Dialog */}
      <VideoPreviewDialog
        open={!!previewRecording}
        onOpenChange={(open) => !open && setPreviewRecording(null)}
        recordingTitle={previewRecording?.title || ''}
        recordingUrl={previewRecording?.url || ''}
      />
    </div>
  );
}
