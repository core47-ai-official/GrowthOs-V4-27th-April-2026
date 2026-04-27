import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Settings, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ManageAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: {
    id: string;
    student_record_id?: string | null;
    full_name: string;
  } | null;
  onUpdate?: () => void;
}

interface EnrollmentAccess {
  id: string;
  course_id: string;
  course_title?: string;
  pathway_id?: string;
  pathway_name?: string;
  drip_override: boolean;
  drip_enabled: boolean;
  sequential_override: boolean;
  sequential_enabled: boolean;
}

export const ManageAccessDialog: React.FC<ManageAccessDialogProps> = ({
  open,
  onOpenChange,
  student,
  onUpdate
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enrollments, setEnrollments] = useState<EnrollmentAccess[]>([]);
  const [expandedEnrollments, setExpandedEnrollments] = useState<Set<string>>(new Set());

  // Fetch enrollment access settings
  useEffect(() => {
    if (open && student?.student_record_id) {
      fetchEnrollmentAccess();
    }
  }, [open, student?.student_record_id]);

  const fetchEnrollmentAccess = async () => {
    if (!student?.student_record_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_enrollments')
        .select(`
          id,
          course_id,
          pathway_id,
          drip_override,
          drip_enabled,
          sequential_override,
          sequential_enabled,
          courses:course_id(title),
          learning_pathways:pathway_id(name)
        `)
        .eq('student_id', student.student_record_id);

      if (error) throw error;

      const enrollmentData: EnrollmentAccess[] = (data || []).map((e: any) => ({
        id: e.id,
        course_id: e.course_id,
        course_title: e.courses?.title || 'Unknown Course',
        pathway_id: e.pathway_id,
        pathway_name: e.learning_pathways?.name,
        drip_override: e.drip_override || false,
        drip_enabled: e.drip_enabled !== false,
        sequential_override: e.sequential_override || false,
        sequential_enabled: e.sequential_enabled !== false
      }));

      setEnrollments(enrollmentData);

      // Auto-expand first enrollment
      if (enrollmentData.length > 0) {
        setExpandedEnrollments(new Set([enrollmentData[0].id]));
      }
    } catch (error) {
      console.error('Error fetching enrollment access:', error);
      toast({
        title: 'Error',
        description: 'Failed to load access settings',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollmentChange = (enrollmentId: string, field: keyof EnrollmentAccess, value: any) => {
    setEnrollments(prev => prev.map(e => 
      e.id === enrollmentId ? { ...e, [field]: value } : e
    ));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update each enrollment
      for (const enrollment of enrollments) {
        const { error } = await supabase
          .from('course_enrollments')
          .update({
            drip_override: enrollment.drip_override,
            drip_enabled: enrollment.drip_enabled,
            sequential_override: enrollment.sequential_override,
            sequential_enabled: enrollment.sequential_enabled
          })
          .eq('id', enrollment.id);

        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: 'Access settings updated successfully'
      });

      onUpdate?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving access settings:', error);
      toast({
        title: 'Error',
        description: 'Failed to save access settings',
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleEnrollmentExpand = (id: string) => {
    setExpandedEnrollments(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Manage Access - {student?.full_name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : enrollments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No course enrollments found for this student.
          </div>
        ) : (
          <div className="space-y-4">
            {enrollments.map((enrollment) => (
              <Collapsible
                key={enrollment.id}
                open={expandedEnrollments.has(enrollment.id)}
                onOpenChange={() => toggleEnrollmentExpand(enrollment.id)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                      <CardTitle className="flex items-center justify-between text-sm font-medium">
                        <span>
                          {enrollment.pathway_name 
                            ? `${enrollment.pathway_name} → ${enrollment.course_title}`
                            : enrollment.course_title
                          }
                        </span>
                        {expandedEnrollments.has(enrollment.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </CardTitle>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="pt-0 space-y-6">
                      {/* Drip Content Override */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Override Drip Settings</Label>
                          <Switch
                            checked={enrollment.drip_override}
                            onCheckedChange={(checked) => 
                              handleEnrollmentChange(enrollment.id, 'drip_override', checked)
                            }
                          />
                        </div>

                        {enrollment.drip_override && (
                          <div className="pl-4 border-l-2 border-muted">
                            <Label className="text-sm text-muted-foreground mb-2 block">
                              Content Dripping
                            </Label>
                            <RadioGroup
                              value={enrollment.drip_enabled ? 'enabled' : 'disabled'}
                              onValueChange={(value) => 
                                handleEnrollmentChange(enrollment.id, 'drip_enabled', value === 'enabled')
                              }
                              className="space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="enabled" id={`drip-enabled-${enrollment.id}`} />
                                <Label htmlFor={`drip-enabled-${enrollment.id}`} className="text-sm">
                                  Enabled - Content unlocks gradually
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="disabled" id={`drip-disabled-${enrollment.id}`} />
                                <Label htmlFor={`drip-disabled-${enrollment.id}`} className="text-sm">
                                  Disabled - All content available immediately
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>

                      {/* Sequential Unlock Override */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">Override Sequential Unlock</Label>
                          <Switch
                            checked={enrollment.sequential_override}
                            onCheckedChange={(checked) => 
                              handleEnrollmentChange(enrollment.id, 'sequential_override', checked)
                            }
                          />
                        </div>

                        {enrollment.sequential_override && (
                          <div className="pl-4 border-l-2 border-muted">
                            <Label className="text-sm text-muted-foreground mb-2 block">
                              Sequential Unlock
                            </Label>
                            <RadioGroup
                              value={enrollment.sequential_enabled ? 'enabled' : 'disabled'}
                              onValueChange={(value) => 
                                handleEnrollmentChange(enrollment.id, 'sequential_enabled', value === 'enabled')
                              }
                              className="space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="enabled" id={`seq-enabled-${enrollment.id}`} />
                                <Label htmlFor={`seq-enabled-${enrollment.id}`} className="text-sm">
                                  Enabled - Must complete lessons in order
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="disabled" id={`seq-disabled-${enrollment.id}`} />
                                <Label htmlFor={`seq-disabled-${enrollment.id}`} className="text-sm">
                                  Disabled - Can access any lesson
                                </Label>
                              </div>
                            </RadioGroup>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
