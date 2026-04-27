import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, BookOpen, GripVertical, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { safeQuery } from '@/lib/database-safety';
import type { ModuleResult } from '@/types/database';
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

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  recording_count: number;
}

interface Recording {
  id: string;
  recording_title: string;
  module: string;
  sequence_order?: number;
}

// Sortable Module Row Component
function SortableModuleRow({ module, index, onEdit }: {
  module: Module;
  index: number;
  onEdit: (module: Module) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow 
      ref={setNodeRef}
      style={style}
      className="hover:bg-gray-50 transition-colors animate-fade-in"
    >
      <TableCell>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{module.title}</TableCell>
      <TableCell className="max-w-xs">
        <div className="truncate" title={module.description}>
          {module.description || 'No description'}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{module.order}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {module.recording_count} recordings
        </Badge>
      </TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(module)}
          className="hover-scale hover:bg-blue-50 hover:border-blue-300"
        >
          <Edit className="w-4 h-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

// Sortable Recording Item Component for Dialog
function SortableRecordingBadge({ recording, onRemove }: {
  recording: Recording;
  onRemove: (id: string) => void;
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
    <div
      ref={setNodeRef}
      style={style}
      className="inline-block"
    >
      <Badge
        variant="secondary"
        className="animate-scale-in flex items-center gap-2"
      >
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing hover:text-primary transition-colors"
        >
          <GripVertical className="w-3 h-3" />
        </div>
        {recording.recording_title}
        <button
          type="button"
          onClick={() => onRemove(recording.id)}
          className="ml-1 text-xs hover:text-red-500 transition-colors"
        >
          ×
        </button>
      </Badge>
    </div>
  );
}

interface Course {
  id: string;
  title: string;
}

export function MentorModulesManagement() {
  const [modules, setModules] = useState<Module[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [assignedCourses, setAssignedCourses] = useState<Course[]>([]);
  const [assignedCourseIds, setAssignedCourseIds] = useState<string[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    order: 0,
    selectedRecordings: [] as string[]
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
      fetchModules();
      fetchRecordings();
    } else if (assignedCourseIds.length === 0 && !loading) {
      setModules([]);
      setRecordings([]);
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
      
      safeLogger.info('Assigned courses fetched:', { courseIds: assignedCourseIds });
    } catch (error) {
      safeLogger.error('Error fetching assigned courses:', error);
      setLoading(false);
    }
  };

  const fetchModules = async () => {
    const filterCourseIds = selectedCourseId === 'all' 
      ? assignedCourseIds 
      : [selectedCourseId];

    if (filterCourseIds.length === 0) {
      setModules([]);
      setLoading(false);
      return;
    }

    try {
      safeLogger.info('Fetching modules (mentor view) for assigned courses...');
      const { data, error } = await supabase
        .from('modules')
        .select(`
          *,
          available_lessons(count)
        `)
        .in('course_id', filterCourseIds)
        .order('order');

      if (error) {
        safeLogger.error('Error fetching modules:', error);
        throw error;
      }

      safeLogger.info('Modules fetched:', { data });

      const modulesWithCount = data?.map(module => ({
        ...module,
        recording_count: module.available_lessons?.[0]?.count || 0
      })) || [];

      setModules(modulesWithCount);
    } catch (error) {
      safeLogger.error('Error fetching modules:', error);
      toast({
        title: "Error",
        description: "Failed to fetch modules",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecordings = async () => {
    const filterCourseIds = selectedCourseId === 'all' 
      ? assignedCourseIds 
      : [selectedCourseId];

    if (filterCourseIds.length === 0) {
      setRecordings([]);
      return;
    }

    try {
      // First get module IDs for selected courses
      const { data: moduleData, error: moduleError } = await supabase
        .from('modules')
        .select('id')
        .in('course_id', filterCourseIds);

      if (moduleError) throw moduleError;
      
      const moduleIds = moduleData?.map(m => m.id) || [];
      
      if (moduleIds.length === 0) {
        setRecordings([]);
        return;
      }

      const { data, error } = await supabase
        .from('available_lessons')
        .select('id, recording_title, module')
        .in('module', moduleIds)
        .order('sequence_order');

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      safeLogger.error('Error fetching recordings:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Module title is required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingModule) {
        const { error: updateError } = await supabase
          .from('modules')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim(),
            order: formData.order
          })
          .eq('id', editingModule.id);

        if (updateError) throw updateError;

        if (formData.selectedRecordings.length > 0) {
          const { error: recordingError } = await supabase
            .from('available_lessons')
            .update({ module: editingModule.id })
            .in('id', formData.selectedRecordings);

          if (recordingError) throw recordingError;
        }

        toast({
          title: "Success",
          description: "Module updated successfully"
        });
      } else {
        const result = await safeQuery<ModuleResult>(
          supabase
            .from('modules')
            .insert({
              title: formData.title.trim(),
              description: formData.description.trim(),
              order: formData.order
            })
            .select()
            .single(),
          'create new module'
        );

        if (!result.success) throw result.error;
        const newModule = result.data;

        if (formData.selectedRecordings.length > 0 && newModule) {
          const { error: recordingError } = await supabase
            .from('available_lessons')
            .update({ module: newModule.id })
            .in('id', formData.selectedRecordings);

          if (recordingError) throw recordingError;
        }

        toast({
          title: "Success",
          description: "Module created successfully"
        });
      }

      setDialogOpen(false);
      setEditingModule(null);
      setFormData({ title: '', description: '', order: 0, selectedRecordings: [] });
      
      await fetchModules();
      await fetchRecordings();
    } catch (error) {
      safeLogger.error('Error saving module:', error);
      toast({
        title: "Error",
        description: "Failed to save module. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleEdit = async (module: Module) => {
    setEditingModule(module);
    
    try {
      const { data: assignedRecordings, error } = await supabase
        .from('available_lessons')
        .select('id')
        .eq('module', module.id);

      if (error) throw error;

      setFormData({
        title: module.title,
        description: module.description || '',
        order: module.order || 0,
        selectedRecordings: assignedRecordings?.map(r => r.id) || []
      });
    } catch (error) {
      safeLogger.error('Error fetching assigned recordings:', error);
      setFormData({
        title: module.title,
        description: module.description || '',
        order: module.order || 0,
        selectedRecordings: []
      });
    }
    
    setDialogOpen(true);
  };

  const handleRecordingSelect = (recordingId: string) => {
    if (!formData.selectedRecordings.includes(recordingId)) {
      setFormData({
        ...formData,
        selectedRecordings: [...formData.selectedRecordings, recordingId]
      });
    }
  };

  const handleRecordingRemove = (recordingId: string) => {
    setFormData({
      ...formData,
      selectedRecordings: formData.selectedRecordings.filter(id => id !== recordingId)
    });
  };

  const resetForm = () => {
    setEditingModule(null);
    setFormData({ title: '', description: '', order: 0, selectedRecordings: [] });
  };

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle module reordering
  const handleModuleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = modules.findIndex((m) => m.id === active.id);
    const newIndex = modules.findIndex((m) => m.id === over.id);

    const newModules = arrayMove(modules, oldIndex, newIndex);
    
    // Update order numbers sequentially
    const updatedModules = newModules.map((module, index) => ({
      ...module,
      order: index + 1
    }));
    
    // Update UI immediately
    setModules(updatedModules);

    // Update order in database
    try {
      const updates = newModules.map((module, index) => ({
        id: module.id,
        order: index + 1
      }));

      for (const update of updates) {
        await supabase
          .from('modules')
          .update({ order: update.order })
          .eq('id', update.id);
      }

      toast({
        title: "Success",
        description: "Module order updated"
      });
    } catch (error) {
      safeLogger.error('Error updating module order:', error);
      toast({
        title: "Error",
        description: "Failed to update module order",
        variant: "destructive"
      });
      // Revert on error
      fetchModules();
    }
  };

  // Filter modules by search query
  const filteredModules = modules.filter(module =>
    module.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle recording reordering in dialog
  const handleRecordingDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = formData.selectedRecordings.findIndex((id) => id === active.id);
    const newIndex = formData.selectedRecordings.findIndex((id) => id === over.id);

    setFormData({
      ...formData,
      selectedRecordings: arrayMove(formData.selectedRecordings, oldIndex, newIndex)
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading modules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Modules Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">View and edit course modules</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules..."
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingModule ? 'Edit Module' : 'Add New Module'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title *</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter module title"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter module description"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Order *</label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                  placeholder="Enter display order"
                  className="transition-all duration-200 focus:scale-[1.02]"
                  min="0"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Assign Recordings</label>
                <Select onValueChange={handleRecordingSelect}>
                  <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                    <SelectValue placeholder="Select recordings to assign" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    {recordings.map((recording) => {
                      const isCurrentlyAssigned = recording.module && recording.module !== editingModule?.id;
                      const isSelected = formData.selectedRecordings.includes(recording.id);
                      
                      return (
                        <SelectItem 
                          key={recording.id} 
                          value={recording.id}
                          disabled={isSelected}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={isSelected ? 'opacity-50' : ''}>
                              {recording.recording_title}
                            </span>
                            {isCurrentlyAssigned && (
                              <Badge variant="secondary" className="ml-2 text-xs">
                                Assigned
                              </Badge>
                            )}
                            {isSelected && (
                              <Badge variant="outline" className="ml-2 text-xs">
                                Selected
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                
                <div className="mt-3 flex flex-wrap gap-2">
                  {formData.selectedRecordings.length > 0 && (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleRecordingDragEnd}
                    >
                      <SortableContext
                        items={formData.selectedRecordings}
                        strategy={verticalListSortingStrategy}
                      >
                        {formData.selectedRecordings.map((recordingId) => {
                          const recording = recordings.find(r => r.id === recordingId);
                          if (!recording) return null;
                          return (
                            <SortableRecordingBadge
                              key={recordingId}
                              recording={recording}
                              onRemove={handleRecordingRemove}
                            />
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  )}
                </div>
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
                  {editingModule ? 'Update' : 'Create'} Module
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <BookOpen className="w-6 h-6 mr-3 text-blue-600" />
            All Modules
            <span className="ml-3 text-sm text-muted-foreground font-normal">Drag to reorder</span>
            {searchQuery && (
              <span className="ml-2 text-sm text-muted-foreground font-normal">
                ({filteredModules.length} of {modules.length} shown)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filteredModules.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                {searchQuery ? 'No modules match your search' : 'No modules found'}
              </h3>
              <p className="text-muted-foreground">
                {searchQuery ? 'Try a different search term' : 'Create your first module to get started'}
              </p>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleModuleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold">Order</TableHead>
                    <TableHead className="font-semibold">Recordings</TableHead>
                    <TableHead className="font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <SortableContext
                    items={filteredModules.map(m => m.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {filteredModules.map((module, index) => (
                      <SortableModuleRow
                        key={module.id}
                        module={module}
                        index={index}
                        onEdit={handleEdit}
                      />
                    ))}
                  </SortableContext>
                </TableBody>
              </Table>
            </DndContext>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
