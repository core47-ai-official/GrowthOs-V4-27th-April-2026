import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, Users, Calendar, Clock, AlertTriangle, BookOpen, Route, UserPlus, X, MessageCircle } from 'lucide-react';
import { BatchStudentAssignment } from './BatchStudentAssignment';
import { useBatches, type Batch, type BatchFormData } from '@/hooks/useBatches';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Course {
  id: string;
  title: string;
}

interface Pathway {
  id: string;
  name: string;
}

interface BatchAssociations {
  pathways: string[];
  courses: string[];
}

export function BatchManagement() {
  const { batches, loading, createBatch, updateBatch, deleteBatch, canEditStartDate, fetchBatches } = useBatches();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [studentAssignmentBatch, setStudentAssignmentBatch] = useState<Batch | null>(null);
  const [selectedPathways, setSelectedPathways] = useState<string[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [batchAssociations, setBatchAssociations] = useState<Record<string, BatchAssociations>>({});
  const [formData, setFormData] = useState<BatchFormData>({
    name: '',
    course_id: '',
    pathway_id: '',
    start_date: '',
    timezone: 'Asia/Karachi',
    default_session_time: '20:00',
    status: 'draft',
    whatsapp_group_link: '',
    facebook_community_link: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCourses();
    fetchPathways();
  }, []);

  useEffect(() => {
    if (batches.length > 0) {
      fetchAllBatchAssociations();
    }
  }, [batches]);

  const fetchCourses = async () => {
    const { data, error } = await supabase
      .from('courses')
      .select('id, title')
      .order('title');
    
    if (!error && data) {
      setCourses(data);
    }
  };

  const fetchPathways = async () => {
    const { data, error } = await supabase
      .from('learning_pathways')
      .select('id, name')
      .eq('is_active', true)
      .order('name');
    
    if (!error && data) {
      setPathways(data);
    }
  };

  const fetchAllBatchAssociations = async () => {
    const batchIds = batches.map(b => b.id);
    
    const [pathwaysResult, coursesResult] = await Promise.all([
      supabase.from('batch_pathways').select('batch_id, pathway_id').in('batch_id', batchIds),
      supabase.from('batch_courses').select('batch_id, course_id').in('batch_id', batchIds)
    ]);

    const associations: Record<string, BatchAssociations> = {};
    
    batchIds.forEach(id => {
      associations[id] = { pathways: [], courses: [] };
    });

    if (pathwaysResult.data) {
      pathwaysResult.data.forEach(row => {
        if (associations[row.batch_id]) {
          associations[row.batch_id].pathways.push(row.pathway_id);
        }
      });
    }

    if (coursesResult.data) {
      coursesResult.data.forEach(row => {
        if (associations[row.batch_id]) {
          associations[row.batch_id].courses.push(row.course_id);
        }
      });
    }

    setBatchAssociations(associations);
  };

  const fetchBatchAssociations = async (batchId: string) => {
    const [pathwaysResult, coursesResult] = await Promise.all([
      supabase.from('batch_pathways').select('pathway_id').eq('batch_id', batchId),
      supabase.from('batch_courses').select('course_id').eq('batch_id', batchId)
    ]);

    setSelectedPathways(pathwaysResult.data?.map(r => r.pathway_id) || []);
    setSelectedCourses(coursesResult.data?.map(r => r.course_id) || []);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      course_id: '',
      pathway_id: '',
      start_date: '',
      timezone: 'Asia/Karachi',
      default_session_time: '20:00',
      status: 'draft',
      whatsapp_group_link: '',
      facebook_community_link: ''
    });
    setSelectedPathways([]);
    setSelectedCourses([]);
    setEditingBatch(null);
  };

  const handleOpenDialog = async (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      setFormData({
        name: batch.name,
        course_id: batch.course_id || '',
        pathway_id: batch.pathway_id || '',
        start_date: batch.start_date,
        timezone: batch.timezone,
        default_session_time: batch.default_session_time,
        status: batch.status,
        whatsapp_group_link: (batch as any).whatsapp_group_link || '',
        facebook_community_link: (batch as any).facebook_community_link || ''
      });
      await fetchBatchAssociations(batch.id);
    } else {
      resetForm();
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    resetForm();
  };

  const togglePathway = (pathwayId: string) => {
    setSelectedPathways(prev => 
      prev.includes(pathwayId) 
        ? prev.filter(id => id !== pathwayId)
        : [...prev, pathwayId]
    );
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedPathways.length === 0 && selectedCourses.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select at least one pathway or course.",
        variant: "destructive"
      });
      return;
    }
    
    // Use the first pathway or course for legacy columns
    const submissionData = {
      ...formData,
      course_id: selectedCourses.length > 0 ? selectedCourses[0] : null,
      pathway_id: selectedPathways.length > 0 ? selectedPathways[0] : null
    };
    
    try {
      let batchId: string;
      
      if (editingBatch) {
        if (!canEditStartDate(editingBatch) && formData.start_date !== editingBatch.start_date) {
          toast({
            title: "Cannot Update",
            description: "Batch start date cannot be changed after it has started.",
            variant: "destructive"
          });
          return;
        }
        await updateBatch(editingBatch.id, submissionData);
        batchId = editingBatch.id;
      } else {
        const result = await createBatch(submissionData);
        batchId = result.id;
      }

      // Update junction tables
      await supabase.from('batch_pathways').delete().eq('batch_id', batchId);
      await supabase.from('batch_courses').delete().eq('batch_id', batchId);

      if (selectedPathways.length > 0) {
        await supabase.from('batch_pathways').insert(
          selectedPathways.map(pathway_id => ({ batch_id: batchId, pathway_id }))
        );
      }

      if (selectedCourses.length > 0) {
        await supabase.from('batch_courses').insert(
          selectedCourses.map(course_id => ({ batch_id: batchId, course_id }))
        );
      }

      await fetchBatches();
      await fetchAllBatchAssociations();
      handleCloseDialog();
    } catch (error) {
      // Error already handled in hook
    }
  };

  const handleDelete = async (batchId: string) => {
    if (!confirm('Are you sure you want to delete this batch? This will also remove all timeline items and unassign students.')) return;
    await deleteBatch(batchId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Active</Badge>;
      case 'completed':
        return <Badge variant="secondary">Completed</Badge>;
      case 'draft':
      default:
        return <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">Draft</Badge>;
    }
  };

  const getAssociationDisplay = (batchId: string) => {
    const assoc = batchAssociations[batchId];
    if (!assoc) return '-';

    const items: JSX.Element[] = [];

    assoc.pathways.forEach(pId => {
      const pathway = pathways.find(p => p.id === pId);
      if (pathway) {
        items.push(
          <Badge key={`p-${pId}`} variant="outline" className="mr-1 mb-1 text-xs">
            <Route className="w-3 h-3 mr-1" />
            {pathway.name}
          </Badge>
        );
      }
    });

    assoc.courses.forEach(cId => {
      const course = courses.find(c => c.id === cId);
      if (course) {
        items.push(
          <Badge key={`c-${cId}`} variant="secondary" className="mr-1 mb-1 text-xs">
            <BookOpen className="w-3 h-3 mr-1" />
            {course.title}
          </Badge>
        );
      }
    });

    return items.length > 0 ? <div className="flex flex-wrap max-w-xs">{items}</div> : '-';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading batches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-orange-600 bg-clip-text text-transparent">
            Batch Management
          </h2>
          <p className="text-muted-foreground mt-1 text-lg">
            Create and manage course batches with scheduled content deployment
          </p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="hover-scale bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
              <Plus className="w-4 h-4 mr-2" />
              Create Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <DialogHeader>
              <DialogTitle>{editingBatch ? 'Edit Batch' : 'Create New Batch'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Batch Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Batch 12 - January 2026"
                  required
                />
              </div>

              {/* Pathways Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Route className="w-4 h-4 inline mr-1" />
                  Pathways
                </label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {pathways.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No pathways available</p>
                  ) : (
                    pathways.map((pathway) => (
                      <div key={pathway.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`pathway-${pathway.id}`}
                          checked={selectedPathways.includes(pathway.id)}
                          onCheckedChange={() => togglePathway(pathway.id)}
                        />
                        <Label 
                          htmlFor={`pathway-${pathway.id}`} 
                          className="text-sm cursor-pointer flex-1"
                        >
                          {pathway.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {selectedPathways.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedPathways.map(id => {
                      const pathway = pathways.find(p => p.id === id);
                      return pathway ? (
                        <Badge key={id} variant="outline" className="text-xs">
                          {pathway.name}
                          <button 
                            type="button" 
                            onClick={() => togglePathway(id)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              {/* Courses Selection */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  <BookOpen className="w-4 h-4 inline mr-1" />
                  Individual Courses
                </label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {courses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No courses available</p>
                  ) : (
                    courses.map((course) => (
                      <div key={course.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`course-${course.id}`}
                          checked={selectedCourses.includes(course.id)}
                          onCheckedChange={() => toggleCourse(course.id)}
                        />
                        <Label 
                          htmlFor={`course-${course.id}`} 
                          className="text-sm cursor-pointer flex-1"
                        >
                          {course.title}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {selectedCourses.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedCourses.map(id => {
                      const course = courses.find(c => c.id === id);
                      return course ? (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {course.title}
                          <button 
                            type="button" 
                            onClick={() => toggleCourse(id)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                * Select at least one pathway or course for this batch
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Start Date *
                    {editingBatch && !canEditStartDate(editingBatch) && (
                      <span className="text-destructive text-xs ml-2">(locked)</span>
                    )}
                  </label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    disabled={editingBatch !== null && !canEditStartDate(editingBatch)}
                  />
                  {editingBatch && !canEditStartDate(editingBatch) && (
                    <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Cannot change after batch has started
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Default Session Time</label>
                  <Input
                    type="time"
                    value={formData.default_session_time}
                    onChange={(e) => setFormData({ ...formData, default_session_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Timezone</label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="Asia/Karachi">Asia/Karachi (PKT)</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                      <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border z-50">
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Support Links */}
              <div className="border-t pt-4 mt-2">
                <label className="block text-sm font-medium mb-3">
                  <MessageCircle className="w-4 h-4 inline mr-1" />
                  Support Links (optional)
                </label>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="whatsapp_group_link" className="text-sm">WhatsApp Group Link</Label>
                    <Input
                      id="whatsapp_group_link"
                      value={formData.whatsapp_group_link || ''}
                      onChange={(e) => setFormData({ ...formData, whatsapp_group_link: e.target.value })}
                      placeholder="https://chat.whatsapp.com/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="facebook_community_link" className="text-sm">Facebook Community Link</Label>
                    <Input
                      id="facebook_community_link"
                      value={formData.facebook_community_link || ''}
                      onChange={(e) => setFormData({ ...formData, facebook_community_link: e.target.value })}
                      placeholder="https://facebook.com/groups/..."
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingBatch ? 'Update Batch' : 'Create Batch'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Batches</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Batches Yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first batch to start scheduling content deployment
              </p>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Create Batch
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Pathways / Courses</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell>
                      {getAssociationDisplay(batch.id)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {format(new Date(batch.start_date), 'MMM dd, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        {batch._count?.enrollments || 0}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(batch.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setStudentAssignmentBatch(batch)}
                          title="Manage Students"
                        >
                          <UserPlus className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(batch)}
                          title="Edit Batch"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(batch.id)}
                          title="Delete Batch"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Student Assignment Dialog */}
      {studentAssignmentBatch && (
        <BatchStudentAssignment
          batchId={studentAssignmentBatch.id}
          batchName={studentAssignmentBatch.name}
          courseId={studentAssignmentBatch.course_id}
          pathwayId={studentAssignmentBatch.pathway_id}
          open={!!studentAssignmentBatch}
          onOpenChange={(open) => {
            if (!open) {
              setStudentAssignmentBatch(null);
              fetchBatches();
            }
          }}
          onUpdate={() => fetchBatches()}
        />
      )}
    </div>
  );
}
