import { useMemo, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, FileText, MessageSquare, Play, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
interface Assignment {
  id: string;
  name: string;
  description: string;
  mentor_id?: string;
  created_at: string;
  due_days?: number;
  recording_id?: string;
  submission_type?: 'text' | 'file' | 'link';
  instructions?: string;
  mentor?: {
    full_name: string;
  } | null;
  recording?: {
    recording_title: string;
  } | null;
}
interface Mentor {
  id: string;
  full_name: string;
  email: string;
}
interface Recording {
  id: string;
  recording_title: string;
  sequence_order?: number;
  assignment_id?: string | null;
}

interface Course {
  id: string;
  title: string;
}
export function AssignmentManagement({ readOnly = false }: { readOnly?: boolean } = {}) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  // Filters (match Recordings page pattern)
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    mentor_id: '',
    due_days: 7,
    submission_type: 'text' as 'text' | 'file' | 'link',
  });
  useEffect(() => {
    fetchData();
  }, []);
  const fetchData = async () => {
    try {
      // Fetch assignments
      const {
        data: assignmentsData,
        error: assignmentsError
      } = await supabase.from('assignments').select('*').order('created_at', {
        ascending: false
      });
      if (assignmentsError) throw assignmentsError;

      // Fetch courses for filter dropdown
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('id, title')
        .order('sequence_order');
      if (coursesError) throw coursesError;

      // Fetch mentors
      const {
        data: mentorsData,
        error: mentorsError
      } = await supabase.from('users').select('id, full_name, email').eq('role', 'mentor').order('full_name');
      if (mentorsError) throw mentorsError;

      // Fetch recordings
      const {
        data: recordingsData,
        error: recordingsError
      } = await supabase.from('available_lessons').select('id, recording_title, sequence_order, assignment_id').order('sequence_order');
      if (recordingsError) throw recordingsError;
      setAssignments((assignmentsData || []).map(assignment => ({
        ...assignment,
        submission_type: assignment.submission_type as 'text' | 'file' | 'link' || 'text',
        mentor: null,
        recording: null
      })));
      setMentors(mentorsData || []);
      setRecordings(recordingsData || []);
      setCourses(coursesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assignments data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assignments.filter((a) => {
      const matchesSearch = !q || (a.name || '').toLowerCase().includes(q);
      const matchesCourse =
        filterCourseId === 'all' || ((a as any).course_id || '') === filterCourseId;
      return matchesSearch && matchesCourse;
    });
  }, [assignments, searchQuery, filterCourseId]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast({
        title: 'Error',
        description: 'Assignment name is required',
        variant: 'destructive'
      });
      return;
    }
    try {
      const assignmentData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        mentor_id: formData.mentor_id || null,
        due_days: formData.due_days,
        submission_type: formData.submission_type
      };
      if (editingAssignment) {
        // Update existing assignment
        const {
          error
        } = await supabase.from('assignments').update(assignmentData).eq('id', editingAssignment.id);
        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Assignment updated successfully'
        });
      } else {
        // Create new assignment
        const {
          error
        } = await supabase.from('assignments').insert(assignmentData);
        if (error) throw error;
        toast({
          title: 'Success',
          description: 'Assignment created successfully'
        });
      }
      setIsDialogOpen(false);
      setEditingAssignment(null);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to save assignment',
        variant: 'destructive'
      });
    }
  };
  const handleEdit = (assignment: Assignment) => {
    setEditingAssignment(assignment);
    setFormData({
      name: assignment.name,
      description: assignment.description || '',
      mentor_id: assignment.mentor_id || '',
      due_days: assignment.due_days || 7,
      submission_type: assignment.submission_type || 'text'
    });
    setIsDialogOpen(true);
  };
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this assignment? This action cannot be undone.')) {
      return;
    }
    try {
      const {
        error
      } = await supabase.from('assignments').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Assignment deleted successfully'
      });
      fetchData();
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete assignment',
        variant: 'destructive'
      });
    }
  };
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      mentor_id: '',
      due_days: 7,
      submission_type: 'text'
    });
  };
  const openCreateDialog = () => {
    setEditingAssignment(null);
    resetForm();
    setIsDialogOpen(true);
  };
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading assignments...</div>;
  }
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold header-accent">Assignments Management</h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === 'mentor' ? 'View and edit assignments' : 'Manage assignment assignments and their assignments'}
          </p>
        </div>
        {!readOnly && <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-medium">
              <Plus className="w-4 h-4 mr-2" />
              Add Assignment
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-2xl font-bold flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <span>{editingAssignment ? 'Edit Assignment' : 'Create New Assignment'}</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 bg-muted/30 rounded-xl p-5">
                  <label className="block text-sm font-semibold mb-3 flex items-center space-x-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Assignment Name</span>
                  </label>
                  <Input value={formData.name} onChange={e => setFormData({
                  ...formData,
                  name: e.target.value
                })} placeholder="Enter assignment name..." required className="border-2 bg-background/50 focus:bg-background transition-colors" />
                </div>
            
                <div className="col-span-2 bg-muted/30 rounded-xl p-5">
                  <label className="block text-sm font-semibold mb-3 flex items-center space-x-2">
                    <MessageSquare className="w-4 h-4 text-primary" />
                    <span>Description</span>
                  </label>
                  <Textarea value={formData.description} onChange={e => setFormData({
                  ...formData,
                  description: e.target.value
                })} placeholder="Enter assignment description..." rows={3} className="border-2 bg-background/50 focus:bg-background transition-colors" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Due After (Days)</label>
                  <Input type="number" min="1" value={formData.due_days} onChange={e => setFormData({
                  ...formData,
                  due_days: parseInt(e.target.value) || 7
                })} placeholder="7" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Submission Type</label>
                  <Select value={formData.submission_type} onValueChange={(value: 'text' | 'file' | 'link') => setFormData({
                  ...formData,
                  submission_type: value
                })}>
                    <SelectTrigger className="justify-between text-left">
                      <SelectValue placeholder="Select submission type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text Response</SelectItem>
                      <SelectItem value="file">File Upload</SelectItem>
                      <SelectItem value="link">Link Submission</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Assigned Mentor (Optional)</label>
                  <Select value={formData.mentor_id} onValueChange={value => setFormData({
                  ...formData,
                  mentor_id: value
                })}>
                    <SelectTrigger className="justify-between text-left">
                      <SelectValue placeholder="Select a mentor..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No mentor assigned</SelectItem>
                      {mentors.map(mentor => <SelectItem key={mentor.id} value={mentor.id}>
                          {mentor.full_name} ({mentor.email})
                        </SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              <div className="flex gap-4 pt-6">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1 border-2">
                  Cancel
                </Button>
                <Button type="submit" className="flex-1 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-md hover:shadow-lg transition-all">
                  {editingAssignment ? 'Update' : 'Create'} Assignment
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      {/* All Assignments Section */}
      <div className="section-surface">
        <div className="p-6 section-header rounded-t-xl">
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="icon-chip">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">All Assignments</h2>
            </div>

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
        </div>
        
        <div className="overflow-x-auto">
          {filteredAssignments.length === 0 ? <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No assignments found</h3>
              <p className="text-gray-500">Create your first assignment to get started.</p>
            </div> : <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Title</TableHead>
                  <TableHead className="font-semibold">Linked With</TableHead>
                  <TableHead className="font-semibold">Due Days</TableHead>
                  <TableHead className="font-semibold">Type</TableHead>
                  {!readOnly && <TableHead className="font-semibold">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignments.map(assignment => {
                  // Check both directions: assignment.recording_id -> recording, or recording.assignment_id -> assignment
                  const linkedRecording = assignment.recording_id
                    ? recordings.find(r => r.id === assignment.recording_id)
                    : recordings.find(r => r.assignment_id === assignment.id) || null;
                  return (
                    <TableRow key={assignment.id} className="table-row-hover">
                      <TableCell className="font-medium bg-white">{assignment.name}</TableCell>
                      <TableCell className="bg-white">
                        {linkedRecording ? (
                          <Badge variant="secondary" className="font-normal">
                            <Play className="w-3 h-3 mr-1" />
                            {linkedRecording.recording_title}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm italic">None</span>
                        )}
                      </TableCell>
                      <TableCell className="bg-white">{assignment.due_days || 7} days</TableCell>
                      <TableCell className="bg-white">
                        <span className="capitalize">{assignment.submission_type || 'text'}</span>
                      </TableCell>
                      {!readOnly && <TableCell className="bg-white">
                        <div className="flex items-center space-x-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(assignment)} className="hover:bg-gray-50">
                            <Edit className="w-4 h-4" />
                          </Button>
                          {user?.role !== 'mentor' && (
                            <Button variant="outline" size="sm" onClick={() => handleDelete(assignment.id)} className="hover:bg-red-50 hover:text-red-600">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>}
        </div>
      </div>
    </div>;
}