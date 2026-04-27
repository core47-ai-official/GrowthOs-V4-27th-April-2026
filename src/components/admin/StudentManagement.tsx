import React from 'react';
import { useState, useEffect } from 'react';
import { safeLogger } from '@/lib/safe-logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus, Edit, Trash2, Users, Activity, DollarSign, Download, CheckCircle, XCircle, Search, Filter, Clock, Ban, ChevronDown, ChevronUp, FileText, Key, Lock, Eye, Settings, Award, CalendarIcon, MessageSquare, Send, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions';
import { useUserManagement } from '@/hooks/useUserManagement';
import { EnhancedStudentCreationDialog } from '@/components/EnhancedStudentCreationDialog';
import { EditStudentDialog } from '@/components/EditStudentDialog';
import { ManageAccessDialog } from '@/components/admin/ManageAccessDialog';
import { SuspensionDialog } from '@/components/SuspensionDialog';
import { StudentNotesDialog } from '@/components/StudentNotesDialog';
import { useAuth } from '@/hooks/useAuth';
import jsPDF from 'jspdf';
import { logAdminAction, ACTIVITY_TYPES } from '@/lib/activity-logger';
import { useScheduledSuspensions } from '@/hooks/useScheduledSuspensions';
import type { SuspensionConfirmData } from '@/components/SuspensionDialog';
interface Student {
  id: string;
  student_id: string;
  student_record_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  lms_user_id: string;
  password_display?: string;
  is_temp_password?: boolean;
  created_at: string;
  last_active_at: string;
  fees_structure: string;
  lms_status: string;
  fees_overdue: boolean;
  last_invoice_date: string;
  last_invoice_sent: boolean;
  fees_due_date: string;
  fees_cleared?: boolean;
}
interface InstallmentPayment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  due_date?: string;
  created_at?: string;
  first_reminder_sent_at?: string | null;
  second_reminder_sent_at?: string | null;
}
interface ActivityLog {
  id: string;
  activity_type: string;
  occurred_at: string;
  metadata: any;
  reference_id: string;
}
const PAGE_SIZE = 25;

export const StudentManagement = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [suspendedStudents, setSuspendedStudents] = useState(0);
  const [overdueStudents, setOverdueStudents] = useState(0);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lmsStatusFilter, setLmsStatusFilter] = useState('all');
  const [feesStructureFilter, setFeesStructureFilter] = useState('all');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [batchOptions, setBatchOptions] = useState<{id: string; name: string}[]>([]);
  const [studentBatchMap, setStudentBatchMap] = useState<Map<string, string[]>>(new Map());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [activityLogsDialog, setActivityLogsDialog] = useState(false);
  const [selectedStudentForLogs, setSelectedStudentForLogs] = useState<Student | null>(null);
  const [statusUpdateDialog, setStatusUpdateDialog] = useState(false);
  const [selectedStudentForStatus, setSelectedStudentForStatus] = useState<Student | null>(null);
  const [newLMSStatus, setNewLMSStatus] = useState('');
  const [installmentPayments, setInstallmentPayments] = useState<Map<string, InstallmentPayment[]>>(new Map());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkActionDialog, setBulkActionDialog] = useState(false);
  const [passwordEditDialog, setPasswordEditDialog] = useState(false);
  const [selectedStudentForPassword, setSelectedStudentForPassword] = useState<Student | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedStudentForEdit, setSelectedStudentForEdit] = useState<Student | null>(null);
  const [manageAccessDialogOpen, setManageAccessDialogOpen] = useState(false);
  const [selectedStudentForAccess, setSelectedStudentForAccess] = useState<Student | null>(null);
  const [passwordType, setPasswordType] = useState<'temp' | 'lms'>('temp');
  const [newPassword, setNewPassword] = useState('');
  const [timeTick, setTimeTick] = useState(0); // triggers periodic re-render for time-based status updates
  const [extensionDate, setExtensionDate] = useState<Date | undefined>(undefined);
  const [extensionPopoverOpen, setExtensionPopoverOpen] = useState<string | null>(null);
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const [studentForSuspension, setStudentForSuspension] = useState<Student | null>(null);
  const [suspensionLoading, setSuspensionLoading] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedStudentForNotes, setSelectedStudentForNotes] = useState<Student | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const { options: installmentOptions } = useInstallmentOptions();
  const { deleteUser, loading: deleteLoading } = useUserManagement();
  const { user } = useAuth();

  const studentIds = students.map(s => s.id);
  const {
    suspensions: scheduledSuspensions,
    createScheduledSuspension,
    cancelScheduledSuspension,
    fetchSuspensions: refetchSuspensions,
  } = useScheduledSuspensions(studentIds);

  useEffect(() => {
    fetchStudents();
    fetchBatchOptions();
  }, []);
  useEffect(() => {
    if (students.length > 0) {
      fetchInstallmentPayments();
    }
  }, [students]);
  useEffect(() => {
    filterStudents();
    setCurrentPage(1); // Reset page when filters change
  }, [searchTerm, lmsStatusFilter, feesStructureFilter, invoiceFilter, batchFilter]);

  useEffect(() => {
    filterStudents();
  }, [students, installmentPayments, timeTick, studentBatchMap]);

  // Re-render periodically so time-based invoice statuses (due/overdue) update without refresh
  useEffect(() => {
    const id = setInterval(() => setTimeTick((t) => t + 1), 60000); // every 60s
    return () => clearInterval(id);
  }, []);

  // Realtime updates for invoices to reflect payments/status changes instantly
  useEffect(() => {
    const channel = supabase
      .channel('realtime-invoices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices' },
        () => {
          fetchInstallmentPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const fetchInstallmentPayments = async () => {
    try {
      // Use invoices table instead of installment_payments for now
      const {
        data,
        error
      } = await supabase
        .from('invoices')
        .select('id, student_id, installment_number, amount, status, due_date, created_at, first_reminder_sent_at, second_reminder_sent_at')
        .order('installment_number', { ascending: true });
      if (error) throw error;

      // Group invoices by student_id and convert to installment payment format
      const paymentsMap = new Map<string, InstallmentPayment[]>();
      data?.forEach(invoice => {
        const payment: InstallmentPayment = {
          id: invoice.id,
          installment_number: invoice.installment_number,
          amount: invoice.amount,
          status: invoice.status,
          due_date: invoice.due_date,
          created_at: invoice.created_at,
          first_reminder_sent_at: invoice.first_reminder_sent_at,
          second_reminder_sent_at: invoice.second_reminder_sent_at,
        };
        const userPayments = paymentsMap.get(invoice.student_id) || [];
        userPayments.push(payment);
        paymentsMap.set(invoice.student_id, userPayments);
      });
      setInstallmentPayments(paymentsMap);
    } catch (error) {
      console.error('Error fetching installment payments:', error);
    }
  };
  const fetchBatchOptions = async () => {
    try {
      const [batchesRes, enrollmentsRes, studentsTableRes] = await Promise.all([
        supabase.from('batches').select('id, name').order('start_date', { ascending: false }),
        supabase.from('course_enrollments').select('student_id, batch_id').not('batch_id', 'is', null),
        supabase.from('students').select('id, user_id')
      ]);
      if (batchesRes.data) setBatchOptions(batchesRes.data);
      if (enrollmentsRes.data && studentsTableRes.data) {
        const recordToUser = new Map<string, string>();
        studentsTableRes.data.forEach((s: any) => recordToUser.set(s.id, s.user_id));
        
        const map = new Map<string, string[]>();
        enrollmentsRes.data.forEach((e: any) => {
          const userId = recordToUser.get(e.student_id);
          if (!userId) return;
          const batches = map.get(userId) || [];
          if (!batches.includes(e.batch_id)) batches.push(e.batch_id);
          map.set(userId, batches);
        });
        setStudentBatchMap(map);
      }
    } catch (error) {
      console.error('Error fetching batch options:', error);
    }
  };
  const fetchStudents = async () => {
    try {
      // Fetch student user_ids from user_roles table, then fetch their data
      const { data: studentRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'student');
      
      if (rolesError) throw rolesError;
      
      const studentUserIds = studentRoles?.map(r => r.user_id) || [];
      
      if (studentUserIds.length === 0) {
        setStudents([]);
        return;
      }

      // Fetch users, students, and invoices in parallel
      const [usersRes, studentsRes, invoicesRes] = await Promise.all([
        supabase
          .from('users')
          .select('id, full_name, email, phone, role, status, lms_status, lms_user_id, password_display, created_at, last_active_at, fees_structure, fees_overdue, last_invoice_date, last_invoice_sent, fees_due_date, last_suspended_date, created_by')
          .in('id', studentUserIds)
          .order('created_at', { ascending: false }),
        supabase.from('students').select('id, user_id, student_id, installment_count, fees_cleared'),
        supabase.from('invoices').select('student_id, status, due_date, amount, created_at')
      ]);
      
      if (usersRes.error) throw usersRes.error;
      if (studentsRes.error) {
        console.warn('Warning fetching students table:', studentsRes.error);
      }
      if (invoicesRes.error) {
        console.warn('Warning fetching invoices:', invoicesRes.error);
      }

      const usersData = usersRes.data || [];
      const studentsTable = studentsRes.data || [];
      const invoicesData = invoicesRes.data || [];

      // Create invoice map grouped by student_id
      const invoiceMap = new Map<string, any[]>();
      invoicesData.forEach((invoice: any) => {
        const existing = invoiceMap.get(invoice.student_id) || [];
        existing.push(invoice);
        invoiceMap.set(invoice.student_id, existing);
      });

      const studentIdMap = new Map<string, {
        student_id: string | null;
        student_record_id: string | null;
        installment_count: number | null;
        fees_cleared: boolean;
      }>(studentsTable.map((s: any) => [s.user_id as string, {
        student_id: s.student_id as string | null,
        student_record_id: s.id as string | null,
        installment_count: s.installment_count as number | null ?? null,
        fees_cleared: s.fees_cleared || false
      }]));

      // Transform User data to Student data with real fees status
      const studentsData: Student[] = usersData.map((user: any) => {
        const mapEntry = studentIdMap.get(user.id);
        const count = mapEntry?.installment_count ?? null;
        const feesStructure = count === 1 ? '1_installment' : count === 2 ? '2_installments' : count === 3 ? '3_installments' : count ? `${count}_installments` : '';
        
        // Get fees_cleared from student record
        const feesCleared = mapEntry?.fees_cleared || false;
        
        // Get invoices for this student (using student_record_id)
        const studentInvoices = invoiceMap.get(mapEntry?.student_record_id || '') || [];
        
        // Calculate fees status
        const today = new Date();
        const pendingInvoices = studentInvoices.filter((inv: any) => inv.status === 'pending');
        const overdueInvoices = pendingInvoices.filter((inv: any) => new Date(inv.due_date) < today);
        
        const fees_overdue = overdueInvoices.length > 0;
        const last_invoice_sent = studentInvoices.length > 0;
        
        // Get most recent invoice date
        const sortedInvoices = [...studentInvoices].sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const last_invoice_date = sortedInvoices[0]?.created_at || '';
        
        // Get earliest due date from pending invoices
        const sortedDueDates = pendingInvoices
          .map((inv: any) => inv.due_date)
          .filter(Boolean)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        const fees_due_date = sortedDueDates[0] || '';

        return {
          ...user,
          student_id: mapEntry?.student_id || '',
          student_record_id: mapEntry?.student_record_id || null,
          phone: user.phone || '',
          password_display: user.password_display || '',
          is_temp_password: user.is_temp_password ?? true,
          fees_structure: feesStructure,
          fees_overdue,
          last_invoice_date,
          last_invoice_sent,
          fees_due_date,
          fees_cleared: feesCleared
        } as Student;
      });
      setStudents(studentsData);
      setTotalStudents(usersData.length || 0);

      // Calculate active students (those who have been active in the last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const activeCount = usersData.filter((student: any) => student.last_active_at && new Date(student.last_active_at) > thirtyDaysAgo).length || 0;
      setActiveStudents(activeCount);

      // Calculate suspended and overdue students
      const suspendedCount = usersData.filter((student: any) => student.lms_status === 'suspended').length || 0;
      const overdueCount = studentsData.filter(student => student.fees_overdue === true).length || 0;
      setSuspendedStudents(suspendedCount);
      setOverdueStudents(overdueCount);
    } catch (error) {
      console.error('Error fetching students:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch students',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const filterStudents = () => {
    let filtered = students;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(student => student.student_id?.toLowerCase().includes(searchTerm.toLowerCase()) || student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || student.email.toLowerCase().includes(searchTerm.toLowerCase()) || student.phone?.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Apply LMS status filter
    if (lmsStatusFilter !== 'all') {
      filtered = filtered.filter(student => student.lms_status === lmsStatusFilter);
    }

    // Apply fees structure filter
    if (feesStructureFilter !== 'all') {
      filtered = filtered.filter(student => student.fees_structure === feesStructureFilter);
    }

    // Apply invoice filter - use same logic as badge display
    if (invoiceFilter !== 'all') {
      filtered = filtered.filter(student => {
        const status = getInvoiceStatus(student);
        if (invoiceFilter === 'fees_cleared') {
          return status === 'Cleared';
        } else if (invoiceFilter === 'fees_due') {
          return status === 'Due';
        } else if (invoiceFilter === 'fees_overdue') {
          return status === 'Overdue';
        } else if (invoiceFilter === 'no_invoice') {
          return status === 'No Invoice';
        }
        return true;
      });
    }
    // Apply batch filter
    if (batchFilter !== 'all') {
      if (batchFilter === 'unassigned') {
        filtered = filtered.filter(student => !studentBatchMap.has(student.id));
      } else {
        filtered = filtered.filter(student => {
          const batches = studentBatchMap.get(student.id) || [];
          return batches.includes(batchFilter);
        });
      }
    }

    setFilteredStudents(filtered);
  };
  const handleViewActivityLogs = async (studentId: string) => {
    try {
      const {
        data,
        error
      } = await supabase.from('user_activity_logs').select('*').eq('user_id', studentId).order('occurred_at', {
        ascending: false
      });
      if (error) throw error;
      setActivityLogs(data || []);
      setSelectedStudentForLogs(students.find(s => s.id === studentId) || null);
      setActivityLogsDialog(true);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive'
      });
    }
  };
  const handleStatusUpdate = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (student) {
      setSelectedStudentForStatus(student);
      setNewLMSStatus(student.lms_status || 'inactive');
      setStatusUpdateDialog(true);
    }
  };
  const saveStatusUpdate = async () => {
    if (!selectedStudentForStatus) return;
    
    const oldStatus = selectedStudentForStatus.lms_status;
    
    // Optimistic UI update
    setStudents(prev => prev.map(s => 
      s.id === selectedStudentForStatus.id ? { ...s, lms_status: newLMSStatus } : s
    ));
    
    try {
      const {
        error
      } = await supabase.from('users').update({
        lms_status: newLMSStatus,
        updated_at: new Date().toISOString()
      }).eq('id', selectedStudentForStatus.id);
      if (error) throw error;
      
      // Log LMS status change
      logAdminAction({
        performedBy: user?.id || null,
        targetUserId: selectedStudentForStatus.id,
        entityType: 'user',
        entityId: selectedStudentForStatus.id,
        action: ACTIVITY_TYPES.LMS_STATUS_CHANGED,
        description: `LMS status changed from ${oldStatus} to ${newLMSStatus}`,
        data: { old_status: oldStatus, new_status: newLMSStatus, student_name: selectedStudentForStatus.full_name }
      });

      // Close dialog first
      setStatusUpdateDialog(false);
      
      // Wait for fetchStudents to complete
      await fetchStudents();
      
      toast({
        title: 'Success',
        description: 'LMS status updated successfully'
      });
    } catch (error) {
      console.error('Error updating LMS status:', error);
      
      // Rollback optimistic update
      setStudents(prev => prev.map(s => 
        s.id === selectedStudentForStatus.id ? { ...s, lms_status: oldStatus } : s
      ));
      
      toast({
        title: 'Error',
        description: 'Failed to update LMS status',
        variant: 'destructive'
      });
    }
  };
  const handleToggleLMSSuspension = async (student: Student) => {
    if (student.lms_status === 'suspended') {
      // Unsuspend directly
      setStudents(prev => prev.map(s => 
        s.id === student.id ? { ...s, lms_status: 'active' } : s
      ));
      try {
        const { error } = await supabase.from('users').update({
          lms_status: 'active',
          updated_at: new Date().toISOString()
        }).eq('id', student.id);
        if (error) throw error;
        // Log unsuspension
        logAdminAction({
          performedBy: user?.id || null,
          targetUserId: student.id,
          entityType: 'user',
          entityId: student.id,
          action: ACTIVITY_TYPES.LMS_ACTIVATED,
          description: `LMS account activated (unsuspended)`,
          data: { student_name: student.full_name }
        });
        await fetchStudents();
        toast({ title: 'Success', description: 'LMS account activated successfully' });
      } catch (error) {
        console.error('Error updating LMS suspension status:', error);
        setStudents(prev => prev.map(s => 
          s.id === student.id ? { ...s, lms_status: 'suspended' } : s
        ));
        toast({ title: 'Error', description: 'Failed to update LMS suspension status', variant: 'destructive' });
      }
    } else {
      // Open suspension dialog
      setStudentForSuspension(student);
      setSuspensionDialogOpen(true);
    }
  };

  const handleSuspendStudent = async (data: SuspensionConfirmData) => {
    if (!studentForSuspension) return;
    setSuspensionLoading(true);
    try {
      // If a schedule date is set, create a scheduled suspension instead of immediate
      if (data.scheduleSuspendDate) {
        const { error } = await createScheduledSuspension({
          userId: studentForSuspension.id,
          scheduleSuspendDate: data.scheduleSuspendDate,
          reason: data.note,
          autoUnsuspendDate: data.autoUnsuspendDate,
          createdBy: user?.id || null,
        });
        if (error) throw error;

        logAdminAction({
          performedBy: user?.id || null,
          targetUserId: studentForSuspension.id,
          entityType: 'user',
          entityId: studentForSuspension.id,
          action: 'scheduled_suspension_created',
          description: `Scheduled suspension for ${studentForSuspension.full_name} on ${format(data.scheduleSuspendDate, 'PPP')}`,
          data: {
            suspension_note: data.note || null,
            schedule_suspend_date: data.scheduleSuspendDate.toISOString(),
            auto_unsuspend_date: data.autoUnsuspendDate?.toISOString() || null,
            student_name: studentForSuspension.full_name
          }
        });

        toast({
          title: 'Suspension Scheduled',
          description: `${studentForSuspension.full_name} will be suspended on ${format(data.scheduleSuspendDate, 'PPP')}`
        });
        setSuspensionDialogOpen(false);
        setStudentForSuspension(null);
        refetchSuspensions(studentIds);
        return;
      }

      // Immediate suspension
      const { error } = await supabase.from('users').update({
        lms_status: 'suspended',
        updated_at: new Date().toISOString()
      }).eq('id', studentForSuspension.id);
      if (error) throw error;

      await supabase.from('user_activity_logs').insert({
        user_id: studentForSuspension.id,
        activity_type: 'lms_suspended',
        occurred_at: new Date().toISOString(),
        metadata: {
          suspension_note: data.note || null,
          auto_unsuspend_date: data.autoUnsuspendDate ? data.autoUnsuspendDate.toISOString() : null,
          suspended_by: user?.id || null
        }
      });

      logAdminAction({
        performedBy: user?.id || null,
        targetUserId: studentForSuspension.id,
        entityType: 'user',
        entityId: studentForSuspension.id,
        action: ACTIVITY_TYPES.LMS_SUSPENDED,
        description: `Student suspended: ${studentForSuspension.full_name}`,
        data: {
          suspension_note: data.note || null,
          auto_unsuspend_date: data.autoUnsuspendDate ? data.autoUnsuspendDate.toISOString() : null,
          student_name: studentForSuspension.full_name
        }
      });

      toast({
        title: 'Student Suspended',
        description: `${studentForSuspension.full_name} has been suspended${data.autoUnsuspendDate ? `. Auto-unsuspend: ${format(data.autoUnsuspendDate, 'PPP')}` : ''}`
      });
      setSuspensionDialogOpen(false);
      setStudentForSuspension(null);
      fetchStudents();
    } catch (error) {
      console.error('Error suspending student:', error);
      toast({ title: 'Error', description: 'Failed to suspend student', variant: 'destructive' });
    } finally {
      setSuspensionLoading(false);
    }
  };

  const handleCancelScheduledSuspension = async (student: Student) => {
    try {
      const { error } = await cancelScheduledSuspension(student.id);
      if (error) throw error;

      logAdminAction({
        performedBy: user?.id || null,
        targetUserId: student.id,
        entityType: 'user',
        entityId: student.id,
        action: 'scheduled_suspension_cancelled',
        description: `Scheduled suspension cancelled for ${student.full_name}`,
        data: { student_name: student.full_name }
      });

      toast({
        title: 'Scheduled Suspension Cancelled',
        description: `Scheduled suspension for ${student.full_name} has been cancelled.`
      });
    } catch (error) {
      console.error('Error cancelling scheduled suspension:', error);
      toast({ title: 'Error', description: 'Failed to cancel scheduled suspension', variant: 'destructive' });
    }
  };

  const grantExtension = async (student: Student, newDueDate: Date) => {
    try {
      if (!student.student_record_id) {
        toast({
          title: 'Error',
          description: 'No student record found',
          variant: 'destructive'
        });
        return;
      }

      // Find the earliest unpaid invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('student_id', student.student_record_id)
        .neq('status', 'paid')
        .order('due_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (invoiceError) throw invoiceError;

      if (!invoice) {
        toast({
          title: 'No Invoice Found',
          description: 'No unpaid invoice to extend',
          variant: 'destructive'
        });
        return;
      }

      // Update extended_due_date
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          extended_due_date: newDueDate.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      // If LMS was suspended, reactivate it
      if (student.lms_status === 'suspended') {
        const { error: lmsError } = await supabase
          .from('users')
          .update({
            lms_status: 'active',
            updated_at: new Date().toISOString()
          })
          .eq('id', student.id);

        if (lmsError) throw lmsError;
      }

      // Send notification to student
      await supabase.rpc('create_notification', {
        p_user_id: student.id,
        p_type: 'fee_extension',
        p_title: 'Payment Extension Granted',
        p_message: `Your payment due date has been extended to ${format(newDueDate, 'PPP')}.`,
        p_metadata: {
          invoice_id: invoice.id,
          new_due_date: newDueDate.toISOString(),
          installment_number: invoice.installment_number
        }
      });

      toast({
        title: 'Extension Granted',
        description: `Due date extended to ${format(newDueDate, 'PPP')}${student.lms_status === 'suspended' ? ' and LMS reactivated' : ''}.`
      });

      setExtensionPopoverOpen(null);
      setExtensionDate(undefined);
      fetchStudents();
      fetchInstallmentPayments();
    } catch (error) {
      console.error('Error granting extension:', error);
      toast({
        title: 'Error',
        description: 'Failed to grant extension',
        variant: 'destructive'
      });
    }
  };

  const generateInvoice = async (studentId: string) => {
    try {
      const {
        error
      } = await supabase.from('users').update({
        updated_at: new Date().toISOString()
      }).eq('id', studentId);
      if (error) throw error;
      toast({
        title: 'Success',
        description: 'Invoice generated and sent'
      });
      fetchStudents();
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate invoice',
        variant: 'destructive'
      });
    }
  };
  const handleResendInvoice = async (student: Student) => {
    try {
      const { data, error } = await supabase.functions.invoke('resend-invoice', {
        body: { student_ids: [student.id] }
      });
      if (error) throw error;

      const hasFailures = data?.failed > 0;
      if (data?.no_unpaid_invoice === 1 && data?.sent === 0) {
        toast({ title: 'No Invoice Found', description: 'This student has no unpaid invoices to resend.', variant: 'destructive' });
        return;
      }
      toast({
        title: hasFailures ? 'Invoice Resend Failed' : 'Success',
        description: data?.errors?.length
          ? `Errors: ${data.errors.join('; ')}`
          : data?.message || 'Invoice resent successfully.',
        variant: hasFailures ? 'destructive' : 'default',
      });

      if (!hasFailures) {
        logAdminAction({
          performedBy: user?.id || null,
          targetUserId: student.id,
          entityType: 'invoice',
          action: ACTIVITY_TYPES.INVOICE_RESENT,
          description: `Invoice resent to ${student.full_name || student.email}`,
          data: { student_email: student.email, student_name: student.full_name }
        });
      }
    } catch (e: any) {
      console.error('Error resending invoice:', e);
      toast({ title: 'Error', description: e?.message || 'Failed to resend invoice', variant: 'destructive' });
    }
  };

  const downloadInvoicePDF = (student: Student) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('Invoice', 20, 20);
    doc.setFontSize(12);
    doc.text(`Student ID: ${student.student_id}`, 20, 40);
    doc.text(`Name: ${student.full_name}`, 20, 50);
    doc.text(`Email: ${student.email}`, 20, 60);
    doc.text(`Fees Structure: ${student.fees_structure?.replace('_', ' ').toUpperCase()}`, 20, 70);
    doc.text(`Invoice Date: ${student.last_invoice_date ? formatDate(student.last_invoice_date) : 'N/A'}`, 20, 80);
    doc.text(`Due Date: ${student.fees_due_date ? formatDate(student.fees_due_date) : 'N/A'}`, 20, 90);
    doc.save(`invoice_${student.student_id}.pdf`);
  };
  const handleMarkInstallmentPaid = async (studentId: string, installmentNumber: number) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      
      if (!student.student_record_id) {
        toast({
          title: 'Error',
          description: 'Cannot record payment: missing student record',
          variant: 'destructive'
        });
        return;
      }

      console.log(`Marking installment ${installmentNumber} as paid for student:`, student.student_record_id);

      // Call the mark-invoice-paid edge function
      const { data, error } = await supabase.functions.invoke('mark-invoice-paid', {
        body: {
          student_id: student.student_record_id,
          installment_number: installmentNumber,
          amount: 100,
          due_date: new Date().toISOString()
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Edge function call failed');
      }

      if (!data?.success) {
        console.error('Payment failed:', data?.error);
        throw new Error(data?.error || 'Failed to process payment');
      }

      console.log('Payment processed successfully:', data);

      toast({
        title: 'Success',
        description: `Installment ${installmentNumber} marked as paid and account activated`
      });

      // Refresh data
      await fetchStudents();
      await fetchInstallmentPayments();
    } catch (error: any) {
      console.error('Error marking installment as paid:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to mark installment as paid',
        variant: 'destructive'
      });
    }
  };
  const handleDeleteStudent = async (studentId: string, studentName: string) => {
    const success = await deleteUser(studentId);
    if (success) {
      toast({
        title: 'Success',
        description: `${studentName} has been deleted successfully`
      });
      fetchStudents();
    }
  };
  const getLMSStatusColor = (lmsStatus: string) => {
    switch (lmsStatus) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'dropout':
        return 'bg-orange-100 text-orange-800';
      case 'complete':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  const getLMSStatusIcon = (lmsStatus: string) => {
    switch (lmsStatus) {
      case 'active':
        return <CheckCircle className="w-3 h-3 mr-1" />;
      case 'inactive':
        return <Clock className="w-3 h-3 mr-1" />;
      case 'suspended':
        return <Ban className="w-3 h-3 mr-1" />;
      case 'dropout':
        return <XCircle className="w-3 h-3 mr-1" />;
      case 'complete':
        return <Award className="w-3 h-3 mr-1" />;
      default:
        return <Clock className="w-3 h-3 mr-1" />;
    }
  };
  const getLMSStatusLabel = (lmsStatus: string) => {
    switch (lmsStatus) {
      case 'active':
        return 'Active';
      case 'inactive':
        return 'Inactive';
      case 'suspended':
        return 'Suspended';
      case 'dropout':
        return 'Dropout';
      case 'complete':
        return 'Complete';
      default:
        return 'Unknown';
    }
  };
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const getLastInvoiceSentDate = (student: Student): string => {
    const payments = installmentPayments.get(student.student_record_id || '') || [];
    const now = Date.now();

    const timestamps: number[] = [];
    payments.forEach((p) => {
      const c = p.created_at ? new Date(p.created_at).getTime() : NaN;
      const r1 = p.first_reminder_sent_at ? new Date(p.first_reminder_sent_at).getTime() : NaN;
      const r2 = p.second_reminder_sent_at ? new Date(p.second_reminder_sent_at).getTime() : NaN;
      [c, r1, r2].forEach((t) => {
        if (!Number.isNaN(t) && t <= now) timestamps.push(t);
      });
    });

    if (timestamps.length) {
      const latest = new Date(Math.max(...timestamps)).toISOString();
      return latest;
    }

    // Fallback to student.last_invoice_date if present
    return student.last_invoice_date || '';
  };
  const formatActivityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };
  const getStudentInvoices = (student: Student): InstallmentPayment[] =>
    installmentPayments.get(student.student_record_id || '') || [];

  const getNextInvoiceDueDate = (student: Student): string => {
    const payments = getStudentInvoices(student);
    const now = new Date().getTime();

    // 1) Next upcoming unpaid invoice (earliest due_date in the future)
    const upcoming = payments
      .filter(p => p.status !== 'paid' && p.due_date)
      .map(p => ({ p, t: new Date(p.due_date as string).getTime() }))
      .filter(({ t }) => !Number.isNaN(t) && t >= now)
      .sort((a, b) => a.t - b.t);
    if (upcoming.length) return upcoming[0].p.due_date as string;

    // 2) If none in the future, pick earliest unpaid (overdue)
    const overdue = payments
      .filter(p => p.status !== 'paid' && p.due_date)
      .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());
    if (overdue.length) return overdue[0].due_date as string;

    // 3) Fallback: earliest due date
    const any = payments
      .filter(p => p.due_date)
      .sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());
    return any[0]?.due_date || '';
  };
  const getLastInvoiceStatus = (student: Student): string => {
    const payments = getStudentInvoices(student);
    if (!payments.length) return 'No Invoice';

    const sorted = payments
      .map(p => ({ p, t: new Date((p.created_at || p.due_date || '') as string).getTime() }))
      .filter(({ t }) => !Number.isNaN(t))
      .sort((a, b) => b.t - a.t);

    const last = sorted[0]?.p;
    if (!last) return 'No Invoice';

    const status = last.status || 'no_invoice';
    return status.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
  };
  const parseInstallmentCount = (structure?: string): number => {
    if (!structure) return 0;
    if (structure.startsWith('1_')) return 1;
    if (structure.startsWith('2_')) return 2;
    if (structure.startsWith('3_')) return 3;
    const m = structure.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const getFeesStructureLabelFromCount = (count: number) => count ? `${count} ${count === 1 ? 'Installment' : 'Installments'}` : 'N/A';
  const getDisplayFeesStructureLabel = (student: Student) => {
    const payments = installmentPayments.get(student.student_record_id || '') || [];
    const byInvoices = payments.length ? Math.max(...payments.map(p => p.installment_number)) : 0;
    const byStructure = parseInstallmentCount(student.fees_structure);
    const count = byInvoices || byStructure;
    return getFeesStructureLabelFromCount(count);
  };
  const getInvoiceStatus = (student: Student) => {
    const payments = getStudentInvoices(student);
    if (!payments.length) return 'No Invoice';
    const now = Date.now();
    const unpaid = payments.filter(p => p.status !== 'paid');
    if (unpaid.length === 0) return 'Cleared';
    const anyOverdue = unpaid.some(p => p.due_date && new Date(p.due_date as string).getTime() < now);
    if (anyOverdue) return 'Overdue';
    return 'Due';
  };
  const getInstallmentStatus = (student: Student) => {
    const payments = installmentPayments.get(student.student_record_id || '') || [];
    const totalInstallments = student.fees_structure === '2_installments' ? 2 : student.fees_structure === '3_installments' ? 3 : 1;

    // If we have no payments, color by overall invoice status
    if (payments.length === 0) {
      const status = getInvoiceStatus(student);
      const color =
        status === 'Cleared'
          ? 'bg-green-100 text-green-800'
          : status === 'Overdue'
          ? 'bg-red-100 text-red-800'
          : status === 'Due'
          ? 'bg-yellow-100 text-yellow-800'
          : 'bg-gray-100 text-gray-800';

      return { status, color };
    }

    const paidPayments = payments.filter(p => p.status === 'paid');

    // All installments paid => Cleared (green)
    if (paidPayments.length === totalInstallments) {
      return {
        status: 'Fees Cleared',
        color: 'bg-green-100 text-green-800'
      };
    } else if (paidPayments.length > 0) {
      // Partially paid – keep existing blue style
      const ordinalSuffix = (n: number) => {
        const j = n % 10;
        const k = n % 100;
        if (j === 1 && k !== 11) return `${n}st`;
        if (j === 2 && k !== 12) return `${n}nd`;
        if (j === 3 && k !== 13) return `${n}rd`;
        return `${n}th`;
      };
      return {
        status: `${ordinalSuffix(paidPayments.length)} Installment Paid`,
        color: 'bg-blue-100 text-blue-800'
      };
    }

    // Unpaid – color by invoice status
    const status = getInvoiceStatus(student);
    const color =
      status === 'Cleared'
        ? 'bg-green-100 text-green-800'
        : status === 'Overdue'
        ? 'bg-red-100 text-red-800'
        : status === 'Due'
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-orange-100 text-orange-800';

    return { status, color };
  };
  const toggleRowExpansion = (studentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(studentId)) {
      newExpanded.delete(studentId);
    } else {
      newExpanded.add(studentId);
    }
    setExpandedRows(newExpanded);
  };
  const handleSelectStudent = (studentId: string, checked: boolean) => {
    const newSelected = new Set(selectedStudents);
    if (checked) {
      newSelected.add(studentId);
    } else {
      newSelected.delete(studentId);
    }
    setSelectedStudents(newSelected);
  };
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(new Set(paginatedStudents.map(s => s.id)));
    } else {
      setSelectedStudents(new Set());
    }
  };
  const [bulkResendLoading, setBulkResendLoading] = useState(false);
  const handleBulkResendInvoice = async () => {
    if (selectedStudents.size === 0) {
      toast({ title: 'Error', description: 'Please select at least one student', variant: 'destructive' });
      return;
    }
    setBulkResendLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('resend-invoice', {
        body: { student_ids: Array.from(selectedStudents) }
      });
      if (error) throw error;
      const hasFailures = data?.failed > 0;
      toast({
        title: hasFailures ? 'Invoice Resend - Some Failed' : 'Invoice Resend Complete',
        description: data?.errors?.length
          ? `${data.message}\nErrors: ${data.errors.join('; ')}`
          : data?.message || `Sent ${data?.sent || 0} invoice(s)`,
        variant: hasFailures ? 'destructive' : 'default',
      });
      // Log each successful resend
      if (data?.sent > 0) {
        Array.from(selectedStudents).forEach(studentId => {
          const student = displayStudents.find(s => s.id === studentId);
          if (student) {
            logAdminAction({
              performedBy: user?.id || null,
              targetUserId: studentId,
              entityType: 'invoice',
              action: ACTIVITY_TYPES.INVOICE_RESENT,
              description: `Invoice resent to ${student.full_name || student.email}`,
              data: { student_email: student.email, student_name: student.full_name, bulk: true }
            });
          }
        });
      }
      setSelectedStudents(new Set());
    } catch (error: any) {
      console.error('Error resending invoices:', error);
      toast({ title: 'Error', description: error?.message || 'Failed to resend invoices', variant: 'destructive' });
    } finally {
      setBulkResendLoading(false);
    }
  };
  const handleBulkLMSAction = async (action: 'suspend' | 'activate') => {
    if (selectedStudents.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one student',
        variant: 'destructive'
      });
      return;
    }
    try {
      const lms_status = action === 'suspend' ? 'suspended' : 'active';
      const {
        error
      } = await supabase.from('users').update({
        lms_status
      }).in('id', Array.from(selectedStudents));
      if (error) throw error;
      toast({
        title: 'Success',
        description: `${selectedStudents.size} student(s) ${action === 'suspend' ? 'suspended' : 'activated'} successfully`
      });
      setSelectedStudents(new Set());
      setBulkActionDialog(false);
      fetchStudents();
    } catch (error) {
      console.error('Error updating bulk LMS status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update LMS status',
        variant: 'destructive'
      });
    }
  };
  const handleEditPassword = (student: Student, type: 'temp' | 'lms') => {
    // Password functionality removed for security
    toast({
      title: "Information",
      description: "Password management has been moved to secure encrypted storage",
      variant: "default"
    });
  };
  const handleUpdatePassword = async () => {
    if (!selectedStudentForPassword || !newPassword.trim()) {
      toast({
        title: "Error",
        description: "Please enter a password",
        variant: "destructive"
      });
      return;
    }
    try {
      const updateField = passwordType === 'temp' ? 'temp_password' : 'lms_password';
      const passwordUpdate = passwordType === 'temp'
        ? { password_display: newPassword, is_temp_password: true, updated_at: new Date().toISOString() }
        : { password_display: newPassword, is_temp_password: false, updated_at: new Date().toISOString() };
      const {
        error
      } = await supabase.from('users').update(passwordUpdate).eq('id', selectedStudentForPassword.id);
      if (error) throw error;
      toast({
        title: "Success",
        description: `${passwordType === 'temp' ? 'Temporary' : 'LMS'} password updated successfully`
      });
      setPasswordEditDialog(false);
      setNewPassword('');
      setSelectedStudentForPassword(null);
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update password: " + error.message,
        variant: "destructive"
      });
    }
  };
  const handleExportCSV = async () => {
    const batchNameMap = new Map(batchOptions.map(b => [b.id, b.name]));

    const studentIds = displayStudents.map(s => s.id);
    const studentRecordIds = displayStudents.map(s => s.student_record_id).filter(Boolean) as string[];

    // Parallel fetch: activity logs, recordings watched, enrollments, courses, pathways
    const [logsRes, recordingsRes, enrollmentsRes, coursesRes, pathwaysRes] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('user_activity_logs').select('user_id, activity_type, metadata, occurred_at').in('user_id', studentIds).order('occurred_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      studentRecordIds.length > 0
        ? (supabase as any).from('student_recordings').select('student_id').in('student_id', studentRecordIds)
        : Promise.resolve({ data: [] }),
      studentRecordIds.length > 0
        ? supabase.from('course_enrollments').select('student_id, course_id, pathway_id, batch_id, status').in('student_id', studentRecordIds).eq('status', 'active')
        : Promise.resolve({ data: [] }),
      supabase.from('courses').select('id, title'),
      (supabase as any).from('pathways').select('id, name'),
    ]);

    const allLogs = logsRes.data || [];
    const allRecordings = recordingsRes.data || [];
    const allEnrollments = enrollmentsRes.data || [];
    const courseNameMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c.title]));
    const pathwayNameMap = new Map((pathwaysRes.data || []).map((p: any) => [p.id, p.name]));

    // Group data by student
    const logsByStudent = new Map<string, any[]>();
    allLogs.forEach((log: any) => {
      const list = logsByStudent.get(log.user_id) || [];
      list.push(log);
      logsByStudent.set(log.user_id, list);
    });

    const recordingCountByStudent = new Map<string, number>();
    allRecordings.forEach((r: any) => {
      recordingCountByStudent.set(r.student_id, (recordingCountByStudent.get(r.student_id) || 0) + 1);
    });

    const enrollmentsByStudent = new Map<string, any[]>();
    allEnrollments.forEach((e: any) => {
      const list = enrollmentsByStudent.get(e.student_id) || [];
      list.push(e);
      enrollmentsByStudent.set(e.student_id, list);
    });

    const escCsv = (val: string) => `"${String(val || '').replace(/"/g, '""')}"`;

    const rows = displayStudents.map(student => {
      const key = String(student.student_record_id || '');
      const payments = installmentPayments.get(key) || [];
      const totalFees = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
      const remainingAmount = totalFees - paidAmount;
      const installmentCount = payments.length || '';
      const batchIds = studentBatchMap.get(student.id) || [];
      const batchNames = batchIds.map(id => batchNameMap.get(id) || id).join('; ');

      // Invoice details
      const latestInvoice = payments.length > 0 ? payments[payments.length - 1] : null;
      const invoiceStatus = latestInvoice ? latestInvoice.status : 'No Invoice';
      const invoiceDueDate = latestInvoice?.due_date || '';

      // Recordings watched
      const recordingsWatched = recordingCountByStudent.get(key) || 0;

      // Course/Pathway access
      const enrollments = enrollmentsByStudent.get(key) || [];
      const courseAccess = enrollments
        .filter((e: any) => e.course_id && !e.pathway_id)
        .map((e: any) => courseNameMap.get(e.course_id) || e.course_id)
        .join('; ');
      const pathwayAccess = enrollments
        .filter((e: any) => e.pathway_id)
        .map((e: any) => pathwayNameMap.get(e.pathway_id) || e.pathway_id)
        .join('; ');

      // Notes
      const studentLogs = logsByStudent.get(student.id) || [];
      const notesSummary = studentLogs
        .filter((l: any) => l.activity_type === 'admin_note')
        .map((log: any) => {
          const meta = log.metadata as any || {};
          const ts = log.occurred_at ? new Date(log.occurred_at).toISOString().split('T')[0] : '';
          return `[${ts}] ${meta.note || ''}`;
        }).join(' | ');

      return [
        escCsv(student.student_id || ''),
        escCsv(student.full_name || ''),
        escCsv(student.email || ''),
        escCsv(student.phone || ''),
        escCsv(String(installmentCount)),
        escCsv(student.lms_status || ''),
        escCsv(student.created_at ? new Date(student.created_at).toISOString().split('T')[0] : ''),
        escCsv(String(totalFees)),
        escCsv(String(paidAmount)),
        escCsv(String(remainingAmount)),
        escCsv(invoiceStatus),
        escCsv(invoiceDueDate),
        escCsv(student.lms_user_id || ''),
        escCsv(student.password_display || ''),
        escCsv(String(recordingsWatched)),
        escCsv(courseAccess || 'None'),
        escCsv(pathwayAccess || 'None'),
        escCsv(batchNames || 'Unassigned'),
        escCsv(notesSummary),
      ].join(',');
    });

    const header = 'Student ID,Name,Email,Phone,Installments,LMS Status,Joining Date,Total Fee Amount,Total Paid,Remaining to Pay,Invoice Status,Invoice Due Date,LMS ID,LMS Password,Recordings Watched,Course Access,Pathway Access,Batch,Admin Notes';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export Complete', description: `Exported ${displayStudents.length} students with all details to CSV` });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-muted-foreground">Loading students...</span>
      </div>;
  }
  const hasActiveFilters = Boolean(
    searchTerm ||
    lmsStatusFilter !== 'all' ||
    feesStructureFilter !== 'all' ||
    invoiceFilter !== 'all' ||
    batchFilter !== 'all'
  );
  const displayStudents = hasActiveFilters ? filteredStudents : students;
  const totalPages = Math.max(1, Math.ceil(displayStudents.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStudents = displayStudents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const getPaginationRange = () => {
    const range: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) range.push(i);
    } else {
      range.push(1);
      if (safePage > 3) range.push('...');
      for (let i = Math.max(2, safePage - 1); i <= Math.min(totalPages - 1, safePage + 1); i++) range.push(i);
      if (safePage < totalPages - 2) range.push('...');
      range.push(totalPages);
    }
    return range;
  };

  return <div className="space-y-6 animate-fade-in px-0 mx-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="animate-fade-in">
          <h1 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            👥 Students Management
          </h1>
          <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-lg">Manage student records and track their progress</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={handleExportCSV} className="hover-scale animate-scale-in flex-1 sm:flex-none" size="sm">
            <Download className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="hover-scale bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 animate-scale-in flex-1 sm:flex-none" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Add Student</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
        <EnhancedStudentCreationDialog 
          open={isDialogOpen} 
          onOpenChange={setIsDialogOpen}
          onStudentCreated={fetchStudents}
        />
        <EditStudentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          student={selectedStudentForEdit}
          onStudentUpdated={fetchStudents}
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-blue-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Students</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{totalStudents}</div>
            <p className="text-xs text-muted-foreground">All enrolled</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Active Students</CardTitle>
            <Activity className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{activeStudents}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-yellow-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Suspended</CardTitle>
            <Ban className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-900">{suspendedStudents}</div>
            <p className="text-xs text-muted-foreground">LMS suspended</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-red-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Fees Overdue</CardTitle>
            <Clock className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">{overdueStudents}</div>
            <p className="text-xs text-muted-foreground">Payment due</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-purple-50 to-white animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Engagement</CardTitle>
            <DollarSign className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">
              {totalStudents > 0 ? Math.round(activeStudents / totalStudents * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Activity rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by ID, name, email, or phone..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>

        <Select value={lmsStatusFilter} onValueChange={setLmsStatusFilter}>
          <SelectTrigger className="w-32 sm:w-40">
            <SelectValue placeholder="LMS Status" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All LMS Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="dropout">Dropout</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
          </SelectContent>
        </Select>

        <Select value={feesStructureFilter} onValueChange={setFeesStructureFilter}>
          <SelectTrigger className="w-32 sm:w-40">
            <SelectValue placeholder="Fees Structure" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All Installments</SelectItem>
            {installmentOptions.map(option => <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
          <SelectTrigger className="w-32 sm:w-40">
            <SelectValue placeholder="Invoice Status" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All Fees Status</SelectItem>
            <SelectItem value="fees_cleared">Fees Cleared</SelectItem>
            <SelectItem value="fees_due">Fees Due</SelectItem>
            <SelectItem value="fees_overdue">Fees Overdue</SelectItem>
            <SelectItem value="no_invoice">No Invoice</SelectItem>
          </SelectContent>
        </Select>

        <Select value={batchFilter} onValueChange={setBatchFilter}>
          <SelectTrigger className="w-32 sm:w-40">
            <SelectValue placeholder="Batch" />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">All Batches</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {batchOptions.map(batch => (
              <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions */}
      {selectedStudents.size > 0 && <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-800">
                  {selectedStudents.size} student(s) selected
                </span>
                <Button variant="outline" size="sm" onClick={() => setSelectedStudents(new Set())} className="text-blue-600 border-blue-300 hover:bg-blue-100">
                  Clear Selection
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkResendInvoice} disabled={bulkResendLoading} className="text-blue-600 border-blue-300 hover:bg-blue-50">
                  <Send className="w-4 h-4 mr-2" />
                  {bulkResendLoading ? 'Sending...' : 'Resend Invoice'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkLMSAction('suspend')} className="text-red-600 border-red-300 hover:bg-red-50">
                  <Ban className="w-4 h-4 mr-2" />
                  Suspend
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleBulkLMSAction('activate')} className="text-green-600 border-green-300 hover:bg-green-50">
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Activate
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>}

      {/* Students Table */}
      <Card className="animate-fade-in w-full">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50 border-b">
          <CardTitle className="flex items-center text-xl">
            <Users className="w-5 h-5 mr-2 text-blue-600" />
            Students Directory ({displayStudents.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="w-full min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={selectedStudents.size === paginatedStudents.length && paginatedStudents.length > 0} onCheckedChange={handleSelectAll} />
                </TableHead>
                <TableHead className="w-[100px]">Student ID</TableHead>
                <TableHead className="min-w-[120px]">Name</TableHead>
                <TableHead className="min-w-[180px]">Email</TableHead>
                <TableHead className="w-[130px]">Phone</TableHead>
                <TableHead className="w-[120px]">Fees Structure</TableHead>
                <TableHead className="min-w-[180px]">LMS Status</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
              <TableBody>
                {hasActiveFilters && displayStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-12">
                      <div className="flex flex-col items-center space-y-2">
                        <p className="text-muted-foreground text-lg">No students match the selected filters</p>
                        <p className="text-sm text-muted-foreground">Try adjusting your search or filter criteria</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStudents.map(student => [
                    <TableRow key={student.id}>
                      <TableCell>
                        <Checkbox checked={selectedStudents.has(student.id)} onCheckedChange={checked => handleSelectStudent(student.id, checked as boolean)} />
                      </TableCell>
                      <TableCell className="font-medium">{student.student_id}</TableCell>
                      <TableCell>{student.full_name}</TableCell>
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.phone || 'N/A'}</TableCell>
                       <TableCell>{getDisplayFeesStructureLabel(student)}</TableCell>
                        <TableCell>
                           <div className="flex flex-wrap gap-2">
                             <Badge className={getLMSStatusColor(student.lms_status)}>
                               {getLMSStatusIcon(student.lms_status)}
                               {getLMSStatusLabel(student.lms_status)}
                             </Badge>
                             {scheduledSuspensions.has(student.id) && (
                               <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 cursor-pointer" onClick={() => handleCancelScheduledSuspension(student)} title={`Scheduled: ${new Date(scheduledSuspensions.get(student.id)!.schedule_suspend_date).toLocaleDateString()}. Click to cancel.`}>
                                 <Clock className="w-3 h-3 mr-1" />
                                 <span className="text-xs">Suspend: {new Date(scheduledSuspensions.get(student.id)!.schedule_suspend_date).toLocaleDateString()}</span>
                               </Badge>
                             )}
                            {student.fees_overdue && <Badge className="bg-orange-100 text-orange-800">
                                <Clock className="w-3 h-3 mr-1" />
                                Overdue
                              </Badge>}
                           <Badge className={getInstallmentStatus(student).color}>
                             <DollarSign className="w-3 h-3 mr-1" />
                             {getInstallmentStatus(student).status}
                           </Badge>
                         </div>
                       </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => {
                                setSelectedStudentForEdit(student);
                                setEditDialogOpen(true);
                              }}
                              title="Edit Student"
                              className="hover-scale hover:border-blue-300 hover:text-blue-600"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            
                            <Button variant="outline" size="sm" onClick={() => toggleRowExpansion(student.id)} title={expandedRows.has(student.id) ? "Collapse" : "Expand"} className="hover-scale hover:border-green-300 hover:text-green-600">
                              {expandedRows.has(student.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                            
                            <AlertDialog>
                             <AlertDialogTrigger asChild>
                               <Button variant="outline" size="sm" title="Delete Student" className="hover-scale hover:border-red-300 hover:text-red-600">
                                 <Trash2 className="w-4 h-4" />
                               </Button>
                             </AlertDialogTrigger>
                             <AlertDialogContent>
                               <AlertDialogHeader>
                                 <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                 <AlertDialogDescription>
                                   This will permanently delete {student.full_name} and remove all their data. This action cannot be undone.
                                 </AlertDialogDescription>
                               </AlertDialogHeader>
                               <AlertDialogFooter>
                                 <AlertDialogCancel>Cancel</AlertDialogCancel>
                                 <AlertDialogAction onClick={() => handleDeleteStudent(student.id, student.full_name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                   Delete
                                 </AlertDialogAction>
                               </AlertDialogFooter>
                             </AlertDialogContent>
                           </AlertDialog>
                         </div>
                       </TableCell>
                     </TableRow>,
                     
                     expandedRows.has(student.id) && <TableRow key={`${student.id}-expanded`} className="animate-accordion-down">
                       <TableCell colSpan={8} className="bg-gradient-to-r from-slate-50 to-blue-50 p-6 border-l-4 border-l-blue-200">
                         <div className="space-y-6">
                           {/* Basic Info Section */}
                           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                             <div>
                               <Label className="text-sm font-medium text-gray-700">Joining Date</Label>
                               <p className="text-sm text-gray-900">{formatDate(student.created_at)}</p>
                             </div>
                             <div>
                               <Label className="text-sm font-medium text-gray-700">Fees Structure</Label>
                               <p className="text-sm text-gray-900">{getDisplayFeesStructureLabel(student)}</p>
                             </div>
                             <div>
                               <Label className="text-sm font-medium text-gray-700">Last Invoice Sent Date</Label>
                               <p className="text-sm text-gray-900">{formatDate(getLastInvoiceSentDate(student))}</p>
                             </div>
                           </div>

                           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                             <div>
                               <Label className="text-sm font-medium text-gray-700">Invoice Due Date</Label>
                               <p className="text-sm text-gray-900">{formatDate(getNextInvoiceDueDate(student))}</p>
                             </div>
                             <div>
                               <Label className="text-sm font-medium text-gray-700">Invoice Status</Label>
                               <p className="text-sm text-gray-900">{getInvoiceStatus(student)}</p>
                             </div>
                             <div>
                               <Label className="text-sm font-medium text-gray-700">LMS User ID</Label>
                               <div className="flex items-center space-x-2">
                                 <p className="text-sm text-gray-900">{student.lms_user_id || 'Not set'}</p>
                                 {student.lms_user_id && (
                                   <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(student.lms_user_id)}>
                                     <Key className="w-3 h-3" />
                                   </Button>
                                 )}
                               </div>
                             </div>
                           </div>

                           <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                             <div className="lg:col-span-3">
                               <div className="flex items-center gap-2 mb-1">
                                 <Label className="text-sm font-medium text-gray-700">LMS Password</Label>
                                 {student.is_temp_password ? (
                                   <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                     <Key className="w-3 h-3 mr-1" />
                                     Temporary
                                   </Badge>
                                 ) : (
                                   <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                     <CheckCircle className="w-3 h-3 mr-1" />
                                     Set by User
                                   </Badge>
                                 )}
                               </div>
                               <div className="flex items-center space-x-2">
                                 <p className="text-sm text-gray-900 font-mono bg-gray-50 px-3 py-2 rounded border">
                                   {student.password_display || 'Not set'}
                                 </p>
                                 {student.password_display && (
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     onClick={() => {
                                       navigator.clipboard.writeText(student.password_display || '');
                                       toast({
                                         title: 'Copied',
                                         description: 'Password copied to clipboard'
                                       });
                                     }}
                                     title="Copy password"
                                   >
                                     <Key className="w-3 h-3" />
                                   </Button>
                                 )}
                               </div>
                               {!student.is_temp_password && (
                                 <p className="text-xs text-muted-foreground mt-1">
                                   This password was set by the student and is synced with their current login credentials.
                                 </p>
                               )}
                             </div>
                           </div>

                           {/* Installment Payment Buttons */}
                           {(student.fees_structure === '1_installment' ||
                             student.fees_structure === '2_installments' ||
                             student.fees_structure === '3_installments') && (
                             <div className="pt-4 border-t border-blue-200">
                               <Label className="text-sm font-medium text-gray-700 mb-2 block">Installment Payments</Label>
                               <div className="flex flex-wrap gap-2">
                                 {Array.from(
                                   {
                                     length:
                                       student.fees_structure === '1_installment'
                                         ? 1
                                         : student.fees_structure === '2_installments'
                                         ? 2
                                         : 3,
                                   },
                                   (_, index) => {
                                     const installmentNumber = index + 1;
                                     const payments =
                                       installmentPayments.get(student.student_record_id || '') ||
                                       installmentPayments.get(student.id) ||
                                       [];
                                     const isPaid = payments.some(
                                       (p: any) =>
                                         p.installment_number === installmentNumber && p.status === 'paid'
                                     );

                                     return (
                                       <Button
                                         key={installmentNumber}
                                         variant={isPaid ? 'default' : 'outline'}
                                         size="sm"
                                         disabled={isPaid}
                                         onClick={() =>
                                           handleMarkInstallmentPaid(student.id, installmentNumber)}
                                         className={`hover-scale ${
                                           isPaid
                                             ? 'bg-green-500 hover:bg-green-600'
                                             : 'hover:border-green-300 hover:text-green-600'
                                         }`}
                                       >
                                         {isPaid ? (
                                           <CheckCircle className="w-4 h-4 mr-2" />
                                         ) : (
                                           <DollarSign className="w-4 h-4 mr-2" />
                                         )}
                                         {isPaid
                                           ? `${installmentNumber}${
                                               installmentNumber === 1
                                                 ? 'st'
                                                 : installmentNumber === 2
                                                 ? 'nd'
                                                 : 'rd'
                                             } Paid`
                                           : `Mark ${installmentNumber}${
                                               installmentNumber === 1
                                                 ? 'st'
                                                 : installmentNumber === 2
                                                 ? 'nd'
                                                 : 'rd'
                                             } Paid`}
                                       </Button>
                                     );
                                   }
                                 )}
                               </div>
                             </div>
                           )}

                           <div className="flex flex-wrap gap-2 pt-4 border-t border-blue-200">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleViewActivityLogs(student.id)}
                               className="hover-scale hover:border-blue-300 hover:text-blue-600"
                             >
                               <Eye className="w-4 h-4 mr-2" />
                               View Activity Logs
                             </Button>
                             <Button variant="outline" size="sm" onClick={() => { setSelectedStudentForNotes(student); setNotesDialogOpen(true); }} className="hover-scale hover:border-amber-300 hover:text-amber-600">
                               <MessageSquare className="w-4 h-4 mr-2" />
                               Notes
                             </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendInvoice(student)}
                                className="hover-scale hover:border-purple-300 hover:text-purple-600"
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Resend Invoice
                              </Button>
                              <Popover open={extensionPopoverOpen === student.id} onOpenChange={(open) => {
                                setExtensionPopoverOpen(open ? student.id : null);
                                if (!open) setExtensionDate(undefined);
                              }}>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="hover-scale hover:border-amber-300 hover:text-amber-600">
                                    <CalendarIcon className="w-4 h-4 mr-2" />
                                    Extend Due Date
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={extensionDate}
                                    onSelect={(date) => {
                                      if (date) {
                                        setExtensionDate(date);
                                        grantExtension(student, date);
                                      }
                                    }}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                    className="pointer-events-auto"
                                  />
                                </PopoverContent>
                              </Popover>
                             {student.last_invoice_date && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => downloadInvoicePDF(student)}
                                 className="hover-scale hover:border-orange-300 hover:text-orange-600"
                               >
                                 <Download className="w-4 h-4 mr-2" />
                                 Download Invoice
                               </Button>
                             )}
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleStatusUpdate(student.id)}
                                className="hover-scale hover:border-blue-300 hover:text-blue-600"
                              >
                                <Settings className="w-4 h-4 mr-2" />
                                LMS Status
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedStudentForAccess(student);
                                  setManageAccessDialogOpen(true);
                                }}
                                className="hover-scale hover:border-indigo-300 hover:text-indigo-600"
                              >
                                <Lock className="w-4 h-4 mr-2" />
                                Manage Access
                              </Button>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() =>
                                 handleToggleLMSSuspension(student)}
                               className={`hover-scale ${
                                 student.lms_status === 'suspended'
                                   ? 'text-green-600 hover:text-green-700 hover:border-green-300'
                                   : 'text-red-600 hover:text-red-700 hover:border-red-300'
                               }`}
                             >
                               {student.lms_status === 'suspended' ? <>
                                   <CheckCircle className="w-4 h-4 mr-2" />
                                   Activate LMS
                                 </> : <>
                                   <Ban className="w-4 h-4 mr-2" />
                                   Suspend LMS
                                 </>}
                             </Button>
                           </div>
                         </div>
                       </TableCell>
                     </TableRow>
                  ].filter(Boolean))
                )}
              </TableBody>
            </Table>
        </CardContent>
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t">
            <p className="text-sm text-muted-foreground">
              Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, displayStudents.length)} of {displayStudents.length}
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage <= 1} onClick={() => setCurrentPage(safePage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPaginationRange().map((p, i) =>
                p === '...' ? (
                  <span key={`dots-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
                ) : (
                  <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="icon" className="h-8 w-8 text-xs" onClick={() => setCurrentPage(p as number)}>
                    {p}
                  </Button>
                )
              )}
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safePage >= totalPages} onClick={() => setCurrentPage(safePage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Activity Logs Dialog */}
      <Dialog open={activityLogsDialog} onOpenChange={setActivityLogsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Activity Logs - {selectedStudentForLogs?.full_name}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {activityLogs.length === 0 ? <p className="text-center text-muted-foreground py-8">
                  No activity logs found for this student.
                </p> : activityLogs.map(log => <Card key={log.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{formatActivityType(log.activity_type)}</h4>
                        <p className="text-sm text-muted-foreground">
                          {formatDateTime(log.occurred_at)}
                        </p>
                      </div>
                      <Badge variant="outline">{log.activity_type}</Badge>
                    </div>
                    {log.metadata && <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </div>}
                  </Card>)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={statusUpdateDialog} onOpenChange={setStatusUpdateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Update LMS Status - {selectedStudentForStatus?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="lms_status">LMS Status</Label>
              <Select value={newLMSStatus} onValueChange={setNewLMSStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select LMS status" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="dropout">Dropout</SelectItem>
                  <SelectItem value="complete">Complete</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setStatusUpdateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={saveStatusUpdate}>
                Update LMS Status
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Edit Dialog */}
      <Dialog open={passwordEditDialog} onOpenChange={setPasswordEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Edit {passwordType === 'temp' ? 'Temporary' : 'LMS'} Password - {selectedStudentForPassword?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">
                {passwordType === 'temp' ? 'Temporary Password' : 'LMS Password'}
              </Label>
              <Input id="password" type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Enter new password" />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
              setPasswordEditDialog(false);
              setNewPassword('');
              setSelectedStudentForPassword(null);
            }}>
                Cancel
              </Button>
              <Button onClick={handleUpdatePassword}>
                Update Password
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Access Dialog */}
      <ManageAccessDialog
        open={manageAccessDialogOpen}
        onOpenChange={setManageAccessDialogOpen}
        student={selectedStudentForAccess}
        onUpdate={fetchStudents}
      />

      {/* Suspension Dialog */}
      <SuspensionDialog
        open={suspensionDialogOpen}
        onOpenChange={setSuspensionDialogOpen}
        studentName={studentForSuspension?.full_name || ''}
        onConfirm={handleSuspendStudent}
        loading={suspensionLoading}
      />

      {/* Student Notes Dialog */}
      <StudentNotesDialog
        open={notesDialogOpen}
        onOpenChange={setNotesDialogOpen}
        studentId={selectedStudentForNotes?.id || ''}
        studentName={selectedStudentForNotes?.full_name || ''}
      />
    </div>;
};