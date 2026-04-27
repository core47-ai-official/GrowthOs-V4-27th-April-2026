import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Edit, Trash2, BookOpen, GripVertical, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
  course_id: string | null;
}

interface Recording {
  id: string;
  recording_title: string;
  module: string;
  sequence_order?: number;
}

interface Course {
  id: string;
  title: string;
}

// Sortable Module Row Component
function SortableModuleRow({ module, index, onEdit, onDelete, courses, readOnly }: {
  module: Module;
  index: number;
  onEdit: (module: Module) => void;
  onDelete: (id: string) => void;
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
  } = useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const courseName = courses.find(c => c.id === module.course_id)?.title || 'Global';

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
        <Badge variant={module.course_id ? "default" : "outline"}>
          {courseName}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{module.order}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
          {module.recording_count} recordings
        </Badge>
      </TableCell>
      {!readOnly && <TableCell>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(module)}
            className="hover-scale hover:bg-blue-50 hover:border-blue-300"
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDelete(module.id)}
            className="hover-scale hover:bg-red-50 hover:border-red-300 hover:text-red-600"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>}
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

export function ModulesManagement({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [modules, setModules] = useState<Module[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters (match Recordings page behavior)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    order: 0,
    selectedRecordings: [] as string[],
    course_id: '' as string
  });
  const { toast } = useToast();

  const filteredModules = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return modules.filter((m) => {
      const matchesSearch = !q || (m.title || '').toLowerCase().includes(q);
      const matchesCourse = filterCourseId === 'all' || (m.course_id || '') === filterCourseId;
      return matchesSearch && matchesCourse;
    });
  }, [modules, searchQuery, filterCourseId]);

  // Group modules by course for display
  const groupedModules = useMemo(() => {
    if (filterCourseId !== 'all') return null;
    
    const groups = new Map<string, { courseTitle: string; modules: Module[] }>();
    
    for (const mod of filteredModules) {
      const courseId = mod.course_id || '__none__';
      const courseTitle = courses.find(c => c.id === courseId)?.title || 'No Course (Global)';
      
      if (!groups.has(courseId)) {
        groups.set(courseId, { courseTitle, modules: [] });
      }
      groups.get(courseId)!.modules.push(mod);
    }
    
    const sorted = Array.from(groups.entries()).sort(([aId, a], [bId, b]) => {
      if (aId === '__none__') return 1;
      if (bId === '__none__') return -1;
      return a.courseTitle.localeCompare(b.courseTitle);
    });
    
    return sorted;
  }, [filteredModules, filterCourseId, courses]);

  useEffect(() => {
    fetchModules();
    fetchRecordings();
    fetchCourses();
  }, []);

  const fetchModules = async () => {
    try {
      safeLogger.info('Fetching modules...');
      const { data, error } = await supabase
        .from('modules')
        .select(`
          *,
          available_lessons(count)
        `)
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

  const fetchCourses = async () => {
    try {
      const { data, error } = await supabase
        .from('courses')
        .select('id, title')
        .eq('is_active', true)
        .order('title');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      safeLogger.error('Error fetching courses:', error);
    }
  };

  const fetchRecordings = async () => {
    try {
      const { data, error } = await supabase
        .from('available_lessons')
        .select('id, recording_title, module')
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
        // Update existing module
        const { error: updateError } = await supabase
          .from('modules')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim(),
            order: formData.order,
            course_id: formData.course_id || null
          })
          .eq('id', editingModule.id);

        if (updateError) throw updateError;

        // Update recordings assignment
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
        // Create new module
        const result = await safeQuery<ModuleResult>(
          supabase
            .from('modules')
            .insert({
              title: formData.title.trim(),
              description: formData.description.trim(),
              order: formData.order,
              course_id: formData.course_id || null
            })
            .select()
            .single(),
          'create new module'
        );

        if (!result.success) throw result.error;
        const newModule = result.data;

        

        // Assign selected recordings to new module
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

      // Reset form and close dialog
      setDialogOpen(false);
      setEditingModule(null);
      setFormData({ title: '', description: '', order: 0, selectedRecordings: [], course_id: '' });
      
      // Refresh data
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
    
    // Get currently assigned recordings for this module
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
        selectedRecordings: assignedRecordings?.map(r => r.id) || [],
        course_id: module.course_id || ''
      });
    } catch (error) {
      safeLogger.error('Error fetching assigned recordings:', error);
      setFormData({
        title: module.title,
        description: module.description || '',
        order: module.order || 0,
        selectedRecordings: [],
        course_id: module.course_id || ''
      });
    }
    
    setDialogOpen(true);
  };

  const handleDelete = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module? This action cannot be undone and will unassign all recordings from this module.')) {
      return;
    }

    try {
      safeLogger.info('Starting module deletion for ID:', { moduleId });
      
      // First, unassign all recordings from this module
      safeLogger.info('Unassigning recordings from module...');
      const { error: unassignError } = await supabase
        .from('available_lessons')
        .update({ module: null })
        .eq('module', moduleId);

      if (unassignError) {
        safeLogger.error('Error unassigning recordings:', unassignError);
        throw unassignError;
      }
      safeLogger.info('Successfully unassigned recordings');

      // Then delete the module
      safeLogger.info('Deleting module...');
      const { error: deleteError } = await supabase
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (deleteError) {
        safeLogger.error('Error deleting module:', deleteError);
        throw deleteError;
      }
      safeLogger.info('Successfully deleted module');

      toast({
        title: "Success",
        description: "Module deleted successfully"
      });
      
      // Refresh data immediately and force UI update
      safeLogger.info('Refreshing data after deletion...');
      setModules(prevModules => prevModules.filter(module => module.id !== moduleId));
      await Promise.all([fetchModules(), fetchRecordings()]);
      
    } catch (error) {
      safeLogger.error('Error deleting module:', error);
      toast({
        title: "Error",
        description: "Failed to delete module. Please try again.",
        variant: "destructive"
      });
    }
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
    setFormData({ title: '', description: '', order: 0, selectedRecordings: [], course_id: '' });
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
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Modules Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">Manage course modules and their recordings</p>
        </div>
        
        {!readOnly && <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={resetForm}
              className="hover-scale bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Module
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold">
                {editingModule ? 'Edit Module' : 'Add New Module'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Row 1 - Title */}
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

                {/* Row 1 - Order */}
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

                {/* Row 2 - Assign Recordings */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Assign Recordings</label>
                  <Select onValueChange={handleRecordingSelect}>
                    <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                      <SelectValue placeholder="Select recordings to assign" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
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
                  
                  <div className="mt-3 flex flex-wrap gap-2 min-h-[100px] p-2 border border-dashed border-border rounded-md">
                    {formData.selectedRecordings.length > 0 ? (
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
                    ) : (
                      <p className="text-sm text-muted-foreground">No recordings selected</p>
                    )}
                  </div>
                </div>

                {/* Row 2 - Course */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Course</label>
                  <Select 
                    value={formData.course_id || "global"} 
                    onValueChange={(value) => setFormData({ ...formData, course_id: value === "global" ? "" : value })}
                  >
                    <SelectTrigger className="transition-all duration-200 focus:scale-[1.02]">
                      <SelectValue placeholder="Select a course (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="global">No Course (Global)</SelectItem>
                      {courses.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Assign this module to a specific course, or leave empty for global access
                  </p>
                </div>
              </div>

              {/* Description - Full Width at Bottom */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter module description"
                  className="transition-all duration-200 focus:scale-[1.02] min-h-[100px]"
                />
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
        </Dialog>}
      </div>

      <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50 animate-fade-in">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
          <div className="space-y-4">
            <CardTitle className="flex items-center text-xl">
              <BookOpen className="w-6 h-6 mr-3 text-blue-600" />
              All Modules
              <span className="ml-3 text-sm text-muted-foreground font-normal">Drag to reorder</span>
            </CardTitle>

            {/* Filters */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="flex-1">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title..."
                />
              </div>
              <Select value={filterCourseId} onValueChange={setFilterCourseId}>
                <SelectTrigger className="w-full md:w-[220px]">
                  <SelectValue placeholder="All Courses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Courses</SelectItem>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredModules.length === 0 ? (
            <div className="text-center py-16 animate-fade-in">
              <BookOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-muted-foreground mb-2">No modules found</h3>
              <p className="text-muted-foreground">Create your first module to get started</p>
            </div>
          ) : groupedModules ? (
            /* Grouped by course view */
            <div>
              {groupedModules.map(([courseId, group]) => (
                <Collapsible key={courseId} defaultOpen>
                  <CollapsibleTrigger className="flex items-center gap-3 w-full p-4 bg-muted/50 border-b hover:bg-muted/70 transition-colors">
                    <ChevronDown className="w-4 h-4 transition-transform [&[data-state=open]]:rotate-180" />
                    <span className="font-semibold text-base">{group.courseTitle}</span>
                    <Badge variant="secondary" className="ml-auto">{group.modules.length} modules</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleModuleDragEnd}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/30">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="font-semibold">Title</TableHead>
                            <TableHead className="font-semibold">Description</TableHead>
                            <TableHead className="font-semibold">Order</TableHead>
                            <TableHead className="font-semibold">Recordings</TableHead>
                            {!readOnly && <TableHead className="font-semibold">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <SortableContext
                            items={group.modules.map(m => m.id)}
                            strategy={verticalListSortingStrategy}
                          >
                            {group.modules.map((module, index) => (
                              <SortableModuleRow
                                key={module.id}
                                module={module}
                                index={index}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                courses={courses}
                                readOnly={readOnly}
                              />
                            ))}
                          </SortableContext>
                        </TableBody>
                      </Table>
                    </DndContext>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            /* Flat list when specific course is filtered */
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleModuleDragEnd}
            >
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead className="font-semibold">Title</TableHead>
                    <TableHead className="font-semibold">Description</TableHead>
                    <TableHead className="font-semibold">Order</TableHead>
                    <TableHead className="font-semibold">Recordings</TableHead>
                    {!readOnly && <TableHead className="font-semibold">Actions</TableHead>}
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
                        onDelete={handleDelete}
                        courses={courses}
                        readOnly={readOnly}
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
