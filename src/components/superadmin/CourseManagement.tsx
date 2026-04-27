import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ContentTimelineDialog } from './ContentTimelineDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoverImageUpload } from '@/components/ui/cover-image-upload';
import { Plus, Edit, Trash2, BookOpen, Eye, EyeOff, UserCheck, Users, Clock, GraduationCap, Layers, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface Mentor {
  id: string;
  full_name: string | null;
  email: string;
}

interface MentorAssignment {
  mentor_id: string;
  is_primary: boolean;
  mentor?: Mentor;
}

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number | null;
  currency: string | null;
  max_installments: number | null;
  access_duration_days: number | null;
  is_active: boolean;
  is_published: boolean;
  sequence_order: number | null;
  created_at: string | null;
  drip_enabled: boolean | null;
  module_count?: number;
  enrollment_count?: number;
  mentors?: MentorAssignment[];
}

export function CourseManagement({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mentorDialogOpen, setMentorDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedMentorId, setSelectedMentorId] = useState<string>('');
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [timelineCourse, setTimelineCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    thumbnail_url: '',
    price: 0,
    currency: 'PKR',
    max_installments: null as number | null,
    access_duration_days: null as number | null,
    is_active: true,
    is_published: false,
    sequence_order: 0,
    drip_enabled: null as boolean | null
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCourses();
    fetchMentors();
  }, []);

  const fetchMentors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('role', 'mentor');

      if (error) throw error;
      setMentors(data || []);
    } catch (error) {
      logger.error('Error fetching mentors:', error);
    }
  };

  const fetchCourses = async () => {
    try {
      setLoading(true);
      
      // Fetch courses with module and enrollment counts
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('sequence_order', { ascending: true });

      if (coursesError) throw coursesError;

      // Get module counts per course
      const { data: modulesData } = await supabase
        .from('modules')
        .select('course_id');

      // Get enrollment counts per course
      const { data: enrollmentsData } = await supabase
        .from('course_enrollments')
        .select('course_id');

      // Get mentor assignments per course
      const { data: mentorAssignmentsData } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, mentor_id, is_primary');

      const moduleCountMap = new Map<string, number>();
      const enrollmentCountMap = new Map<string, number>();
      const mentorAssignmentsMap = new Map<string, MentorAssignment[]>();

      modulesData?.forEach(m => {
        if (m.course_id) {
          moduleCountMap.set(m.course_id, (moduleCountMap.get(m.course_id) || 0) + 1);
        }
      });

      enrollmentsData?.forEach(e => {
        if (e.course_id) {
          enrollmentCountMap.set(e.course_id, (enrollmentCountMap.get(e.course_id) || 0) + 1);
        }
      });

      mentorAssignmentsData?.forEach(ma => {
        if (ma.course_id) {
          const existing = mentorAssignmentsMap.get(ma.course_id) || [];
          existing.push({ mentor_id: ma.mentor_id, is_primary: ma.is_primary || false });
          mentorAssignmentsMap.set(ma.course_id, existing);
        }
      });

      const coursesWithCounts = (coursesData || []).map(course => ({
        ...course,
        drip_enabled: (course as any).drip_enabled ?? null,
        max_installments: (course as any).max_installments ?? null,
        access_duration_days: (course as any).access_duration_days ?? null,
        module_count: moduleCountMap.get(course.id) || 0,
        enrollment_count: enrollmentCountMap.get(course.id) || 0,
        mentors: mentorAssignmentsMap.get(course.id) || []
      }));

      setCourses(coursesWithCounts);
    } catch (error) {
      logger.error('Error fetching courses:', error);
      toast({
        title: "Error",
        description: "Failed to fetch courses",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignMentor = async () => {
    if (!selectedCourse || !selectedMentorId) return;

    try {
      // Check if mentor is already assigned to this course
      const existingAssignment = selectedCourse.mentors?.find(m => m.mentor_id === selectedMentorId);
      if (existingAssignment) {
        toast({
          title: "Already Assigned",
          description: "This mentor is already assigned to this course",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase
        .from('mentor_course_assignments')
        .insert({
          course_id: selectedCourse.id,
          mentor_id: selectedMentorId,
          is_primary: (selectedCourse.mentors?.length || 0) === 0 // First mentor is primary
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mentor assigned to course successfully"
      });

      setMentorDialogOpen(false);
      setSelectedMentorId('');
      await fetchCourses();
    } catch (error) {
      logger.error('Error assigning mentor:', error);
      toast({
        title: "Error",
        description: "Failed to assign mentor",
        variant: "destructive"
      });
    }
  };

  const handleRemoveMentor = async (courseId: string, mentorId: string) => {
    if (!confirm('Remove this mentor from the course?')) return;

    try {
      const { error } = await supabase
        .from('mentor_course_assignments')
        .delete()
        .eq('course_id', courseId)
        .eq('mentor_id', mentorId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Mentor removed from course"
      });

      await fetchCourses();
    } catch (error) {
      logger.error('Error removing mentor:', error);
      toast({
        title: "Error",
        description: "Failed to remove mentor",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Course title is required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingCourse) {
        const { error } = await supabase
          .from('courses')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            price: formData.price,
            currency: formData.currency,
            max_installments: formData.max_installments,
            access_duration_days: formData.access_duration_days,
            is_active: formData.is_active,
            is_published: formData.is_published,
            sequence_order: formData.sequence_order,
            drip_enabled: formData.drip_enabled
          } as any)
          .eq('id', editingCourse.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Course updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('courses')
          .insert({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            price: formData.price,
            currency: formData.currency,
            max_installments: formData.max_installments,
            access_duration_days: formData.access_duration_days,
            is_active: formData.is_active,
            is_published: formData.is_published,
            sequence_order: formData.sequence_order,
            drip_enabled: formData.drip_enabled
          } as any);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Course created successfully"
        });
      }

      setDialogOpen(false);
      resetForm();
      await fetchCourses();
    } catch (error) {
      logger.error('Error saving course:', error);
      toast({
        title: "Error",
        description: "Failed to save course",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description || '',
      thumbnail_url: course.thumbnail_url || '',
      price: course.price || 0,
      currency: course.currency || 'PKR',
      max_installments: course.max_installments,
      access_duration_days: course.access_duration_days,
      is_active: course.is_active,
      is_published: course.is_published,
      sequence_order: course.sequence_order || 0,
      drip_enabled: course.drip_enabled
    });
    setDialogOpen(true);
  };

  const handleDelete = async (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (course?.enrollment_count && course.enrollment_count > 0) {
      toast({
        title: "Cannot Delete",
        description: "This course has enrolled students. Remove enrollments first.",
        variant: "destructive"
      });
      return;
    }

    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) {
      return;
    }

    try {
      // First, unassign all modules from this course
      await supabase
        .from('modules')
        .update({ course_id: null })
        .eq('course_id', courseId);

      // Then delete the course
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Course deleted successfully"
      });
      
      await fetchCourses();
    } catch (error) {
      logger.error('Error deleting course:', error);
      toast({
        title: "Error",
        description: "Failed to delete course",
        variant: "destructive"
      });
    }
  };

  const togglePublished = async (course: Course) => {
    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_published: !course.is_published })
        .eq('id', course.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Course ${!course.is_published ? 'published' : 'unpublished'} successfully`
      });
      
      await fetchCourses();
    } catch (error) {
      logger.error('Error toggling publish status:', error);
      toast({
        title: "Error",
        description: "Failed to update publish status",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingCourse(null);
    setFormData({
      title: '',
      description: '',
      thumbnail_url: '',
      price: 0,
      currency: 'PKR',
      max_installments: null,
      access_duration_days: null,
      is_active: true,
      is_published: false,
      sequence_order: courses.length + 1,
      drip_enabled: null
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const totalStudents = courses.reduce((sum, c) => sum + (c.enrollment_count || 0), 0);
  const totalModules = courses.reduce((sum, c) => sum + (c.module_count || 0), 0);
  const publishedCount = courses.filter(c => c.is_published).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Course Management</h2>
          <p className="text-sm text-muted-foreground">Create and manage courses for your students</p>
        </div>
        {!readOnly && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Add Course
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <DialogHeader>
                <DialogTitle>{editingCourse ? 'Edit Course' : 'Create Course'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Title *</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        placeholder="Course title"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Course description"
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Price</Label>
                      <Input
                        id="price"
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                        min={0}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="max_installments">Max Installments</Label>
                      <Input
                        id="max_installments"
                        type="number"
                        value={formData.max_installments ?? ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          max_installments: e.target.value ? parseInt(e.target.value) : null 
                        })}
                        min={1}
                        max={12}
                        placeholder="Default"
                      />
                      <p className="text-xs text-muted-foreground">1-12, blank for company default</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sequence_order">Order</Label>
                      <Input
                        id="sequence_order"
                        type="number"
                        value={formData.sequence_order}
                        onChange={(e) => setFormData({ ...formData, sequence_order: parseInt(e.target.value) || 0 })}
                        min={0}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="access_duration_days">Access Duration (Days)</Label>
                      <Input
                        id="access_duration_days"
                        type="number"
                        value={formData.access_duration_days ?? ''}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          access_duration_days: e.target.value ? parseInt(e.target.value) : null 
                        })}
                        min={1}
                        placeholder="Unlimited"
                      />
                      <p className="text-xs text-muted-foreground">Leave blank for unlimited access</p>
                    </div>
                    <div className="flex items-center gap-6 pt-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_active"
                          checked={formData.is_active}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                        />
                        <Label htmlFor="is_active">Active</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="is_published"
                          checked={formData.is_published}
                          onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
                        />
                        <Label htmlFor="is_published">Published</Label>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <Label className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Content Drip
                  </Label>
                  <Select
                    value={formData.drip_enabled === null ? 'default' : formData.drip_enabled ? 'on' : 'off'}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      drip_enabled: value === 'default' ? null : value === 'on' 
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select drip setting" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Use Default (Company Setting)</SelectItem>
                      <SelectItem value="on">Enabled</SelectItem>
                      <SelectItem value="off">Disabled</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    When enabled, recordings unlock based on days since enrollment
                  </p>
                </div>
                <div className="pt-2 border-t">
                  <CoverImageUpload
                    currentImageUrl={formData.thumbnail_url}
                    onImageChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
                    type="course"
                    entityId={editingCourse?.id}
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingCourse ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{courses.length}</p>
              <p className="text-xs text-muted-foreground">Total Courses</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Eye className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{publishedCount}</p>
              <p className="text-xs text-muted-foreground">Published</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalModules}</p>
              <p className="text-xs text-muted-foreground">Total Modules</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalStudents}</p>
              <p className="text-xs text-muted-foreground">Enrolled Students</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Course List */}
      {courses.length === 0 ? (
        <Card className="p-12">
          <div className="text-center text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No courses yet</p>
            <p className="text-sm">Create your first course to get started.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {courses.map((course, index) => (
            <Card key={course.id} className="overflow-hidden">
              <div className="flex items-center gap-3 p-3">
                <span className="text-sm font-medium text-muted-foreground w-5 text-center shrink-0">
                  {course.sequence_order || index + 1}
                </span>

                {course.thumbnail_url ? (
                  <img 
                    src={course.thumbnail_url} 
                    alt={course.title}
                    className="w-10 h-10 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{course.title}</p>
                </div>

                <div className="hidden md:flex items-center shrink-0">
                  <div className="text-center w-16">
                    <p className="text-sm font-semibold">{course.module_count || 0}</p>
                    <p className="text-[11px] text-muted-foreground">Modules</p>
                  </div>
                  <div className="text-center w-16">
                    <p className="text-sm font-semibold">{course.enrollment_count || 0}</p>
                    <p className="text-[11px] text-muted-foreground">Students</p>
                  </div>
                </div>

                <div className="hidden lg:flex items-center gap-1 shrink-0 w-[140px]">
                  {course.mentors && course.mentors.length > 0 ? (
                    course.mentors.slice(0, 2).map((assignment) => {
                      const mentor = mentors.find(m => m.id === assignment.mentor_id);
                      return (
                        <Badge 
                          key={assignment.mentor_id} 
                          variant={assignment.is_primary ? "default" : "secondary"}
                          className="text-[11px] truncate max-w-[80px]"
                        >
                          {mentor?.full_name || mentor?.email?.split('@')[0] || '?'}
                        </Badge>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">No mentor</span>
                  )}
                  {!readOnly && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 shrink-0"
                      onClick={() => {
                        setSelectedCourse(course);
                        setMentorDialogOpen(true);
                      }}
                      title="Assign mentor"
                    >
                      <Plus className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0 w-[140px] justify-end">
                  <Badge 
                    variant={course.is_active ? "default" : "secondary"} 
                    className={`text-[11px] ${course.is_active ? 'bg-green-600 hover:bg-green-600/80 text-white border-transparent' : ''}`}
                  >
                    {course.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  <Badge variant={course.is_published ? "default" : "outline"} className="text-[11px]">
                    {course.is_published ? 'Published' : 'Draft'}
                  </Badge>
                </div>

                {!readOnly && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(course)} title="Edit">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePublished(course)} title={course.is_published ? 'Unpublish' : 'Publish'}>
                      {course.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setTimelineCourse(course)} title="Content Timeline">
                      <Clock className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(course.id)} title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Assign Mentor Dialog */}
      <Dialog open={mentorDialogOpen} onOpenChange={setMentorDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Mentor to {selectedCourse?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Mentor</Label>
              <Select value={selectedMentorId} onValueChange={setSelectedMentorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a mentor..." />
                </SelectTrigger>
                <SelectContent>
                  {mentors.map(mentor => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        {mentor.full_name || mentor.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCourse?.mentors && selectedCourse.mentors.length > 0 && (
              <div className="space-y-2">
                <Label>Currently Assigned</Label>
                <div className="flex flex-wrap gap-2">
                  {selectedCourse.mentors.map(assignment => {
                    const mentor = mentors.find(m => m.id === assignment.mentor_id);
                    return (
                      <Badge key={assignment.mentor_id} variant={assignment.is_primary ? "default" : "secondary"}>
                        {mentor?.full_name || mentor?.email || 'Unknown'}
                        {assignment.is_primary && ' (Primary)'}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMentorDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignMentor} disabled={!selectedMentorId}>
              Assign Mentor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Timeline Dialog */}
      <ContentTimelineDialog
        type="course"
        entityId={timelineCourse?.id || ''}
        entityName={timelineCourse?.title || ''}
        open={!!timelineCourse}
        onOpenChange={(open) => { if (!open) setTimelineCourse(null); }}
      />
    </div>
  );
}
