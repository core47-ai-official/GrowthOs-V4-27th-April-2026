import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentTimelineDialog } from './ContentTimelineDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CoverImageUpload } from '@/components/ui/cover-image-upload';
import { Plus, Edit, Trash2, Route, Eye, EyeOff, ArrowRight, GitFork, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface LearningPathway {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number | null;
  currency: string | null;
  max_installments: number | null;
  access_duration_days: number | null;
  is_active: boolean;
  is_published: boolean;
  created_at: string | null;
  drip_enabled: boolean | null;
  course_count?: number;
}

interface PathwayCourse {
  id: string;
  pathway_id: string;
  course_id: string;
  step_number: number;
  is_mandatory: boolean;
  is_choice_point: boolean;
  choice_group: number | null;
  course_title?: string;
}

interface Course {
  id: string;
  title: string;
}

export function PathwayManagement({ readOnly = false }: { readOnly?: boolean } = {}) {
  const [pathways, setPathways] = useState<LearningPathway[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [coursesDialogOpen, setCoursesDialogOpen] = useState(false);
  const [choiceDialogOpen, setChoiceDialogOpen] = useState(false);
  const [editingPathway, setEditingPathway] = useState<LearningPathway | null>(null);
  const [selectedPathway, setSelectedPathway] = useState<LearningPathway | null>(null);
  const [timelinePathway, setTimelinePathway] = useState<LearningPathway | null>(null);
  const [pathwayCourses, setPathwayCourses] = useState<PathwayCourse[]>([]);
  const [choiceCourse1, setChoiceCourse1] = useState<string>('');
  const [choiceCourse2, setChoiceCourse2] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    thumbnail_url: '',
    price: 0,
    currency: 'PKR',
    max_installments: null as number | null,
    access_duration_days: null as number | null,
    is_active: true,
    is_published: false,
    drip_enabled: null as boolean | null
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchPathways();
    fetchCourses();
  }, []);

  const fetchPathways = async () => {
    try {
      setLoading(true);
      
      const { data: pathwaysData, error } = await supabase
        .from('learning_pathways')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get course counts per pathway
      const { data: pathwayCoursesData } = await supabase
        .from('pathway_courses')
        .select('pathway_id');

      const courseCountMap = new Map<string, number>();
      pathwayCoursesData?.forEach(pc => {
        courseCountMap.set(pc.pathway_id, (courseCountMap.get(pc.pathway_id) || 0) + 1);
      });

      const pathwaysWithCounts = (pathwaysData || []).map(pathway => ({
        ...pathway,
        drip_enabled: (pathway as any).drip_enabled ?? null,
        max_installments: (pathway as any).max_installments ?? null,
        access_duration_days: (pathway as any).access_duration_days ?? null,
        course_count: courseCountMap.get(pathway.id) || 0
      }));

      setPathways(pathwaysWithCounts);
    } catch (error) {
      logger.error('Error fetching pathways:', error);
      toast({
        title: "Error",
        description: "Failed to fetch learning pathways",
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
        .order('sequence_order');

      if (error) throw error;
      setCourses(data || []);
    } catch (error) {
      logger.error('Error fetching courses:', error);
    }
  };

  const fetchPathwayCourses = async (pathwayId: string) => {
    try {
      const { data, error } = await supabase
        .from('pathway_courses')
        .select(`
          id,
          pathway_id,
          course_id,
          step_number,
          is_mandatory,
          is_choice_point,
          choice_group,
          courses(title)
        `)
        .eq('pathway_id', pathwayId)
        .order('step_number');

      if (error) throw error;
      
      const coursesWithTitles = (data || []).map(pc => ({
        ...pc,
        course_title: (pc.courses as any)?.title || 'Unknown Course'
      }));
      
      setPathwayCourses(coursesWithTitles);
    } catch (error) {
      logger.error('Error fetching pathway courses:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Pathway name is required",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingPathway) {
        const { error } = await supabase
          .from('learning_pathways')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            price: formData.price,
            currency: formData.currency,
            max_installments: formData.max_installments,
            access_duration_days: formData.access_duration_days,
            is_active: formData.is_active,
            is_published: formData.is_published,
            drip_enabled: formData.drip_enabled
          } as any)
          .eq('id', editingPathway.id);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Pathway updated successfully"
        });
      } else {
        const { error } = await supabase
          .from('learning_pathways')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            thumbnail_url: formData.thumbnail_url.trim() || null,
            price: formData.price,
            currency: formData.currency,
            max_installments: formData.max_installments,
            access_duration_days: formData.access_duration_days,
            is_active: formData.is_active,
            is_published: formData.is_published,
            drip_enabled: formData.drip_enabled
          } as any);

        if (error) throw error;

        toast({
          title: "Success",
          description: "Pathway created successfully"
        });
      }

      setDialogOpen(false);
      resetForm();
      await fetchPathways();
    } catch (error) {
      logger.error('Error saving pathway:', error);
      toast({
        title: "Error",
        description: "Failed to save pathway",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (pathway: LearningPathway) => {
    setEditingPathway(pathway);
    setFormData({
      name: pathway.name,
      description: pathway.description || '',
      thumbnail_url: pathway.thumbnail_url || '',
      price: pathway.price || 0,
      currency: pathway.currency || 'PKR',
      max_installments: pathway.max_installments,
      access_duration_days: pathway.access_duration_days,
      is_active: pathway.is_active,
      is_published: pathway.is_published,
      drip_enabled: pathway.drip_enabled
    });
    setDialogOpen(true);
  };

  const handleManageCourses = async (pathway: LearningPathway) => {
    setSelectedPathway(pathway);
    await fetchPathwayCourses(pathway.id);
    setCoursesDialogOpen(true);
  };

  const handleAddCourseToPathway = async (courseId: string, isChoicePoint: boolean = false, choiceGroup: number | null = null) => {
    if (!selectedPathway) return;

    try {
      // Calculate the next step number based on existing courses
      const maxStep = pathwayCourses.reduce((max, pc) => Math.max(max, pc.step_number), 0);
      const nextStep = isChoicePoint && choiceGroup !== null 
        ? pathwayCourses.find(pc => pc.choice_group === choiceGroup)?.step_number || maxStep + 1
        : maxStep + 1;
      
      const { error } = await supabase
        .from('pathway_courses')
        .insert({
          pathway_id: selectedPathway.id,
          course_id: courseId,
          step_number: nextStep,
          is_mandatory: !isChoicePoint,
          is_choice_point: isChoicePoint,
          choice_group: choiceGroup
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: isChoicePoint ? "Choice course added to pathway" : "Course added to pathway"
      });
      
      await fetchPathwayCourses(selectedPathway.id);
      await fetchPathways();
    } catch (error) {
      logger.error('Error adding course to pathway:', error);
      toast({
        title: "Error",
        description: "Failed to add course",
        variant: "destructive"
      });
    }
  };

  const handleAddChoicePoint = async (courseId1: string, courseId2: string) => {
    if (!selectedPathway) return;

    try {
      const maxStep = pathwayCourses.reduce((max, pc) => Math.max(max, pc.step_number), 0);
      const nextStep = maxStep + 1;
      const newChoiceGroup = Math.max(...pathwayCourses.map(pc => pc.choice_group || 0), 0) + 1;

      // Insert both courses as choice options
      const { error } = await supabase
        .from('pathway_courses')
        .insert([
          {
            pathway_id: selectedPathway.id,
            course_id: courseId1,
            step_number: nextStep,
            is_mandatory: false,
            is_choice_point: true,
            choice_group: newChoiceGroup
          },
          {
            pathway_id: selectedPathway.id,
            course_id: courseId2,
            step_number: nextStep,
            is_mandatory: false,
            is_choice_point: true,
            choice_group: newChoiceGroup
          }
        ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Choice point added to pathway"
      });
      
      await fetchPathwayCourses(selectedPathway.id);
      await fetchPathways();
    } catch (error) {
      logger.error('Error adding choice point:', error);
      toast({
        title: "Error",
        description: "Failed to add choice point",
        variant: "destructive"
      });
    }
  };

  const handleAddToExistingChoiceGroup = async (courseId: string, choiceGroup: number) => {
    await handleAddCourseToPathway(courseId, true, choiceGroup);
  };

  const handleRemoveCourseFromPathway = async (pathwayCourseId: string) => {
    if (!selectedPathway) return;

    try {
      const { error } = await supabase
        .from('pathway_courses')
        .delete()
        .eq('id', pathwayCourseId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Course removed from pathway"
      });
      
      await fetchPathwayCourses(selectedPathway.id);
      await fetchPathways();
    } catch (error) {
      logger.error('Error removing course:', error);
      toast({
        title: "Error",
        description: "Failed to remove course",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (pathwayId: string) => {
    if (!confirm('Are you sure you want to delete this pathway?')) return;

    try {
      // Delete pathway courses first
      await supabase
        .from('pathway_courses')
        .delete()
        .eq('pathway_id', pathwayId);

      const { error } = await supabase
        .from('learning_pathways')
        .delete()
        .eq('id', pathwayId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pathway deleted successfully"
      });
      
      await fetchPathways();
    } catch (error) {
      logger.error('Error deleting pathway:', error);
      toast({
        title: "Error",
        description: "Failed to delete pathway",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setEditingPathway(null);
    setFormData({
      name: '',
      description: '',
      thumbnail_url: '',
      price: 0,
      currency: 'PKR',
      max_installments: null,
      access_duration_days: null,
      is_active: true,
      is_published: false,
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

  const availableCoursesForPathway = courses.filter(
    c => !pathwayCourses.some(pc => pc.course_id === c.id)
  );

  // Group pathway courses by step number and choice group for rendering
  const groupedPathwayCourses = pathwayCourses.reduce((acc, pc) => {
    const key = pc.is_choice_point ? `choice-${pc.choice_group}` : `step-${pc.step_number}`;
    if (!acc[key]) {
      acc[key] = {
        step_number: pc.step_number,
        is_choice_point: pc.is_choice_point,
        choice_group: pc.choice_group,
        courses: []
      };
    }
    acc[key].courses.push(pc);
    return acc;
  }, {} as Record<string, { step_number: number; is_choice_point: boolean; choice_group: number | null; courses: PathwayCourse[] }>);

  const sortedGroups = Object.values(groupedPathwayCourses).sort((a, b) => a.step_number - b.step_number);
  
  // Get existing choice groups for adding more options
  const existingChoiceGroups = [...new Set(pathwayCourses.filter(pc => pc.is_choice_point && pc.choice_group).map(pc => pc.choice_group!))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Learning Pathways</h2>
          <p className="text-muted-foreground">Create structured learning paths with multiple courses</p>
        </div>
        {!readOnly && <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              Add Pathway
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <DialogHeader>
              <DialogTitle>{editingPathway ? 'Edit Pathway' : 'Create Pathway'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Pathway name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Pathway description"
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-3 gap-4">
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
                  <p className="text-xs text-muted-foreground">1-12, blank for default</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Select 
                    value={formData.currency} 
                    onValueChange={(value) => setFormData({ ...formData, currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PKR">PKR</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
              
              <div className="flex items-center gap-6">
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

              {/* Drip Content Setting */}
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

              {/* Full Width - Cover Image (at the end) */}
              <div className="pt-2 border-t">
                <CoverImageUpload
                  currentImageUrl={formData.thumbnail_url}
                  onImageChange={(url) => setFormData({ ...formData, thumbnail_url: url })}
                  type="pathway"
                  entityId={editingPathway?.id}
                />
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingPathway ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Courses</TableHead>
                <TableHead>Status</TableHead>
                {!readOnly && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pathways.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    <Route className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No learning pathways yet. Create your first pathway to get started.</p>
                  </TableCell>
                </TableRow>
              ) : (
                pathways.map((pathway) => (
                  <TableRow key={pathway.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{pathway.name}</p>
                        {pathway.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {pathway.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{pathway.course_count || 0} courses</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {pathway.is_active ? (
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                        {pathway.is_published ? (
                          <Badge className="bg-blue-100 text-blue-800">Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                      </div>
                    </TableCell>
                    {!readOnly && <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setTimelinePathway(pathway)}
                          title="Content Timeline"
                        >
                          <Clock className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleManageCourses(pathway)}
                          title="Manage Courses"
                        >
                          <Route className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(pathway)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(pathway.id)}
                          className="hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Manage Courses Dialog */}
      <Dialog open={coursesDialogOpen} onOpenChange={setCoursesDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Courses - {selectedPathway?.name}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Current courses in pathway */}
            <div>
              <Label className="text-sm font-medium">Courses in Pathway</Label>
              {sortedGroups.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No courses added yet.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {sortedGroups.map((group, index) => (
                    <div key={`group-${group.step_number}-${group.choice_group}`} className="flex items-center gap-1">
                      {group.is_choice_point ? (
                        // Choice point - show courses with OR between them
                        <div className="flex items-center gap-1 border border-dashed border-primary/50 rounded-lg p-2 bg-primary/5">
                          <GitFork className="w-4 h-4 text-primary mr-1" />
                          {group.courses.map((pc, pcIndex) => (
                            <div key={pc.id} className="flex items-center gap-1">
                              <Badge variant="outline" className="flex items-center gap-2 border-primary/50">
                                {pc.course_title}
                                <button
                                  onClick={() => handleRemoveCourseFromPathway(pc.id)}
                                  className="ml-1 hover:text-red-500"
                                >
                                  ×
                                </button>
                              </Badge>
                              {pcIndex < group.courses.length - 1 && (
                                <span className="text-xs font-semibold text-primary px-1">OR</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        // Regular sequential course
                        <Badge variant="secondary" className="flex items-center gap-2">
                          <span className="font-bold">{group.step_number}.</span>
                          {group.courses[0]?.course_title}
                          <button
                            onClick={() => handleRemoveCourseFromPathway(group.courses[0]?.id)}
                            className="ml-1 hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      )}
                      {index < sortedGroups.length - 1 && (
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add sequential course */}
            {availableCoursesForPathway.length > 0 && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Add Sequential Course</Label>
                  <Select onValueChange={(value) => handleAddCourseToPathway(value, false, null)}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a course to add..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableCoursesForPathway.map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Add choice point */}
                {availableCoursesForPathway.length >= 2 && (
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <GitFork className="w-4 h-4" />
                      Add Choice Point (Either/Or)
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Add a branching point where students can choose between courses
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setChoiceCourse1('');
                        setChoiceCourse2('');
                        setChoiceDialogOpen(true);
                      }}
                    >
                      <GitFork className="w-4 h-4 mr-2" />
                      Create Choice Point
                    </Button>
                  </div>
                )}

                {/* Add to existing choice group */}
                {existingChoiceGroups.length > 0 && availableCoursesForPathway.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Add to Existing Choice</Label>
                    <p className="text-xs text-muted-foreground mt-1 mb-2">
                      Add another option to an existing choice point
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {existingChoiceGroups.map((group) => {
                        const groupCourses = pathwayCourses.filter(pc => pc.choice_group === group);
                        return (
                          <Select 
                            key={group} 
                            onValueChange={(courseId) => handleAddToExistingChoiceGroup(courseId, group)}
                          >
                            <SelectTrigger className="w-auto">
                              <SelectValue placeholder={`Add to: ${groupCourses.map(c => c.course_title).join(' / ')}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {availableCoursesForPathway.map((course) => (
                                <SelectItem key={course.id} value={course.id}>
                                  {course.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCoursesDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Choice Point Creation Dialog */}
      <Dialog open={choiceDialogOpen} onOpenChange={setChoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Choice Point</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select two courses that students can choose between:
            </p>
            <div className="space-y-3">
              <div>
                <Label>Course Option 1</Label>
                <Select value={choiceCourse1} onValueChange={setChoiceCourse1}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select first course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoursesForPathway
                      .filter(c => c.id !== choiceCourse2)
                      .map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-center">
                <span className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded">OR</span>
              </div>
              <div>
                <Label>Course Option 2</Label>
                <Select value={choiceCourse2} onValueChange={setChoiceCourse2}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select second course..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableCoursesForPathway
                      .filter(c => c.id !== choiceCourse1)
                      .map((course) => (
                        <SelectItem key={course.id} value={course.id}>
                          {course.title}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChoiceDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (choiceCourse1 && choiceCourse2) {
                  handleAddChoicePoint(choiceCourse1, choiceCourse2);
                  setChoiceDialogOpen(false);
                }
              }}
              disabled={!choiceCourse1 || !choiceCourse2}
            >
              Create Choice Point
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Content Timeline Dialog */}
      <ContentTimelineDialog
        type="pathway"
        entityId={timelinePathway?.id || ''}
        entityName={timelinePathway?.name || ''}
        open={!!timelinePathway}
        onOpenChange={(open) => { if (!open) setTimelinePathway(null); }}
      />
    </div>
  );
}
