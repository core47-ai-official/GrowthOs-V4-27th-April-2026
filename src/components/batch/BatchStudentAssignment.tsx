import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Search, Users, UserPlus, UserMinus, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface Student {
  id: string;
  student_id: string;
  user_name: string;
  user_email: string;
  batch_id: string | null;
  enrolled_at: string;
}

interface BatchStudentAssignmentProps {
  batchId: string;
  batchName: string;
  courseId: string | null;
  pathwayId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export function BatchStudentAssignment({
  batchId,
  batchName,
  courseId,
  pathwayId,
  open,
  onOpenChange,
  onUpdate
}: BatchStudentAssignmentProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchStudents();
    }
  }, [open, batchId, courseId, pathwayId]);

  const fetchStudents = async () => {
    setLoading(true);
    try {
      // Build query based on enrollment type
      let query = supabase
        .from('course_enrollments')
        .select('id, student_id, batch_id, enrolled_at');

      if (courseId) {
        query = query.eq('course_id', courseId);
      } else if (pathwayId) {
        query = query.eq('pathway_id', pathwayId);
      }

      const { data: enrollments, error: enrollmentError } = await query;

      if (enrollmentError) throw enrollmentError;

      if (!enrollments || enrollments.length === 0) {
        setStudents([]);
        return;
      }

      // Get unique student IDs
      const studentIds = [...new Set(enrollments.map(e => e.student_id))];

      // Fetch student details
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('id, user_id')
        .in('id', studentIds);

      if (studentsError) throw studentsError;

      // Get user IDs
      const userIds = (studentsData || []).map(s => s.user_id).filter(Boolean);

      // Fetch user details
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);

      if (usersError) throw usersError;

      // Create lookup maps
      const studentUserMap = new Map((studentsData || []).map(s => [s.id, s.user_id]));
      const userDetailsMap = new Map((usersData || []).map(u => [u.id, u]));

      // Transform data
      const transformedStudents: Student[] = (enrollments || []).map((enrollment) => {
        const userId = studentUserMap.get(enrollment.student_id);
        const user = userId ? userDetailsMap.get(userId) : null;
        return {
          id: enrollment.id,
          student_id: enrollment.student_id,
          user_name: user?.full_name || 'Unknown',
          user_email: user?.email || '',
          batch_id: enrollment.batch_id,
          enrolled_at: enrollment.enrolled_at
        };
      });

      setStudents(transformedStudents);

      // Pre-select students already in this batch
      const inBatch = new Set(
        transformedStudents
          .filter(s => s.batch_id === batchId)
          .map(s => s.id)
      );
      setSelectedStudents(inBatch);
    } catch (error) {
      logger.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch students',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStudent = (enrollmentId: string) => {
    setSelectedStudents(prev => {
      const next = new Set(prev);
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId);
      } else {
        next.add(enrollmentId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const filtered = filteredStudents;
    const allSelected = filtered.every(s => selectedStudents.has(s.id));
    
    if (allSelected) {
      // Deselect all filtered
      setSelectedStudents(prev => {
        const next = new Set(prev);
        filtered.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      // Select all filtered
      setSelectedStudents(prev => {
        const next = new Set(prev);
        filtered.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Get all enrollment IDs
      const allIds = students.map(s => s.id);
      const selectedIds = Array.from(selectedStudents);
      const unselectedIds = allIds.filter(id => !selectedStudents.has(id));

      // Assign selected students to this batch
      if (selectedIds.length > 0) {
        const { error: assignError } = await supabase
          .from('course_enrollments')
          .update({ batch_id: batchId })
          .in('id', selectedIds);

        if (assignError) throw assignError;
      }

      // Unassign unselected students from this batch (only if they were in this batch)
      const toUnassign = unselectedIds.filter(id => {
        const student = students.find(s => s.id === id);
        return student?.batch_id === batchId;
      });

      if (toUnassign.length > 0) {
        const { error: unassignError } = await supabase
          .from('course_enrollments')
          .update({ batch_id: null })
          .in('id', toUnassign);

        if (unassignError) throw unassignError;
      }

      toast({
        title: 'Success',
        description: 'Student assignments updated successfully'
      });

      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      logger.error('Error saving assignments:', error);
      toast({
        title: 'Error',
        description: 'Failed to update student assignments',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const filteredStudents = students.filter(s =>
    s.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.user_email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const assignedCount = students.filter(s => selectedStudents.has(s.id)).length;
  const currentlyInBatch = students.filter(s => s.batch_id === batchId).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Manage Students - {batchName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Stats */}
          <div className="flex gap-4">
            <Badge variant="secondary" className="px-3 py-1">
              {currentlyInBatch} currently assigned
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              {assignedCount} selected
            </Badge>
            <Badge variant="outline" className="px-3 py-1">
              {students.length} total enrolled
            </Badge>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Select All */}
          <div className="flex items-center justify-between px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAll}
              disabled={loading}
            >
              {filteredStudents.every(s => selectedStudents.has(s.id)) 
                ? 'Deselect All' 
                : 'Select All'}
            </Button>
          </div>

          {/* Student List */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No students match your search' : 'No students enrolled in this course/pathway'}
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-md">
              <div className="p-2 space-y-1">
                {filteredStudents.map((student) => {
                  const isSelected = selectedStudents.has(student.id);
                  const wasInBatch = student.batch_id === batchId;
                  const isInOtherBatch = student.batch_id && student.batch_id !== batchId;

                  return (
                    <div
                      key={student.id}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/50 ${
                        isSelected ? 'bg-primary/5' : ''
                      }`}
                      onClick={() => !isInOtherBatch && handleToggleStudent(student.id)}
                    >
                      <Checkbox
                        checked={isSelected}
                        disabled={!!isInOtherBatch}
                        onCheckedChange={() => handleToggleStudent(student.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{student.user_name}</div>
                        <div className="text-sm text-muted-foreground truncate">
                          {student.user_email}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {wasInBatch && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                        {isInOtherBatch && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            Other Batch
                          </Badge>
                        )}
                        {isSelected && !wasInBatch && (
                          <UserPlus className="w-4 h-4 text-green-600" />
                        )}
                        {!isSelected && wasInBatch && (
                          <UserMinus className="w-4 h-4 text-destructive" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Assignments
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
