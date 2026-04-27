import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Plus, Edit, Video, ChevronDown, GripVertical, Play, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { RecordingRatingDetails } from '../superadmin/RecordingRatingDetails';
import { RecordingAttachmentsManager } from '../superadmin/RecordingAttachmentsManager';
import { VideoPreviewDialog } from '@/components/VideoPreviewDialog';
import { safeLogger } from '@/lib/safe-logger';
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
  recording_url: string | null;
  duration_min: number;
  sequence_order: number;
  notes: string;
  description?: string | null;
  assignment_id: string | null;
  module: {
    id: string;
    title: string;
  };
}

interface Module {
  id: string;
  title: string;
}

interface Assignment {
  id: string;
  name: string;
}

interface Course {
  id: string;
  title: string;
}

// Sortable Table Row Component
function SortableRecordingRow({
  recording,
  index,
  isExpanded,
  onToggle,
  onEdit,
  onPreview,
}: {
  recording: Recording;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (recording: Recording) => void;
  onPreview: (recording: Recording) => void;
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
    <React.Fragment>
      <TableRow
        ref={setNodeRef}
        style={style}
        className="hover:bg-gray-50 transition-colors animate-fade-in cursor-pointer"
      >
        <TableCell className="w-[40px]">
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors flex justify-center"
          >
            <GripVertical className="w-5 h-5" />
          </div>
        </TableCell>
        <TableCell className="font-medium w-[40%]" onClick={onToggle}>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-0 h-8 w-8 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </Button>
            <span className="truncate">{recording.recording_title}</span>
          </div>
        </TableCell>
        <TableCell className="w-[15%] text-center">
          <Badge variant="outline" className="font-semibold">
            {recording.sequence_order || 'N/A'}
          </Badge>
        </TableCell>
        <TableCell className="w-[20%]">
          {recording.module ? (
            <Badge variant="secondary">{recording.module.title}</Badge>
          ) : (
            <span className="text-muted-foreground">No module</span>
          )}
        </TableCell>
        <TableCell className="w-[15%] text-center">
          <span className="font-medium">{recording.duration_min || 'N/A'} min</span>
        </TableCell>
        <TableCell className="w-[10%]" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center space-x-2">
            {recording.recording_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onPreview(recording);
                }}
                className="hover-scale"
                title="Preview video"
              >
                <Play className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(recording);
              }}
              className="hover-scale"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-gray-50 p-6">
            <div className="space-y-4">
              {recording.description && (
                <div>
                  <h4 className="font-semibold mb-2">Description:</h4>
                  <p className="text-sm text-muted-foreground">{recording.description}</p>
                </div>
              )}
              {recording.notes && (
                <div>
                  <h4 className="font-semibold mb-2">Notes:</h4>
                  <p className="text-sm text-muted-foreground">{recording.notes}</p>
                </div>
              )}
              <RecordingRatingDetails
                recordingId={recording.id}
                recordingTitle={recording.recording_title}
                onDelete={() => {}}
              />
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}

export function MentorRecordingsManagement() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [assignedCourseIds, setAssignedCourseIds] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRecording, setEditingRecording] = useState<Recording | null>(null);
  const [expandedRecordings, setExpandedRecordings] = useState<Set<string>>(new Set());
  const [previewRecording, setPreviewRecording] = useState<Recording | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    recording_title: '',
    duration_min: 0,
    sequence_order: 0,
    notes: '',
    description: '',
    module_id: '',
    assignment_id: ''
  });
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchAssignedCourses();
    }
  }, [user?.id]);

  useEffect(() => {
    if (assignedCourseIds.length > 0) {
      fetchRecordings();
      fetchModules();
      fetchAssignments();
    } else if (assignedCourseIds.length === 0 && !loading) {
      setRecordings([]);
      setModules([]);
      setAssignments([]);
    }
  }, [assignedCourseIds, selectedCourseId]);

  const fetchAssignedCourses = async () => {
    try {
      safeLogger.info('Fetching assigned courses for mentor...');
      const { data, error } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, is_global, courses(id, title)')
        .eq('mentor_id', user?.id);

      if (error) throw error;

      // Check if mentor has global access
      const hasGlobalAccess = data?.some(a => a.is_global);
      
      if (hasGlobalAccess) {
        // Fetch all courses
        const { data: allCourses, error: coursesError } = await supabase
          .from('courses')
          .select('id, title')
          .order('title');
        
        if (coursesError) throw coursesError;
        setAssignedCourses(allCourses || []);
        setAssignedCourseIds(allCourses?.map(c => c.id) || []);
      } else {
        const courses = data?.map(a => a.courses).filter(Boolean) as Course[] || [];
        setAssignedCourses(courses);
        const courseIds = data?.map(a => a.course_id).filter(Boolean) as string[] || [];
        setAssignedCourseIds(courseIds);
      }
      
      safeLogger.info('Assigned courses fetched');
    } catch (error) {
      safeLogger.error('Error fetching assigned courses:', error);
      setLoading(false);
    }
  };

  const fetchRecordings = async () => {
    const filterCourseIds = selectedCourseId === 'all' 
      ? assignedCourseIds 
      : [selectedCourseId];

    if (filterCourseIds.length === 0) {
      setRecordings([]);
      setLoading(false);
      return;
    }

    try {
      safeLogger.info('Fetching recordings (mentor view) for assigned courses...');
      
      // First get module IDs for selected courses
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .in('course_id', filterCourseIds);

      if (moduleError) throw moduleError;
      
      const moduleIds = moduleData?.map(m => m.id) || [];
      
      if (moduleIds.length === 0) {
        setRecordings([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('available_lessons')
        .select(`
          id,
          recording_title,
          recording_url,
          duration_min,
          sequence_order,
          notes,
          description,
          assignment_id,
          module:modules(id, title)
        `)
        .in('module', moduleIds)
        .order('sequence_order');

      if (error) {
        safeLogger.error('Error fetching recordings:', error);
        throw error;
      }
      
      safeLogger.info('Recordings fetched:', { data });
      setRecordings(data || []);
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

  const fetchModules = async () => {
    const filterCourseIds = selectedCourseId === 'all' 
      ? assignedCourseIds 
      : [selectedCourseId];

    if (filterCourseIds.length === 0) {
      setModules([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('modules')
        .select('id, title')
        .in('course_id', filterCourseIds)
        .order('order');

      if (error) throw error;
      setModules(data || []);
    } catch (error) {
      safeLogger.error('Error fetching modules:', error);
    }
  };

  const fetchAssignments = async () => {
    if (assignedCourseIds.length === 0) {
      setAssignments([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('assignments')
        .select('id, name')
        .in('course_id', assignedCourseIds)
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
        duration_min: formData.duration_min || null,
        sequence_order: formData.sequence_order || null,
        notes: formData.notes || null,
        description: formData.description || null,
        module: formData.module_id || null,
        assignment_id: formData.assignment_id || null
        // Note: recording_url is NOT included - mentors cannot modify it
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
        duration_min: 0,
        sequence_order: 0,
        notes: '',
        description: '',
        module_id: '',
        assignment_id: ''
      });
      
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
      duration_min: recording.duration_min,
      sequence_order: recording.sequence_order,
      notes: recording.notes,
      description: recording.description || '',
      module_id: recording.module?.id || '',
      assignment_id: recording.assignment_id || ''
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
      sequence_order: index + 1,
    }));

    // Update UI immediately
    setRecordings(updatedRecordings);

    // Update order in database
    try {
      const updates = updatedRecordings.map((recording, index) => ({
        id: recording.id,
        sequence_order: index + 1,
      }));

      for (const update of updates) {
        await supabase
          .from('available_lessons')
          .update({ sequence_order: update.sequence_order })
          .eq('id', update.id);
      }

      toast({
        title: 'Success',
        description: 'Recording order updated',
      });
    } catch (error) {
      safeLogger.error('Error updating recording order:', error);
      toast({
        title: 'Error',
        description: 'Failed to update recording order',
        variant: 'destructive',
      });
      // Revert on error
      fetchRecordings();
    }
  };

  // Filter recordings by search query
  const filteredRecordings = recordings.filter(recording =>
    recording.recording_title.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Recordings Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">View and edit video recordings</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search recordings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px]"
            />
          </div>
          
          {/* Course filter */}
          {assignedCourses.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Course:</span>
              <Select value={selectedCourseId} onValueChange={setSelectedCourseId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {assignedCourses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-[95vw] sm:max-w-4xl h-[85vh] sm:h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingRecording ? 'Edit Recording' : 'Add New Recording'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title</label>
                <Input
                  value={formData.recording_title}
                  onChange={(e) => setFormData({ ...formData, recording_title: e.target.value })}
                  placeholder="Enter recording title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              {/* Video URL field is NOT included for mentors */}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.duration_min}
                    onChange={(e) => setFormData({ ...formData, duration_min: parseInt(e.target.value) || 0 })}
                    placeholder="Duration"
                    className="transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Sequence Order</label>
                  <Input
                    type="number"
                    value={formData.sequence_order}
                    onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 0 })}
                    placeholder="Order"
                    className="transition-all duration-200 focus:scale-[1.02]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Module</label>
                <Select
                  value={formData.module_id}
                  onValueChange={(value) => setFormData({ ...formData, module_id: value })}
                >
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select a module" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>
                        {module.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Video className="w-6 h-6 mr-3 text-purple-600" />
            All Recordings
            {searchQuery && (
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                ({filteredRecordings.length} of {recordings.length} shown)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRecordings.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <Video className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                {searchQuery ? 'No recordings match your search' : 'No recordings found'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Create your first recording to get started'}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleRecordingDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="font-semibold w-[40px]"></TableHead>
                    <TableHead className="font-semibold w-[40%]">
                      Title <span className="text-xs font-normal text-muted-foreground ml-2">Drag to reorder</span>
                    </TableHead>
                    <TableHead className="font-semibold w-[15%] text-center">Order</TableHead>
                    <TableHead className="font-semibold w-[20%]">Module</TableHead>
                    <TableHead className="font-semibold w-[15%] text-center">Duration</TableHead>
                    <TableHead className="font-semibold w-[10%] text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={filteredRecordings.map((r) => r.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredRecordings.map((recording, index) => (
                      <SortableRecordingRow
                        key={recording.id}
                        recording={recording}
                        index={index}
                        isExpanded={expandedRecordings.has(recording.id)}
                        onToggle={() => toggleRecordingExpansion(recording.id)}
                        onEdit={handleEdit}
                        onPreview={(rec) => {
                          setPreviewRecording(rec);
                          setPreviewDialogOpen(true);
                        }}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          )}
        </CardContent>
      </Card>

      <VideoPreviewDialog
        open={previewDialogOpen}
        onOpenChange={setPreviewDialogOpen}
        recordingTitle={previewRecording?.recording_title || ''}
        recordingUrl={previewRecording?.recording_url || ''}
      />
    </div>
  );
}
