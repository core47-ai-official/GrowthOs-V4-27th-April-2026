import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Route, Plus, Trash2, CheckCircle, XCircle, Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logAdminAction, ACTIVITY_TYPES } from '@/lib/activity-logger';
import { getCurrencySymbol } from '@/utils/currencyFormatter';

interface Course {
  id: string;
  title: string;
  is_published: boolean;
  is_active: boolean;
  price?: number | null;
  max_installments?: number | null;
  access_duration_days?: number | null;
}

interface Pathway {
  id: string;
  name: string;
  is_published: boolean;
  is_active: boolean;
  price?: number | null;
  max_installments?: number | null;
  access_duration_days?: number | null;
}

interface Enrollment {
  id: string;
  course_id: string | null;
  pathway_id: string | null;
  status: string;
  enrolled_at: string | null;
  access_expires_at: string | null;
}

interface PathwayCourse {
  course_id: string;
  pathway_id: string;
  step_number?: number | null;
}

interface StudentAccessManagementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string; // This is the students.id (student_record_id)
  studentUserId: string; // This is the users.id
  studentName: string;
  onAccessUpdated?: () => void;
}

export function StudentAccessManagement({
  open,
  onOpenChange,
  studentId,
  studentUserId,
  studentName,
  onAccessUpdated
}: StudentAccessManagementProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [pathways, setPathways] = useState<Pathway[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedPathways, setSelectedPathways] = useState<Set<string>>(new Set());
  const [pathwayCourses, setPathwayCourses] = useState<PathwayCourse[]>([]);
  const [pathwayNames, setPathwayNames] = useState<Map<string, string>>(new Map());

  // Get courses that are included in the student's assigned pathways
  const getCoursesInAssignedPathways = () => {
    const assignedPathwayIds = Array.from(selectedPathways);
    const coursesViaPathway = new Map<string, string[]>(); // courseId -> [pathwayNames]
    
    pathwayCourses.forEach(pc => {
      if (assignedPathwayIds.includes(pc.pathway_id)) {
        const pathwayName = pathwayNames.get(pc.pathway_id) || 'Unknown Pathway';
        if (!coursesViaPathway.has(pc.course_id)) {
          coursesViaPathway.set(pc.course_id, []);
        }
        coursesViaPathway.get(pc.course_id)!.push(pathwayName);
      }
    });
    
    return coursesViaPathway;
  };

  useEffect(() => {
    if (open && studentId) {
      fetchData();
    }
  }, [open, studentId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [coursesRes, pathwaysRes, enrollmentsRes, pathwayCoursesRes, settingsRes] = await Promise.all([
        supabase.from('courses').select('id, title, is_published, is_active, price, max_installments, access_duration_days').eq('is_active', true).order('title'),
        supabase.from('learning_pathways').select('id, name, is_published, is_active, price, max_installments, access_duration_days').eq('is_active', true).order('name'),
        supabase.from('course_enrollments').select('*').eq('student_id', studentId),
        supabase.from('pathway_courses').select('course_id, pathway_id, step_number'),
        supabase.from('company_settings').select('invoice_send_gap_days, invoice_overdue_days').single()
      ]);
      
      const invoiceSettings = settingsRes.data || { invoice_send_gap_days: 30, invoice_overdue_days: 5 };

      if (coursesRes.error) throw coursesRes.error;
      if (pathwaysRes.error) throw pathwaysRes.error;
      if (enrollmentsRes.error) throw enrollmentsRes.error;
      if (pathwayCoursesRes.error) throw pathwayCoursesRes.error;

      // All courses
      const allCourses = coursesRes.data || [];
      setCourses(allCourses);

      // Store pathway courses for later reference
      setPathwayCourses(pathwayCoursesRes.data || []);

      // Store pathway names for display
      const pathwayNamesMap = new Map<string, string>();
      (pathwaysRes.data || []).forEach(p => pathwayNamesMap.set(p.id, p.name));
      setPathwayNames(pathwayNamesMap);

      setPathways(pathwaysRes.data || []);
      setEnrollments(enrollmentsRes.data || []);

      // Set selected based on current enrollments
      const enrolledCourseIds = new Set(
        (enrollmentsRes.data || [])
          .filter(e => e.course_id && e.status === 'active')
          .map(e => e.course_id as string)
      );
      const enrolledPathwayIds = new Set(
        (enrollmentsRes.data || [])
          .filter(e => e.pathway_id && e.status === 'active')
          .map(e => e.pathway_id as string)
      );

      setSelectedCourses(enrolledCourseIds);
      setSelectedPathways(enrolledPathwayIds);
    } catch (error) {
      console.error('Error fetching access data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch access data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Function to create installment invoices for a course/pathway enrollment
  const createEnrollmentInvoices = async (
    itemType: 'course' | 'pathway',
    itemId: string,
    itemName: string,
    itemPrice: number | null | undefined,
    maxInstallments: number | null | undefined
  ) => {
    try {
      const price = itemPrice || 0;
      if (price <= 0) {
        console.log('Free enrollment - no invoices needed');
        return null;
      }

      // Get invoice settings
      const { data: settings } = await supabase
        .from('company_settings')
        .select('invoice_send_gap_days, invoice_overdue_days')
        .single();

      const gapDays = settings?.invoice_send_gap_days || 30;
      const overdueDays = settings?.invoice_overdue_days || 5;
      const installments = maxInstallments || 3;
      const installmentAmount = price / installments;

      // Check if student has an active batch enrollment for anchor date
      let batchStartDate: Date | null = null;
      const { data: batchEnrollment } = await supabase
        .from('course_enrollments')
        .select('batch_id, batches!inner(start_date)')
        .eq('student_id', studentId)
        .not('batch_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (batchEnrollment?.batches?.start_date) {
        batchStartDate = new Date((batchEnrollment.batches as any).start_date);
      }

      // Create all installment invoices
      const invoices = [];
      for (let i = 1; i <= installments; i++) {
        let issueDate: Date;
        let dueDate: Date;

        if (i === 1) {
          // 1st installment: issued immediately
          issueDate = new Date();
          dueDate = new Date(issueDate);
          dueDate.setDate(dueDate.getDate() + overdueDays);
        } else if (batchStartDate) {
          // Batch-enrolled: anchor to batch start date + (i-1)*gapDays
          issueDate = new Date(batchStartDate);
          issueDate.setDate(issueDate.getDate() + ((i - 1) * gapDays));
          dueDate = new Date(issueDate);
          dueDate.setDate(dueDate.getDate() + overdueDays);
        } else {
          // Non-batch: anchor to joining date (now) + (i-1)*gapDays
          issueDate = new Date();
          issueDate.setDate(issueDate.getDate() + ((i - 1) * gapDays));
          dueDate = new Date(issueDate);
          dueDate.setDate(dueDate.getDate() + overdueDays);
        }

        invoices.push({
          student_id: studentId,
          course_id: itemType === 'course' ? itemId : null,
          pathway_id: itemType === 'pathway' ? itemId : null,
          installment_number: i,
          amount: installmentAmount,
          issue_date: issueDate.toISOString(),
          due_date: dueDate.toISOString(),
          status: i === 1 ? 'pending' : 'scheduled',
          enrollment_details: {
            courses: itemType === 'course' ? [itemName] : [],
            pathways: itemType === 'pathway' ? [itemName] : []
          },
          notes: `Installment ${i} of ${installments} for ${itemType}: ${itemName}`
        });
      }

      const { data: createdInvoices, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoices)
        .select();

      if (invoiceError) throw invoiceError;

      // Update enrollment with payment info
      await supabase
        .from('course_enrollments')
        .update({
          total_amount: price,
          amount_paid: 0,
          payment_status: 'pending',
          updated_at: new Date().toISOString()
        })
        .eq('student_id', studentId)
        .eq(itemType === 'course' ? 'course_id' : 'pathway_id', itemId);

      // Send notification to student
      await supabase.rpc('create_notification', {
        p_user_id: studentUserId,
        p_type: 'invoice_issued',
        p_title: 'New Invoice Generated',
        p_message: `${installments} invoice${installments > 1 ? 's have' : ' has'} been generated for your ${itemType} enrollment: ${itemName}. First installment: ${getCurrencySymbol()}${installmentAmount.toFixed(2)}. Total: ${getCurrencySymbol()}${price.toFixed(2)}.`,
        p_metadata: {
          invoice_ids: createdInvoices?.map(inv => inv.id),
          total_amount: price,
          installment_amount: installmentAmount,
          total_installments: installments,
          item_type: itemType,
          item_name: itemName
        }
      });

      toast({
        title: 'Invoices Created',
        description: `${installments} installment invoice${installments > 1 ? 's' : ''} generated for ${itemName}`,
      });

      // Log invoice creation to activity logs
      logAdminAction({
        performedBy: user?.id || null,
        targetUserId: studentUserId,
        entityType: 'invoice',
        action: ACTIVITY_TYPES.INVOICE_CREATED,
        description: `${installments} invoice(s) created for ${itemType}: ${itemName}`,
        data: {
          item_type: itemType,
          item_name: itemName,
          total_amount: price,
          installments,
          student_name: studentName,
          invoice_ids: createdInvoices?.map(inv => inv.id)
        }
      });

      return createdInvoices;
    } catch (error) {
      console.error('Error creating invoices:', error);
      toast({
        title: 'Warning',
        description: 'Access granted but invoices could not be created',
        variant: 'destructive'
      });
      return null;
    }
  };

  const getEnrollmentForCourse = (courseId: string) => {
    return enrollments.find(e => e.course_id === courseId);
  };

  const getEnrollmentForPathway = (pathwayId: string) => {
    return enrollments.find(e => e.pathway_id === pathwayId);
  };

  const handleToggleCourse = async (courseId: string) => {
    const isCurrentlyEnrolled = selectedCourses.has(courseId);
    const enrollment = getEnrollmentForCourse(courseId);
    const course = courses.find(c => c.id === courseId);

    setSaving(true);
    try {
      if (isCurrentlyEnrolled && enrollment) {
        // Terminate access
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedCourses(prev => {
          const next = new Set(prev);
          next.delete(courseId);
          return next;
        });
        toast({ title: 'Access Terminated', description: 'Course access has been removed' });
      } else if (!isCurrentlyEnrolled && enrollment) {
        // Reactivate existing enrollment
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedCourses(prev => new Set(prev).add(courseId));
        toast({ title: 'Access Granted', description: 'Course access has been restored' });
      } else {
        // Create new enrollment with payment tracking and access expiry
        const enrolledAt = new Date();
        let accessExpiresAt: string | null = null;
        
        if (course?.access_duration_days) {
          const expiryDate = new Date(enrolledAt);
          expiryDate.setDate(expiryDate.getDate() + course.access_duration_days);
          accessExpiresAt = expiryDate.toISOString();
        }

        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: courseId,
          enrollment_source: 'direct',
          status: 'active',
          progress_percentage: 0,
          enrolled_at: enrolledAt.toISOString(),
          access_expires_at: accessExpiresAt,
          total_amount: course?.price || 0,
          amount_paid: 0,
          payment_status: course?.price && course.price > 0 ? 'pending' : 'waived'
        });
        if (error) throw error;

        setSelectedCourses(prev => new Set(prev).add(courseId));
        
        // Create installment invoices for new course assignment
        if (course && course.price && course.price > 0) {
          await createEnrollmentInvoices('course', course.id, course.title, course.price, course.max_installments);
        }
        
        toast({ title: 'Access Granted', description: 'Course access has been added' });
      }

      // Refresh enrollments
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
    } catch (error) {
      console.error('Error updating course access:', error);
      toast({ title: 'Error', description: 'Failed to update course access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePathway = async (pathwayId: string) => {
    const isCurrentlyEnrolled = selectedPathways.has(pathwayId);
    const enrollment = getEnrollmentForPathway(pathwayId);
    const pathway = pathways.find(p => p.id === pathwayId);

    setSaving(true);
    try {
      if (isCurrentlyEnrolled && enrollment) {
        // Terminate access
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedPathways(prev => {
          const next = new Set(prev);
          next.delete(pathwayId);
          return next;
        });
        toast({ title: 'Access Terminated', description: 'Pathway access has been removed' });
      } else if (!isCurrentlyEnrolled && enrollment) {
        // Reactivate existing enrollment
        const { error } = await supabase
          .from('course_enrollments')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', enrollment.id);
        if (error) throw error;

        setSelectedPathways(prev => new Set(prev).add(pathwayId));
        toast({ title: 'Access Granted', description: 'Pathway access has been restored' });
      } else {
        // Create a single pathway enrollment using the first course in the pathway
        const enrolledAt = new Date();
        let accessExpiresAt: string | null = null;

        if (pathway?.access_duration_days) {
          const expiryDate = new Date(enrolledAt);
          expiryDate.setDate(expiryDate.getDate() + pathway.access_duration_days);
          accessExpiresAt = expiryDate.toISOString();
        }

        const pathwayCoursesForThisPathway = pathwayCourses
          .filter(pc => pc.pathway_id === pathwayId)
          .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));

        const firstCourseId = pathwayCoursesForThisPathway[0]?.course_id;

        if (!firstCourseId) {
          toast({ title: 'Warning', description: 'This pathway has no courses assigned', variant: 'destructive' });
          setSaving(false);
          return;
        }

        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: firstCourseId,
          pathway_id: pathwayId,
          enrollment_source: 'pathway',
          status: 'active',
          progress_percentage: 0,
          enrolled_at: enrolledAt.toISOString(),
          access_expires_at: accessExpiresAt,
          total_amount: pathway?.price || 0,
          amount_paid: 0,
          payment_status: pathway?.price && pathway.price > 0 ? 'pending' : 'waived'
        });
        if (error) throw error;

        setSelectedPathways(prev => new Set(prev).add(pathwayId));

        // Create installment invoices for new pathway assignment
        if (pathway && pathway.price && pathway.price > 0) {
          await createEnrollmentInvoices('pathway', pathway.id, pathway.name, pathway.price, pathway.max_installments);
        }

        toast({ title: 'Access Granted', description: 'Pathway access has been added' });
      }

      // Refresh enrollments
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
    } catch (error) {
      console.error('Error updating pathway access:', error);
      toast({ title: 'Error', description: 'Failed to update pathway access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssignCourses = async () => {
    const coursesViaPathway = getCoursesInAssignedPathways();
    // Only assign courses not already covered by an assigned pathway
    const unassignedCourses = courses.filter(c => !selectedCourses.has(c.id) && !coursesViaPathway.has(c.id));
    if (unassignedCourses.length === 0) {
      toast({ title: 'Info', description: 'All assignable courses are already assigned' });
      return;
    }

    setSaving(true);
    try {
      for (const course of unassignedCourses) {
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: course.id,
          enrollment_source: 'direct',
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;
      }

      // Update selected to include newly assigned courses
      setSelectedCourses(prev => {
        const next = new Set(prev);
        unassignedCourses.forEach(c => next.add(c.id));
        return next;
      });
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: `Assigned ${unassignedCourses.length} courses` });
    } catch (error) {
      console.error('Error bulk assigning courses:', error);
      toast({ title: 'Error', description: 'Failed to assign courses', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTerminateCourses = async () => {
    const enrolledCourseEnrollments = enrollments.filter(e => e.course_id && e.status === 'active');
    if (enrolledCourseEnrollments.length === 0) {
      toast({ title: 'Info', description: 'No active course enrollments to terminate' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', enrolledCourseEnrollments.map(e => e.id));
      if (error) throw error;

      setSelectedCourses(new Set());
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All course access terminated' });
    } catch (error) {
      console.error('Error terminating courses:', error);
      toast({ title: 'Error', description: 'Failed to terminate access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssignPathways = async () => {
    const unassignedPathways = pathways.filter(p => !selectedPathways.has(p.id));
    if (unassignedPathways.length === 0) {
      toast({ title: 'Info', description: 'All pathways are already assigned' });
      return;
    }

    setSaving(true);
    try {
      for (const pathway of unassignedPathways) {
        const pathwayCourseList = pathwayCourses
          .filter(pc => pc.pathway_id === pathway.id)
          .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));

        const firstCourseId = pathwayCourseList[0]?.course_id;
        if (!firstCourseId) {
          console.warn('Skipping pathway with no courses:', pathway.id);
          continue;
        }

        const enrolledAt = new Date();
        let accessExpiresAt: string | null = null;
        if (pathway.access_duration_days) {
          const expiryDate = new Date(enrolledAt);
          expiryDate.setDate(expiryDate.getDate() + pathway.access_duration_days);
          accessExpiresAt = expiryDate.toISOString();
        }

        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: firstCourseId,
          pathway_id: pathway.id,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: enrolledAt.toISOString(),
          access_expires_at: accessExpiresAt
        });
        if (error) throw error;
      }

      setSelectedPathways(new Set(pathways.map(p => p.id)));
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: `Assigned ${unassignedPathways.length} pathways` });
    } catch (error) {
      console.error('Error bulk assigning pathways:', error);
      toast({ title: 'Error', description: 'Failed to assign pathways', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTerminatePathways = async () => {
    const enrolledPathwayEnrollments = enrollments.filter(e => e.pathway_id && e.status === 'active');
    if (enrolledPathwayEnrollments.length === 0) {
      toast({ title: 'Info', description: 'No active pathway enrollments to terminate' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .in('id', enrolledPathwayEnrollments.map(e => e.id));
      if (error) throw error;

      setSelectedPathways(new Set());
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All pathway access terminated' });
    } catch (error) {
      console.error('Error terminating pathways:', error);
      toast({ title: 'Error', description: 'Failed to terminate access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkAssignAll = async () => {
    setSaving(true);
    try {
      const coursesViaPathway = getCoursesInAssignedPathways();
      // Only assign courses not covered by assigned pathways
      const unassignedCourses = courses.filter(c => !selectedCourses.has(c.id) && !coursesViaPathway.has(c.id));
      const unassignedPathways = pathways.filter(p => !selectedPathways.has(p.id));

      // Insert assignable courses only
      for (const course of unassignedCourses) {
        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: course.id,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: new Date().toISOString()
        });
        if (error) throw error;
      }

      // Insert pathways
      for (const pathway of unassignedPathways) {
        const pathwayCourseList = pathwayCourses
          .filter(pc => pc.pathway_id === pathway.id)
          .sort((a, b) => (a.step_number ?? 0) - (b.step_number ?? 0));

        const firstCourseId = pathwayCourseList[0]?.course_id;
        if (!firstCourseId) {
          console.warn('Skipping pathway with no courses:', pathway.id);
          continue;
        }

        const enrolledAt = new Date();
        let accessExpiresAt: string | null = null;
        if (pathway.access_duration_days) {
          const expiryDate = new Date(enrolledAt);
          expiryDate.setDate(expiryDate.getDate() + pathway.access_duration_days);
          accessExpiresAt = expiryDate.toISOString();
        }

        const { error } = await supabase.from('course_enrollments').insert({
          student_id: studentId,
          course_id: firstCourseId,
          pathway_id: pathway.id,
          status: 'active',
          progress_percentage: 0,
          enrolled_at: enrolledAt.toISOString(),
          access_expires_at: accessExpiresAt
        });
        if (error) throw error;
      }

      // Update selected courses and pathways
      setSelectedCourses(prev => {
        const next = new Set(prev);
        unassignedCourses.forEach(c => next.add(c.id));
        return next;
      });
      setSelectedPathways(new Set(pathways.map(p => p.id)));
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All access granted' });
    } catch (error) {
      console.error('Error assigning all:', error);
      toast({ title: 'Error', description: 'Failed to grant access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleBulkTerminateAll = async () => {
    const activeEnrollments = enrollments.filter(e => e.status === 'active');
    if (activeEnrollments.length === 0) {
      toast({ title: 'Info', description: 'No active enrollments to terminate' });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('course_enrollments')
        .update({ status: 'inactive', updated_at: new Date().toISOString() })
        .in('id', activeEnrollments.map(e => e.id));
      if (error) throw error;

      setSelectedCourses(new Set());
      setSelectedPathways(new Set());
      const { data } = await supabase.from('course_enrollments').select('*').eq('student_id', studentId);
      setEnrollments(data || []);
      onAccessUpdated?.();
      toast({ title: 'Success', description: 'All access terminated' });
    } catch (error) {
      console.error('Error terminating all:', error);
      toast({ title: 'Error', description: 'Failed to terminate access', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            Manage Access - {studentName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Summary */}
            <div className="flex gap-4 mb-4">
              <Card className="flex-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <BookOpen className="w-8 h-8 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{selectedCourses.size}</p>
                    <p className="text-sm text-muted-foreground">Active Courses</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="p-4 flex items-center gap-3">
                  <Route className="w-8 h-8 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold">{selectedPathways.size}</p>
                    <p className="text-sm text-muted-foreground">Active Pathways</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Bulk Actions */}
            <div className="flex gap-2 mb-4 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkAssignAll}
                disabled={saving}
                className="text-green-600 border-green-300 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Assign All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkTerminateAll}
                disabled={saving}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Terminate All
              </Button>
            </div>

            <Tabs defaultValue="courses" className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="courses" className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Courses ({courses.filter(c => selectedCourses.has(c.id)).length}/{courses.length})
                </TabsTrigger>
                <TabsTrigger value="pathways" className="flex items-center gap-2">
                  <Route className="w-4 h-4" />
                  Pathways ({selectedPathways.size}/{pathways.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="courses" className="flex-1 overflow-hidden mt-4">
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkAssignCourses}
                    disabled={saving}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Assign All Courses
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkTerminateCourses}
                    disabled={saving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Terminate All Courses
                  </Button>
                </div>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {courses.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No courses available</p>
                    ) : (
                      (() => {
                        const coursesViaPathway = getCoursesInAssignedPathways();
                        return courses.map(course => {
                          const isEnrolled = selectedCourses.has(course.id);
                          const pathwayNames = coursesViaPathway.get(course.id);
                          const isViaPathway = !!pathwayNames && pathwayNames.length > 0;
                          
                          return (
                            <div
                              key={course.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                                isViaPathway 
                                  ? 'bg-purple-50 border-purple-200 opacity-80' 
                                  : isEnrolled 
                                    ? 'bg-green-50 border-green-200' 
                                    : 'bg-muted/30 border-border'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <Checkbox
                                  checked={isEnrolled || isViaPathway}
                                  onCheckedChange={() => !isViaPathway && handleToggleCourse(course.id)}
                                  disabled={saving || isViaPathway}
                                />
                                <div>
                                  <p className="font-medium">{course.title}</p>
                                  <div className="flex gap-2 mt-1 flex-wrap">
                                    {course.is_published ? (
                                      <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">Published</Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">Draft</Badge>
                                    )}
                                    {isViaPathway && (
                                      <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                                        Via: {pathwayNames.join(', ')}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              {isViaPathway ? (
                                <Badge variant="secondary" className="text-xs">Included in Pathway</Badge>
                              ) : (
                                <Button
                                  variant={isEnrolled ? "destructive" : "default"}
                                  size="sm"
                                  onClick={() => handleToggleCourse(course.id)}
                                  disabled={saving}
                                >
                                  {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : isEnrolled ? (
                                    <>
                                      <XCircle className="w-4 h-4 mr-1" />
                                      Revoke
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Grant
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="pathways" className="flex-1 overflow-hidden mt-4">
                <div className="flex gap-2 mb-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkAssignPathways}
                    disabled={saving}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Assign All Pathways
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleBulkTerminatePathways}
                    disabled={saving}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Terminate All Pathways
                  </Button>
                </div>
                <ScrollArea className="h-[300px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {pathways.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No pathways available</p>
                    ) : (
                      pathways.map(pathway => {
                        const isEnrolled = selectedPathways.has(pathway.id);
                        return (
                          <div
                            key={pathway.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                              isEnrolled ? 'bg-purple-50 border-purple-200' : 'bg-muted/30 border-border'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={isEnrolled}
                                onCheckedChange={() => handleTogglePathway(pathway.id)}
                                disabled={saving}
                              />
                              <div>
                                <p className="font-medium">{pathway.name}</p>
                                <div className="flex gap-2 mt-1">
                                  {pathway.is_published ? (
                                    <Badge variant="outline" className="text-xs bg-green-100 text-green-700 border-green-200">Published</Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200">Draft</Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant={isEnrolled ? "destructive" : "default"}
                              size="sm"
                              onClick={() => handleTogglePathway(pathway.id)}
                              disabled={saving}
                            >
                              {saving ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isEnrolled ? (
                                <>
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Revoke
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Grant
                                </>
                              )}
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
