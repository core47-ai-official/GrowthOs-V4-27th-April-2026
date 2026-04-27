import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { safeLogger } from '@/lib/safe-logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EnhancedStudentCreationDialog } from '@/components/EnhancedStudentCreationDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Plus, Edit, Trash2, Users, Activity, DollarSign, Download, CheckCircle, XCircle, Search, Filter, Clock, Ban, ChevronDown, ChevronUp, FileText, Key, Lock, Eye, Settings, Award, RefreshCw, CalendarIcon, BookOpen, MessageSquare, Send } from 'lucide-react';
import { StudentAccessManagement } from './StudentAccessManagement';
import { SuspensionDialog } from '@/components/SuspensionDialog';
import { StudentNotesDialog } from '@/components/StudentNotesDialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useInstallmentOptions } from '@/hooks/useInstallmentOptions';
import { useUserManagement } from '@/hooks/useUserManagement';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/utils/currencyFormatter';
import { cn } from '@/lib/utils';
import { logAdminAction, ACTIVITY_TYPES } from '@/lib/activity-logger';
import { useScheduledSuspensions } from '@/hooks/useScheduledSuspensions';
import type { SuspensionConfirmData } from '@/components/SuspensionDialog';
import jsPDF from 'jspdf';
interface Student {
  id: string;
  student_id: string;
  student_record_id?: string | null;
  full_name: string;
  email: string;
  phone: string;
  lms_user_id: string;
  password_display: string;
  original_password?: string;
  created_at: string;
  last_active_at: string;
  fees_structure: string;
  lms_status: string;
  fees_overdue: boolean;
  last_invoice_date: string;
  last_invoice_sent: boolean;
  fees_due_date: string;
  last_suspended_date: string;
  created_by?: string | null;
  creator?: {
    full_name: string;
    email: string;
  } | null;
}
interface InstallmentPayment {
  id: string;
  installment_number: number;
  amount: number;
  status: string;
  created_at?: string;
  due_date?: string;
  paid_at?: string | null;
}
interface ActivityLog {
  id: string;
  activity_type: string;
  occurred_at: string;
  metadata: any;
  reference_id: string;
}
export function StudentsManagement() {
  const {
    toast
  } = useToast();
  const {
    deleteMultipleUsers,
    loading: userManagementLoading
  } = useUserManagement();
  const {
    user
  } = useAuth();
  const isSupportMember = user?.role === 'support_member';
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [totalStudents, setTotalStudents] = useState(0);
  const [activeStudents, setActiveStudents] = useState(0);
  const [suspendedStudents, setSuspendedStudents] = useState(0);
  const [overdueStudents, setOverdueStudents] = useState(0);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [searchTerm, setSearchTerm] = useState(initialSearch);

  // Sync searchTerm when URL ?search= changes (e.g., navigated from At-Risk page)
  useEffect(() => {
    const urlSearch = searchParams.get('search');
    if (urlSearch && urlSearch !== searchTerm) {
      setSearchTerm(urlSearch);
      setFiltersOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [lmsStatusFilter, setLmsStatusFilter] = useState('all');
  const [feesStructureFilter, setFeesStructureFilter] = useState('all');
  const [invoiceFilter, setInvoiceFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [batchOptions, setBatchOptions] = useState<{id: string; name: string}[]>([]);
  const [studentBatchMap, setStudentBatchMap] = useState<Map<string, string[]>>(new Map());
  const [totalFeeSort, setTotalFeeSort] = useState('none');
  const [feeRangeFrom, setFeeRangeFrom] = useState('');
  const [feeRangeTo, setFeeRangeTo] = useState('');
  const [joinDateRange, setJoinDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [enrollmentFilter, setEnrollmentFilter] = useState<string[]>([]);
  const [allCourses, setAllCourses] = useState<{id: string; title: string}[]>([]);
  const [allPathways, setAllPathways] = useState<{id: string; name: string}[]>([]);
  const [studentEnrollmentMap, setStudentEnrollmentMap] = useState<Map<string, Set<string>>>(new Map());
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
  const [passwordType, setPasswordType] = useState<'temp' | 'lms'>('temp');
  const [newPassword, setNewPassword] = useState('');
  const [editDialog, setEditDialog] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    lms_user_id: '',
    lms_status: 'inactive',
    batch_id: '' as string | null,
    enrollment_id: '' as string | null
  });
  const [editBatches, setEditBatches] = useState<{id: string; name: string; start_date: string}[]>([]);
  const [bulkBatchDialogOpen, setBulkBatchDialogOpen] = useState(false);
  const [bulkBatchId, setBulkBatchId] = useState<string>('none');
  const [bulkBatches, setBulkBatches] = useState<{id: string; name: string; start_date: string}[]>([]);
  const [bulkBatchLoading, setBulkBatchLoading] = useState(false);
  const [bulkAccessDialogOpen, setBulkAccessDialogOpen] = useState(false);
  const [bulkAccessAction, setBulkAccessAction] = useState<'grant' | 'revoke'>('grant');
  const [bulkAccessCourses, setBulkAccessCourses] = useState<{id: string; title: string}[]>([]);
  const [bulkAccessPathways, setBulkAccessPathways] = useState<{id: string; name: string}[]>([]);
  const [bulkAccessSelectedId, setBulkAccessSelectedId] = useState<string>('');
  const [bulkAccessType, setBulkAccessType] = useState<'course' | 'pathway'>('course');
  const [bulkAccessLoading, setBulkAccessLoading] = useState(false);
  const [timeTick, setTimeTick] = useState(0);
  const [extensionDate, setExtensionDate] = useState<Date | undefined>(undefined);
  const [extensionPopoverOpen, setExtensionPopoverOpen] = useState<string | null>(null);
  const [accessManagementOpen, setAccessManagementOpen] = useState(false);
  const [selectedStudentForAccess, setSelectedStudentForAccess] = useState<Student | null>(null);
  const [companyCurrency, setCompanyCurrency] = useState<string>('PKR');
  const [currentPage, setCurrentPage] = useState(1);
  const [suspensionDialogOpen, setSuspensionDialogOpen] = useState(false);
  const [studentForSuspension, setStudentForSuspension] = useState<Student | null>(null);
  const [suspensionLoading, setSuspensionLoading] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedStudentForNotes, setSelectedStudentForNotes] = useState<Student | null>(null);
  const pageSize = 25;
  const {
    options: installmentOptions
  } = useInstallmentOptions();

  const studentIds = students.map(s => s.id);
  const {
    suspensions: scheduledSuspensions,
    createScheduledSuspension,
    cancelScheduledSuspension,
    fetchSuspensions: refetchSuspensions,
  } = useScheduledSuspensions(studentIds);

  useEffect(() => {
    fetchStudents();
    fetchCompanyCurrency();
    fetchBatchOptions();
    fetchCoursesAndPathways();
    // Safety watchdog: if loading hasn't cleared after 15s, release the spinner
    // so the user is never stuck on "Loading students..." forever.
    const watchdog = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('[StudentsManagement] Watchdog: forcing loading=false after 15s');
        }
        return false;
      });
    }, 15000);
    return () => clearTimeout(watchdog);
  }, []);
  useEffect(() => {
    if (students.length > 0) {
      fetchInstallmentPayments();
    }
  }, [students]);
  // Re-filter when students data or filter criteria change
  useEffect(() => {
    filterStudents();
  }, [students, searchTerm, lmsStatusFilter, feesStructureFilter, invoiceFilter, totalFeeSort, feeRangeFrom, feeRangeTo, installmentPayments, joinDateRange, batchFilter, studentBatchMap, enrollmentFilter, studentEnrollmentMap]);

  // Only reset to page 1 when actual filter criteria change, NOT when students data refreshes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, lmsStatusFilter, feesStructureFilter, invoiceFilter, totalFeeSort, feeRangeFrom, feeRangeTo, joinDateRange, batchFilter, enrollmentFilter]);

  // Re-render periodically so time-based invoice statuses update without refresh
  useEffect(() => {
    const id = setInterval(() => setTimeTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const channel = supabase.channel('realtime-invoices-superadmin').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'invoices'
    }, () => {
      fetchInstallmentPayments();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const fetchBatchOptions = async () => {
    try {
      const [batchesRes, enrollmentsRes, studentsTableRes] = await Promise.all([
        supabase.from('batches').select('id, name').order('start_date', { ascending: false }),
        supabase.from('course_enrollments').select('student_id, batch_id').not('batch_id', 'is', null),
        supabase.from('students').select('id, user_id')
      ]);
      if (batchesRes.data) setBatchOptions(batchesRes.data);
      if (enrollmentsRes.data && studentsTableRes.data) {
        // Build student_record_id -> user_id map
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

  const fetchCoursesAndPathways = async () => {
    try {
      const [coursesRes, pathwaysRes, enrollmentsRes, studentsTableRes] = await Promise.all([
        supabase.from('courses').select('id, title').order('title'),
        supabase.from('learning_pathways').select('id, name').order('name'),
        supabase.from('course_enrollments').select('student_id, course_id, pathway_id').eq('status', 'active'),
        supabase.from('students').select('id, user_id')
      ]);
      if (coursesRes.data) setAllCourses(coursesRes.data as any);
      if (pathwaysRes.data) setAllPathways(pathwaysRes.data as any);
      if (enrollmentsRes.data && studentsTableRes.data) {
        const recordToUser = new Map<string, string>();
        studentsTableRes.data.forEach((s: any) => recordToUser.set(s.id, s.user_id));
        const map = new Map<string, Set<string>>();
        enrollmentsRes.data.forEach((e: any) => {
          const userId = recordToUser.get(e.student_id);
          if (!userId) return;
          const set = map.get(userId) || new Set<string>();
          if (e.course_id) set.add(`course:${e.course_id}`);
          if (e.pathway_id) set.add(`pathway:${e.pathway_id}`);
          map.set(userId, set);
        });
        setStudentEnrollmentMap(map);
      }
    } catch (error) {
      console.error('Error fetching courses/pathways:', error);
    }
  };

  const fetchCompanyCurrency = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('currency')
        .single();
      if (error) throw error;
      if (data?.currency) {
        setCompanyCurrency(data.currency);
      }
    } catch (error) {
      console.error('Error fetching company currency:', error);
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
      toast({
        title: 'Error',
        description: 'Failed to suspend student',
        variant: 'destructive'
      });
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

  const fetchInstallmentPayments = async () => {
    try {
      // Fetch all invoices - we need to show complete payment history
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .order('installment_number', { ascending: true });
      
      if (invoicesError) throw invoicesError;

      // Group payments by student_id and transform to InstallmentPayment format
      const paymentsMap = new Map<string, InstallmentPayment[]>();
      invoicesData?.forEach(invoice => {
        const payment: InstallmentPayment = {
          id: invoice.id,
          installment_number: invoice.installment_number,
          amount: invoice.amount,
          status: invoice.status,
          created_at: invoice.created_at,
          due_date: invoice.due_date,
          paid_at: invoice.paid_at
        };
        const key = String(invoice.student_id || '');
        const userPayments = paymentsMap.get(key) || [];
        userPayments.push(payment);
        paymentsMap.set(key, userPayments);
      });
      setInstallmentPayments(paymentsMap);
    } catch (error) {
      console.error('Error fetching installment payments:', error);
    }
  };
  const fetchStudents = async () => {
    try {
      console.log('[StudentsManagement] fetchStudents: starting', {
        currentUserId: user?.id,
        currentUserRole: user?.role,
        currentUserEmail: user?.email,
      });
      // Resilient lookup: students must be visible whether they're tagged in
      // the `user_roles` junction table OR have role='student' on the users
      // table. We union both sources to avoid invisibility from legacy rows
      // that never got an explicit user_roles entry.
      const [rolesRes, legacyRes, allUsersRes] = await Promise.all([
        supabase.from('user_roles').select('user_id, role').eq('role', 'student'),
        supabase.from('users').select('id, role').eq('role', 'student'),
        // Diagnostic: count all users visible to this caller, broken down by role.
        // If this returns 0 rows we know RLS is blocking everything.
        supabase.from('users').select('id, role'),
      ]);
      if (rolesRes.error) {
        console.error('[StudentsManagement] user_roles query error:', rolesRes.error);
      }
      if (legacyRes.error) {
        console.warn('[StudentsManagement] users.role lookup failed:', legacyRes.error);
      }
      if (allUsersRes.error) {
        console.error('[StudentsManagement] users (all) query error:', allUsersRes.error);
      }

      const visibleUsers = allUsersRes.data || [];
      const roleBreakdown = visibleUsers.reduce<Record<string, number>>((acc, u: any) => {
        const r = u.role || 'null';
        acc[r] = (acc[r] || 0) + 1;
        return acc;
      }, {});
      console.log('[StudentsManagement] RLS visibility check:', {
        totalUsersVisible: visibleUsers.length,
        roleBreakdown,
        userRolesStudentRows: rolesRes.data?.length || 0,
        usersStudentRows: legacyRes.data?.length || 0,
      });

      const idSet = new Set<string>();
      (rolesRes.data || []).forEach((r: any) => r?.user_id && idSet.add(r.user_id));
      (legacyRes.data || []).forEach((u: any) => u?.id && idSet.add(u.id));
      const studentUserIds = Array.from(idSet);

      if (studentUserIds.length === 0) {
        // Surface the underlying reason so the user sees something actionable
        // instead of a silent empty table.
        if (visibleUsers.length === 0 && !allUsersRes.error) {
          toast({
            title: 'No users visible',
            description: `RLS may be blocking access. Logged in as ${user?.email || 'unknown'} (${user?.role || 'no role'}).`,
            variant: 'destructive',
          });
        } else if (visibleUsers.length > 0) {
          toast({
            title: 'No students found',
            description: `Database contains ${visibleUsers.length} users but none with role=student. Roles seen: ${Object.keys(roleBreakdown).join(', ') || 'none'}.`,
          });
        }
        setStudents([]);
        setTotalStudents(0);
        setActiveStudents(0);
        setSuspendedStudents(0);
        setOverdueStudents(0);
        return;
      }

      // Self-heal: backfill missing user_roles rows so future queries see them
      // immediately. Errors here are non-fatal.
      const knownRoleIds = new Set((rolesRes.data || []).map((r: any) => r.user_id));
      const missingRoleIds = studentUserIds.filter(id => !knownRoleIds.has(id));
      if (missingRoleIds.length > 0) {
        console.log('[StudentsManagement] backfilling user_roles for', missingRoleIds.length, 'students');
        supabase
          .from('user_roles')
          .upsert(
            missingRoleIds.map(uid => ({ user_id: uid, role: 'student' as const })),
            { onConflict: 'user_id,role', ignoreDuplicates: true }
          )
          .then(({ error }) => {
            if (error) console.warn('[StudentsManagement] user_roles backfill failed:', error);
          });
      }

      // Fetch users and their corresponding student records in parallel.
      // NOTE: The embedded `creator:created_by(...)` relationship can hang/fail
      // when the FK is missing or ambiguous. Fetch creators separately instead.
      // IMPORTANT: Chunk the .in() call to avoid PostgREST "Bad Request" from
      // URL length limits when there are hundreds of student IDs.
      const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const out: T[][] = [];
        for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
        return out;
      };
      const idChunks = chunkArray(studentUserIds, 100);
      const [usersChunkResults, studentsRes] = await Promise.all([
        Promise.all(
          idChunks.map(chunk =>
            supabase.from('users').select('*').in('id', chunk)
          )
        ),
        supabase.from('students').select('id, user_id, student_id, installment_count')
      ]);
      const usersErrEntry = usersChunkResults.find(r => r.error);
      const usersData = usersChunkResults.flatMap(r => r.data || []);
      // Sort newest-first to mimic the previous .order('created_at', desc)
      usersData.sort((a: any, b: any) => {
        const at = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const bt = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return bt - at;
      });
      console.log('[StudentsManagement] users/students queries done', {
        usersErr: usersErrEntry?.error?.message,
        studentsErr: studentsRes.error?.message,
        userCount: usersData.length,
        chunks: idChunks.length,
      });
      if (usersErrEntry?.error) throw usersErrEntry.error;
      if (studentsRes.error) {
        console.warn('Warning fetching students table:', studentsRes.error);
      }

      const studentsTable = studentsRes.data || [];

      // Resolve creators in a separate, resilient query
      const creatorIds = Array.from(new Set(
        usersData.map((u: any) => u.created_by).filter((id: any) => !!id)
      ));
      let creatorMap = new Map<string, { full_name: string; email: string }>();
      if (creatorIds.length > 0) {
        const creatorChunks = chunkArray(creatorIds as string[], 100);
        const creatorResults = await Promise.all(
          creatorChunks.map(chunk =>
            supabase.from('users').select('id, full_name, email').in('id', chunk)
          )
        );
        const creatorsData = creatorResults.flatMap(r => r.data || []);
        const creatorsErr = creatorResults.find(r => r.error)?.error;
        if (creatorsErr) {
          console.warn('Warning fetching creators:', creatorsErr);
        }
        creatorMap = new Map(
          creatorsData.map((c: any) => [c.id as string, { full_name: c.full_name, email: c.email }])
        );
      }
      // Attach creator info onto each user object
      usersData.forEach((u: any) => {
        u.creator = u.created_by ? (creatorMap.get(u.created_by) || null) : null;
      });
      const studentIdMap = new Map<string, { student_id: string | null; student_record_id: string | null; installment_count: number | null }>(
        studentsTable.map((s: any) => [s.user_id as string, { student_id: s.student_id as string | null, student_record_id: s.id as string | null, installment_count: (s.installment_count as number | null) ?? null }])
      );

      // Transform User data to Student data using real students.student_id
      const studentsData: Student[] = usersData.map((user: any) => {
        const mapEntry = studentIdMap.get(user.id);
        const count = mapEntry?.installment_count ?? null;
        const feesStructure = count === 1 ? '1_installment' : count === 2 ? '2_installments' : count === 3 ? '3_installments' : count ? `${count}_installments` : '';
        return {
          ...user,
          full_name: user.full_name || user.email || 'Unnamed Student',
          email: user.email || '',
          created_at: user.created_at || '',
          last_active_at: user.last_active_at || '',
          lms_user_id: user.lms_user_id || '',
          lms_status: user.lms_status || 'inactive',
          student_id: mapEntry?.student_id || '',
          student_record_id: mapEntry?.student_record_id || null,
          phone: user.phone || '',
          password_display: user.password_display || '',
          original_password: user.original_password || user.password_display || '',
          fees_structure: feesStructure,
          fees_overdue: false,
          last_invoice_date: '',
          last_invoice_sent: false,
          fees_due_date: '',
          last_suspended_date: ''
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
      setSuspendedStudents(suspendedCount);
      setOverdueStudents(0);
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
      const normalizedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(student => {
        const studentId = student.student_id?.toLowerCase?.() || '';
        const fullName = student.full_name?.toLowerCase?.() || '';
        const email = student.email?.toLowerCase?.() || '';
        const phone = student.phone?.toLowerCase?.() || '';
        return studentId.includes(normalizedSearch) || fullName.includes(normalizedSearch) || email.includes(normalizedSearch) || phone.includes(normalizedSearch);
      });
    }

    // Apply LMS status filter
    if (lmsStatusFilter !== 'all') {
      filtered = filtered.filter(student => student.lms_status === lmsStatusFilter);
    }

    // Apply fees structure filter
    if (feesStructureFilter !== 'all') {
      filtered = filtered.filter(student => student.fees_structure === feesStructureFilter);
    }

    // Apply invoice filter via invoices map
    const now = new Date();
    if (invoiceFilter !== 'all') {
      filtered = filtered.filter(student => {
        const key = String(student.student_record_id || '');
        const invs = installmentPayments.get(key) || [];
        if (invoiceFilter === 'no_invoice') {
          return invs.length === 0;
        }
        if (invoiceFilter === 'fees_due') {
          // Has unpaid invoices that are not overdue
          const unpaidInvoices = invs.filter(inv => inv.status !== 'paid');
          return unpaidInvoices.some(inv => inv.due_date && new Date(inv.due_date) >= now);
        }
        if (invoiceFilter === 'fees_overdue') {
          // Has unpaid invoices that are overdue
          const unpaidInvoices = invs.filter(inv => inv.status !== 'paid');
          return unpaidInvoices.some(inv => inv.due_date && new Date(inv.due_date) < now);
        }
        if (invoiceFilter === 'fees_cleared') {
          // All invoices are paid
          return invs.length > 0 && invs.every(inv => inv.status === 'paid');
        }
        return true;
      });
    }

    // Apply total fee amount range filter
    const feeFrom = feeRangeFrom ? parseFloat(feeRangeFrom) : null;
    const feeTo = feeRangeTo ? parseFloat(feeRangeTo) : null;
    if (feeFrom !== null || feeTo !== null) {
      filtered = filtered.filter(student => {
        const key = String(student.student_record_id || '');
        const payments = installmentPayments.get(key) || [];
        const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
        if (feeFrom !== null && totalAmount < feeFrom) return false;
        if (feeTo !== null && totalAmount > feeTo) return false;
        return true;
      });
    }

    // Apply total fee amount sort
    if (totalFeeSort !== 'none') {
      filtered = [...filtered].sort((a, b) => {
        const keyA = String(a.student_record_id || '');
        const keyB = String(b.student_record_id || '');
        const paymentsA = installmentPayments.get(keyA) || [];
        const paymentsB = installmentPayments.get(keyB) || [];
        const totalA = paymentsA.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalB = paymentsB.reduce((sum, p) => sum + (p.amount || 0), 0);
        return totalFeeSort === 'low_to_high' ? totalA - totalB : totalB - totalA;
      });
    }

    // Apply joining date range filter
    if (joinDateRange.from) {
      filtered = filtered.filter(student => new Date(student.created_at) >= joinDateRange.from!);
    }
    if (joinDateRange.to) {
      const endOfDay = new Date(joinDateRange.to);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter(student => new Date(student.created_at) <= endOfDay);
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

    // Apply enrollment filter (AND logic - student must have ALL selected enrollments)
    if (enrollmentFilter.length > 0) {
      filtered = filtered.filter(student => {
        const studentEnrollments = studentEnrollmentMap.get(student.id);
        if (enrollmentFilter.includes('none')) {
          const hasNoEnrollments = !studentEnrollments || studentEnrollments.size === 0;
          // If only "none" is selected, show only students without enrollments
          if (enrollmentFilter.length === 1) return hasNoEnrollments;
          // If "none" + other filters: include if no enrollments OR matches other filters
          if (hasNoEnrollments) return true;
        }
        if (!studentEnrollments) return false;
        // AND logic: student must have all selected items (excluding 'none')
        const nonNoneFilters = enrollmentFilter.filter(f => f !== 'none');
        return nonNoneFilters.every(f => studentEnrollments.has(f));
      });
    }

    setFilteredStudents(filtered);
  };
  const { deleteUser } = useUserManagement();
  
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this student?')) return;
    const success = await deleteUser(id);
    if (success) {
      fetchStudents();
    }
  };
  const handleSuspendAccount = async (studentId: string) => {
    try {
      const {
        error
      } = await supabase.from('users').update({
        lms_status: 'suspended',
        updated_at: new Date().toISOString()
      }).eq('id', studentId);
      if (error) throw error;
      // Log suspension via handleSuspendAccount
      logAdminAction({
        performedBy: user?.id || null,
        targetUserId: studentId,
        entityType: 'user',
        entityId: studentId,
        action: ACTIVITY_TYPES.LMS_SUSPENDED,
        description: `Account suspended`,
        data: {}
      });
      toast({
        title: 'Success',
        description: 'Account suspended successfully'
      });
      fetchStudents();
    } catch (error) {
      console.error('Error suspending account:', error);
      toast({
        title: 'Error',
        description: 'Failed to suspend account',
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
    } catch (e: any) {
      console.error('Error resending invoice:', e);
      toast({ title: 'Error', description: e?.message || 'Failed to resend invoice', variant: 'destructive' });
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

      // Find the latest unpaid invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .select('*')
        .eq('student_id', student.student_record_id)
        .neq('status', 'paid')
        .order('installment_number', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (invoiceError) throw invoiceError;

      if (!invoice) {
        toast({
          title: 'No Unpaid Invoice',
          description: 'This student has no unpaid invoices to extend.',
          variant: 'destructive'
        });
        return;
      }

      // Update the invoice with extended_due_date
      const { error: updateError } = await supabase
        .from('invoices')
        .update({
          extended_due_date: newDueDate.toISOString(),
          status: 'pending'
        })
        .eq('id', invoice.id);

      if (updateError) throw updateError;

      // If student was suspended, reactivate LMS
      if (student.lms_status === 'suspended') {
        const { error: lmsError } = await supabase
          .from('users')
          .update({ lms_status: 'active' })
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

  const handleResetSuccessPartnerCredits = async (studentId: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      
      if (!token) {
        toast({
          title: 'Error',
          description: 'No active session found',
          variant: 'destructive'
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('admin-reset-sp-credits', {
        body: { target_user_id: studentId },
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (error) throw error;

      if (data?.success) {
        toast({
          title: 'Success',
          description: 'Success Partner credits have been reset to 0',
        });
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error resetting credits via edge function:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset Success Partner credits',
        variant: 'destructive'
      });
    }
  };

  const handleResetPassword = async (studentId: string, studentName: string, storedPassword: string, studentEmail?: string) => {
    if (!storedPassword) {
      toast({ title: 'Error', description: 'No stored password found for this student', variant: 'destructive' });
      return;
    }

    try {
      console.log('Resetting auth password for:', studentId);

      // Attempt 1: dedicated admin-reset-password function
      let result = await supabase.functions.invoke('admin-reset-password', {
        body: { user_id: studentId, password: storedPassword }
      });

      // Attempt 2: if first failed, try reset-student-password
      if (result.error || result.data?.error) {
        console.log('admin-reset-password failed, trying reset-student-password...');
        result = await supabase.functions.invoke('reset-student-password', {
          body: { user_id: studentId, password: storedPassword }
        });
      }

      // Attempt 3: if still failed, try update-student-details
      if (result.error || result.data?.error) {
        console.log('reset-student-password failed, trying update-student-details...');
        result = await supabase.functions.invoke('update-student-details', {
          body: {
            user_id: studentId,
            full_name: studentName,
            email: studentEmail || '',
            reset_password: storedPassword
          }
        });
      }

      console.log('Final reset response:', JSON.stringify(result.data));

      if (result.error) throw result.error;
      if (result.data?.error) throw new Error(result.data.error);

      toast({
        title: 'Password Reset',
        description: `${studentName}'s authentication password has been reset successfully`,
      });
    } catch (error) {
      console.error('All password reset attempts failed:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset password',
        variant: 'destructive'
      });
    }
  };
  const getLMSStatusColor = (lmsStatus: string) => {
    switch (lmsStatus) {
      case 'active':
        return 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]';
      case 'inactive':
        return 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]';
      case 'suspended':
        return 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive))]';
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
  const formatDate = (dateString?: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  const getFeesStructureLabel = (structure: string) => {
    switch (structure) {
      case '1_installment':
        return '1 Installment';
      case '2_installments':
        return '2 Installments';
      case '3_installments':
        return '3 Installments';
      default:
        return 'N/A';
    }
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
  const handleToggleLMSSuspension = async (studentId: string, currentStatus: string) => {
    const newLMSStatus = currentStatus === 'suspended' ? 'active' : 'suspended';
    
    // Optimistic UI update
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, lms_status: newLMSStatus } : s
    ));
    
    try {
      const updateData: any = {
        lms_status: newLMSStatus,
        updated_at: new Date().toISOString()
      };
      const {
        error
      } = await supabase.from('users').update(updateData).eq('id', studentId);
      if (error) throw error;
      
      // Log LMS status toggle
      logAdminAction({
        performedBy: user?.id || null,
        targetUserId: studentId,
        entityType: 'user',
        entityId: studentId,
        action: ACTIVITY_TYPES.LMS_STATUS_CHANGED,
        description: `LMS status changed from ${currentStatus} to ${newLMSStatus}`,
        data: { old_status: currentStatus, new_status: newLMSStatus }
      });

      // Refresh to ensure consistency
      await fetchStudents();
      
      toast({
        title: 'Success',
        description: `LMS account ${newLMSStatus === 'suspended' ? 'suspended' : 'activated'} successfully`
      });
    } catch (error) {
      console.error('Error toggling LMS suspension:', error);
      
      // Rollback optimistic update
      setStudents(prev => prev.map(s => 
        s.id === studentId ? { ...s, lms_status: currentStatus } : s
      ));
      
      toast({
        title: 'Error',
        description: 'Failed to update LMS status',
        variant: 'destructive'
      });
    }
  };
  const handleViewActivityLogs = async (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;
      setSelectedStudentForLogs(student);
      const {
        data,
        error
      } = await supabase.from('user_activity_logs').select('*').eq('user_id', studentId).order('occurred_at', {
        ascending: false
      }).limit(50);
      if (error) throw error;
      setActivityLogs(data || []);
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
  const handleStatusUpdate = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;
    setSelectedStudentForStatus(student);
    setNewLMSStatus(student.lms_status);
    setStatusUpdateDialog(true);
  };
  const saveStatusUpdate = async () => {
    if (!selectedStudentForStatus || !newLMSStatus) return;
    
    const oldStatus = selectedStudentForStatus.lms_status;
    
    // Optimistic UI update
    setStudents(prev => prev.map(s => 
      s.id === selectedStudentForStatus.id ? { ...s, lms_status: newLMSStatus } : s
    ));
    
    try {
      const updateData: any = {
        lms_status: newLMSStatus,
        updated_at: new Date().toISOString()
      };
      const {
        error
      } = await supabase.from('users').update(updateData).eq('id', selectedStudentForStatus.id);
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

      // Close dialog
      setStatusUpdateDialog(false);
      setSelectedStudentForStatus(null);
      setNewLMSStatus('');
      
      // Refresh to ensure consistency
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
  const formatActivityType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
  const getInvoiceStatus = (student: Student) => {
    const key = student.student_record_id || '';
    const payments = installmentPayments.get(key) || [];
    const totalInstallments = student.fees_structure === '2_installments' ? 2 : student.fees_structure === '3_installments' ? 3 : 1;
    if (payments.length === 0) return 'No Invoice';
    const paidCount = payments.filter(p => p.status === 'paid').length;
    if (paidCount >= totalInstallments) return 'Fees Cleared';
    const openWithDue = payments.filter(p => p.status !== 'paid' && p.due_date);
    if (openWithDue.length > 0) {
      const nowTs = Date.now();
      if (openWithDue.some(p => new Date(p.due_date as string).getTime() < nowTs)) return 'Fees Overdue';
      return 'Fees Due';
    }
    return 'No Invoice';
  };
  const getInstallmentStatus = (student: Student) => {
    const keyPrimary = student.student_record_id || '';
    const payments = installmentPayments.get(keyPrimary) || installmentPayments.get(student.id) || [];
    const totalInstallments = student.fees_structure === '2_installments' ? 2 : student.fees_structure === '3_installments' ? 3 : 1;
    if (payments.length === 0) {
      return {
        status: 'No Invoice',
        color: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
      };
    }
    const paidPayments = payments.filter(p => p.status === 'paid');
    if (paidPayments.length >= totalInstallments) {
      return {
        status: 'Fees Cleared',
        color: 'bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] hover:bg-[hsl(var(--success))]'
      };
    }
    if (paidPayments.length > 0) {
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
        color: 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]'
      };
    }
    const openInvoices = payments.filter(p => p.status !== 'paid');
    const latestOpen = openInvoices.sort((a, b) => new Date(a.due_date || a.created_at || '').getTime() - new Date(b.due_date || b.created_at || '').getTime()).pop();
    if (latestOpen) {
      const due = latestOpen.due_date ? new Date(latestOpen.due_date) : null;
      if (due && due.getTime() < Date.now()) {
        return {
          status: 'Fees Overdue',
          color: 'bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] hover:bg-[hsl(var(--destructive))]'
        };
      }
      return {
        status: 'Fees Due',
        color: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]'
      };
    }
    return {
      status: 'No Invoice',
      color: 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
    };
  };

  // Compute last invoice sent date from invoices map
  const getLastInvoiceSentDate = (student: Student) => {
    const key = student.student_record_id || '';
    const payments = installmentPayments.get(key) || [];
    const sorted = payments.filter(p => p.created_at).sort((a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime());
    if (sorted.length > 0) {
      return formatDate(sorted[0].created_at as string);
    }
    return 'N/A';
  };

  // Compute next invoice due date from earliest outstanding invoice with a real due_date
  const getInvoiceDueDate = (student: Student) => {
    const key = student.student_record_id || '';
    const payments = installmentPayments.get(key) || [];
    const openWithDue = payments.filter(p => p.status !== 'paid' && p.due_date);
    if (openWithDue.length === 0) return 'N/A';
    const nowTs = Date.now();
    const upcoming = openWithDue.filter(p => new Date(p.due_date as string).getTime() >= nowTs).sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime());
    const target = upcoming[0] || openWithDue.sort((a, b) => new Date(a.due_date as string).getTime() - new Date(b.due_date as string).getTime())[0];
    return target && target.due_date ? formatDate(target.due_date) : 'N/A';
  };
  const isInvoiceOverdue = (student: Student) => {
    const key = student.student_record_id || '';
    const payments = installmentPayments.get(key) || [];
    const openWithDue = payments.filter(p => p.status !== 'paid' && p.due_date);
    if (openWithDue.length === 0) return false;
    return openWithDue.some(p => new Date(p.due_date as string).getTime() < Date.now());
  };

  // Compute payment summary for a student
  const getPaymentSummary = (student: Student) => {
    const key = student.student_record_id || '';
    const payments = installmentPayments.get(key) || [];
    
    // Calculate total amount from all invoices
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Calculate paid amount
    const paidAmount = payments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    
    // Calculate outstanding
    const outstanding = totalAmount - paidAmount;
    
    return {
      totalAmount: payments.length > 0 ? formatCurrency(totalAmount, companyCurrency) : 'N/A',
      paidAmount: formatCurrency(paidAmount, companyCurrency),
      outstanding: payments.length > 0 ? formatCurrency(outstanding, companyCurrency) : 'N/A',
      outstandingRaw: outstanding
    };
  };
  const handleMarkInstallmentPaid = async (studentId: string, installmentNumber: number) => {
    try {
      const student = students.find(s => s.id === studentId);
      if (!student) return;

      if (!student.student_record_id) {
        toast({ title: 'Error', description: 'Student record not found. Please refresh and try again.', variant: 'destructive' });
        return;
      }

      // Check if already paid
      const {
        data: invoiceRow,
        error: fetchInvErr
      } = await supabase.from('invoices').select('id, status').eq('student_id', student.student_record_id).eq('installment_number', installmentNumber).maybeSingle();
      if (fetchInvErr) throw fetchInvErr;
      if (invoiceRow && invoiceRow.status === 'paid') {
        toast({
          title: "Already Paid",
          description: "This installment has already been marked as paid",
          variant: "destructive"
        });
        return;
      }

      // Use the edge function to mark as paid (avoids trigger issues)
      const { data, error } = await supabase.functions.invoke('mark-invoice-paid', {
        body: {
          student_id: student.student_record_id,
          installment_number: installmentNumber,
          ...(invoiceRow ? { invoice_id: invoiceRow.id } : {})
        }
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || 'Failed to mark installment as paid');

      toast({
        title: 'Success',
        description: `Installment ${installmentNumber} marked as paid`
      });
      fetchInstallmentPayments();
      fetchStudents();
    } catch (error: any) {
      console.error('Error marking installment as paid:', error);
      toast({
        title: 'Error',
        description: error?.message || 'Failed to mark installment as paid',
        variant: 'destructive'
      });
    }
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
      setSelectedStudents(new Set(displayStudents.map(s => s.id)));
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
      const { error } = await supabase
        .from('users')
        .update({ lms_status })
        .in('id', Array.from(selectedStudents));
      if (error) throw error;

      // Optimistic UI update
      setStudents(prev => prev.map(s => (selectedStudents.has(s.id) ? { ...s, lms_status } as Student : s)));

      toast({
        title: 'Success',
        description: `${selectedStudents.size} student(s) ${action === 'suspend' ? 'suspended' : 'activated'} successfully`
      });
      setSelectedStudents(new Set());
      setBulkActionDialog(false);
      await fetchStudents();
    } catch (error) {
      console.error('Error updating bulk LMS status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update LMS status',
        variant: 'destructive'
      });
    }
  };
  const handleBulkDelete = async () => {
    if (selectedStudents.size === 0) {
      toast({
        title: 'Error',
        description: 'Please select at least one student',
        variant: 'destructive'
      });
      return;
    }
    const confirmMessage = `Are you sure you want to permanently delete ${selectedStudents.size} student(s)? This action cannot be undone.`;
    if (!confirm(confirmMessage)) return;
    const userIds = Array.from(selectedStudents);
    const result = await deleteMultipleUsers(userIds);
    if (result.success > 0) {
      setSelectedStudents(new Set());
      fetchStudents();
    }
  };

  const handleBulkMarkInstallmentPaid = async (installmentNumber: number) => {
    if (selectedStudents.size === 0) {
      toast({ title: 'Error', description: 'Please select at least one student', variant: 'destructive' });
      return;
    }
    try {
      let successCount = 0;
      let skipCount = 0;
      for (const studentId of Array.from(selectedStudents)) {
        const student = students.find(s => s.id === studentId);
        if (!student?.student_record_id) { skipCount++; continue; }

        const { data: invoiceRow } = await supabase
          .from('invoices')
          .select('id, status')
          .eq('student_id', student.student_record_id)
          .eq('installment_number', installmentNumber)
          .maybeSingle();

        if (invoiceRow?.status === 'paid') { skipCount++; continue; }

        if (invoiceRow) {
          await supabase.from('invoices').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', invoiceRow.id);
        } else {
          await supabase.from('invoices').insert({
            student_id: student.student_record_id,
            installment_number: installmentNumber,
            amount: 0,
            status: 'paid',
            due_date: new Date().toISOString(),
            paid_at: new Date().toISOString()
          });
        }

        // Activate LMS on first installment
        if (installmentNumber === 1) {
          await supabase.from('users').update({ lms_status: 'active' }).eq('id', studentId);
        }
        successCount++;
      }
      toast({
        title: 'Success',
        description: `Installment ${installmentNumber} marked paid for ${successCount} student(s)${skipCount > 0 ? `, ${skipCount} skipped` : ''}`
      });
      setSelectedStudents(new Set());
      fetchInstallmentPayments();
      fetchStudents();
    } catch (error) {
      console.error('Error bulk marking installments:', error);
      toast({ title: 'Error', description: 'Failed to mark installments as paid', variant: 'destructive' });
    }
  };

  const openBulkAccessDialog = async (action: 'grant' | 'revoke') => {
    if (selectedStudents.size === 0) {
      toast({ title: 'Error', description: 'Please select at least one student', variant: 'destructive' });
      return;
    }
    setBulkAccessAction(action);
    setBulkAccessSelectedId('');
    setBulkAccessType('course');
    // Fetch courses and pathways
    const [coursesRes, pathwaysRes] = await Promise.all([
      supabase.from('courses').select('id, title').eq('is_active', true).order('title'),
      supabase.from('learning_pathways').select('id, name').eq('is_active', true).order('name')
    ]);
    setBulkAccessCourses(coursesRes.data || []);
    setBulkAccessPathways(pathwaysRes.data || []);
    setBulkAccessDialogOpen(true);
  };

  const handleBulkAccessConfirm = async () => {
    if (!bulkAccessSelectedId) {
      toast({ title: 'Error', description: 'Please select a course or pathway', variant: 'destructive' });
      return;
    }
    setBulkAccessLoading(true);
    try {
      const selectedIds = Array.from(selectedStudents);
      const chunkSize = 50;

      if (bulkAccessAction === 'grant') {
        // Get student records for selected users
        for (let i = 0; i < selectedIds.length; i += chunkSize) {
          const chunk = selectedIds.slice(i, i + chunkSize);
          const { data: studentRecords } = await supabase
            .from('students')
            .select('id, user_id')
            .in('user_id', chunk);

          if (!studentRecords) continue;

          for (const record of studentRecords) {
            // Check if enrollment already exists
            let existingQuery = supabase
              .from('course_enrollments')
              .select('id')
              .eq('student_id', record.id);

            if (bulkAccessType === 'course') {
              existingQuery = existingQuery.eq('course_id', bulkAccessSelectedId).is('pathway_id', null);
            } else {
              existingQuery = existingQuery.eq('pathway_id', bulkAccessSelectedId);
            }

            const { data: existing } = await existingQuery.maybeSingle();
            if (existing) continue; // Already enrolled

            // Create enrollment
            const enrollmentData: any = {
              student_id: record.id,
              status: 'active',
              enrollment_source: 'direct',
              progress_percentage: 0,
              enrolled_at: new Date().toISOString(),
            };
            if (bulkAccessType === 'course') {
              enrollmentData.course_id = bulkAccessSelectedId;
            } else {
              // For pathway, use first course in pathway as anchor
              const { data: firstStep } = await supabase
                .from('pathway_courses')
                .select('course_id')
                .eq('pathway_id', bulkAccessSelectedId)
                .order('step_number', { ascending: true })
                .limit(1)
                .maybeSingle();
              enrollmentData.course_id = firstStep?.course_id || bulkAccessSelectedId;
              enrollmentData.pathway_id = bulkAccessSelectedId;
            }
            const { error: insertError } = await supabase.from('course_enrollments').insert(enrollmentData);
            if (insertError) {
              console.error('Failed to insert enrollment for student', record.id, insertError);
            }
          }
        }

        // Also activate LMS
        await supabase.from('users').update({ lms_status: 'active' }).in('id', selectedIds);
        setStudents(prev => prev.map(s => (selectedStudents.has(s.id) ? { ...s, lms_status: 'active' } as Student : s)));

        toast({ title: 'Success', description: `Access granted to ${selectedStudents.size} student(s)` });
      } else {
        // Revoke: cancel enrollments for the selected course/pathway
        for (let i = 0; i < selectedIds.length; i += chunkSize) {
          const chunk = selectedIds.slice(i, i + chunkSize);
          const { data: studentRecords } = await supabase
            .from('students')
            .select('id')
            .in('user_id', chunk);

          if (!studentRecords) continue;
          const studentRecordIds = studentRecords.map(r => r.id);

          let revokeQuery = supabase
            .from('course_enrollments')
            .update({ status: 'cancelled' })
            .in('student_id', studentRecordIds);

          if (bulkAccessType === 'course') {
            revokeQuery = revokeQuery.eq('course_id', bulkAccessSelectedId);
          } else {
            revokeQuery = revokeQuery.eq('pathway_id', bulkAccessSelectedId);
          }
          await revokeQuery;
        }
        toast({ title: 'Success', description: `Access revoked for ${selectedStudents.size} student(s)` });
      }

      setBulkAccessDialogOpen(false);
      setSelectedStudents(new Set());
      await fetchStudents();
    } catch (error) {
      console.error('Error updating course access:', error);
      toast({ title: 'Error', description: 'Failed to update access', variant: 'destructive' });
    } finally {
      setBulkAccessLoading(false);
    }
  };

  const handleBulkBatchAssign = async () => {
    if (selectedStudents.size === 0) {
      toast({ title: 'Error', description: 'Please select at least one student', variant: 'destructive' });
      return;
    }
    setBulkBatchLoading(true);
    try {
      const selectedIds = Array.from(selectedStudents);
      const batchValue = bulkBatchId === 'none' ? null : bulkBatchId;
      let updatedCount = 0;

      // Process in batches of 50 to avoid URL length limits
      const chunkSize = 50;
      for (let i = 0; i < selectedIds.length; i += chunkSize) {
        const chunk = selectedIds.slice(i, i + chunkSize);
        
        const { data: studentRecords, error: recError } = await supabase
          .from('students')
          .select('id, user_id')
          .in('user_id', chunk);

        if (recError) {
          console.error('Error fetching student records chunk:', recError);
          continue;
        }
        if (!studentRecords || studentRecords.length === 0) continue;

        for (const record of studentRecords) {
          const { data: enrollment } = await supabase
            .from('course_enrollments')
            .select('id')
            .eq('student_id', record.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (enrollment) {
            const { error: updateError } = await supabase
              .from('course_enrollments')
              .update({ batch_id: batchValue, updated_at: new Date().toISOString() })
              .eq('id', enrollment.id);
            if (!updateError) updatedCount++;
          }
        }
      }

      toast({
        title: 'Success',
        description: `Batch updated for ${updatedCount} student(s)`
      });
      setBulkBatchDialogOpen(false);
      setBulkBatchId('none');
      setSelectedStudents(new Set());
      await fetchStudents();
    } catch (error) {
      console.error('Error bulk assigning batch:', error);
      toast({ title: 'Error', description: 'Failed to assign batch', variant: 'destructive' });
    } finally {
      setBulkBatchLoading(false);
    }
  };

  const openBulkBatchDialog = async () => {
    // Fetch active batches
    const { data: batchesData } = await supabase
      .from('batches')
      .select('id, name, start_date')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setBulkBatches(batchesData || []);
    setBulkBatchId('none');
    setBulkBatchDialogOpen(true);
  };

  const handleEditStudent = async (student: Student) => {
    setEditingStudent(student);
    setEditFormData({
      full_name: student.full_name,
      email: student.email,
      phone: student.phone || '',
      lms_user_id: student.lms_user_id || '',
      lms_status: student.lms_status,
      batch_id: null,
      enrollment_id: null
    });
    
    // Fetch batches
    const { data: batchesData } = await supabase
      .from('batches')
      .select('id, name, start_date')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setEditBatches(batchesData || []);
    
    // Fetch enrollment with batch_id
    if (student.student_record_id) {
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id, batch_id')
        .eq('student_id', student.student_record_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (enrollment) {
        setEditFormData(prev => ({
          ...prev,
          batch_id: enrollment.batch_id || null,
          enrollment_id: enrollment.id
        }));
      }
    }
    
    setEditDialog(true);
  };
  const handleUpdateStudent = async () => {
    if (!editingStudent) return;
    try {
      // Update users table
      const { error } = await supabase.from('users').update({
        full_name: editFormData.full_name,
        email: editFormData.email,
        phone: editFormData.phone,
        lms_user_id: editFormData.lms_user_id,
        lms_status: editFormData.lms_status,
        updated_at: new Date().toISOString()
      }).eq('id', editingStudent.id);
      if (error) throw error;
      
      // Update batch in enrollment if we have enrollment_id
      if (editFormData.enrollment_id) {
        const { error: enrollError } = await supabase
          .from('course_enrollments')
          .update({
            batch_id: editFormData.batch_id || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', editFormData.enrollment_id);
        
        if (enrollError) {
          console.error('Failed to update batch:', enrollError);
        }
      }
      
      toast({
        title: "Success",
        description: "Student details updated successfully"
      });
      setEditDialog(false);
      setEditingStudent(null);
      fetchStudents();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update student details: " + error.message,
        variant: "destructive"
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
      const passwordUpdate = {
        password_display: newPassword,
        is_temp_password: passwordType === 'temp',
        updated_at: new Date().toISOString(),
      };
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
    const courseNameMap = new Map(allCourses.map(c => [c.id, c.title]));
    const pathwayNameMap = new Map(allPathways.map(p => [p.id, p.name]));

    const studentIds = displayStudents.map(s => s.id);
    const studentRecordIds = displayStudents.map(s => s.student_record_id).filter(Boolean) as string[];

    // Parallel fetch: activity logs, assignments, recordings watched, enrollments
    const [logsRes, assignmentsRes, recordingsRes, enrollmentsRes] = await Promise.all([
      studentIds.length > 0
        ? supabase.from('user_activity_logs').select('user_id, activity_type, metadata, occurred_at').in('user_id', studentIds).order('occurred_at', { ascending: true })
        : Promise.resolve({ data: [] }),
      studentRecordIds.length > 0
        ? (supabase as any).from('student_assignments').select('student_id, status').in('student_id', studentRecordIds)
        : Promise.resolve({ data: [] }),
      studentRecordIds.length > 0
        ? (supabase as any).from('student_recordings').select('student_id').in('student_id', studentRecordIds)
        : Promise.resolve({ data: [] }),
      studentRecordIds.length > 0
        ? supabase.from('course_enrollments').select('student_id, course_id, pathway_id, batch_id, status').in('student_id', studentRecordIds).eq('status', 'active')
        : Promise.resolve({ data: [] }),
    ]);

    const allLogs = logsRes.data || [];
    const allAssignments = assignmentsRes.data || [];
    const allRecordings = recordingsRes.data || [];
    const allEnrollments = enrollmentsRes.data || [];

    // Resolve creator names for notes/suspensions
    const creatorIds = [...new Set(allLogs.map(l => {
      const meta = l.metadata as any;
      return meta?.created_by || meta?.suspended_by;
    }).filter(Boolean))];
    let creatorMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: creators } = await supabase.from('users').select('id, full_name').in('id', creatorIds);
      creatorMap = Object.fromEntries((creators || []).map(c => [c.id, c.full_name]));
    }

    // Group data by student
    const logsByStudent = new Map<string, any[]>();
    allLogs.forEach(log => {
      const list = logsByStudent.get(log.user_id) || [];
      list.push(log);
      logsByStudent.set(log.user_id, list);
    });

    const assignmentsByStudent = new Map<string, any[]>();
    allAssignments.forEach(a => {
      const list = assignmentsByStudent.get(a.student_id) || [];
      list.push(a);
      assignmentsByStudent.set(a.student_id, list);
    });

    const recordingCountByStudent = new Map<string, number>();
    allRecordings.forEach(r => {
      recordingCountByStudent.set(r.student_id, (recordingCountByStudent.get(r.student_id) || 0) + 1);
    });

    const enrollmentsByStudent = new Map<string, any[]>();
    allEnrollments.forEach(e => {
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

      // Assignments
      const studentAssignments = assignmentsByStudent.get(key) || [];
      const totalSubmitted = studentAssignments.length;
      const approved = studentAssignments.filter(a => a.status === 'approved').length;
      const declined = studentAssignments.filter(a => a.status === 'declined' || a.status === 'rejected').length;

      // Recordings watched
      const recordingsWatched = recordingCountByStudent.get(key) || 0;

      // Course/Pathway access
      const enrollments = enrollmentsByStudent.get(key) || [];
      const courseAccess = enrollments
        .filter(e => e.course_id && !e.pathway_id)
        .map(e => courseNameMap.get(e.course_id) || e.course_id)
        .join('; ');
      const pathwayAccess = enrollments
        .filter(e => e.pathway_id)
        .map(e => pathwayNameMap.get(e.pathway_id) || e.pathway_id)
        .join('; ');

      const studentLogs = logsByStudent.get(student.id) || [];

      // Format activity logs
      const activitySummary = studentLogs.map(log => {
        const ts = log.occurred_at ? format(new Date(log.occurred_at), 'yyyy-MM-dd HH:mm') : '';
        const meta = log.metadata as any || {};
        let detail = log.activity_type;
        if (log.activity_type === 'admin_note') {
          const by = creatorMap[meta.created_by] || 'Unknown';
          detail = `Note by ${by}: ${meta.note || ''}`;
        } else if (log.activity_type === 'lms_suspended') {
          const by = creatorMap[meta.suspended_by] || 'Unknown';
          const reason = meta.suspension_note || meta.note || meta.reason || 'No reason';
          detail = `Suspended by ${by}: ${reason}`;
          if (meta.auto_unsuspend_date) detail += ` (auto-unsuspend: ${meta.auto_unsuspend_date})`;
        } else if (log.activity_type === 'page_visit') {
          detail = `Page visit: ${meta.page || ''}`;
        } else if (log.activity_type === 'video_watched') {
          detail = `Video watched: ${meta.videoId || ''}`;
        }
        return `[${ts}] ${detail}`;
      }).join(' | ');

      // Notes only
      const notesSummary = studentLogs
        .filter(l => l.activity_type === 'admin_note')
        .map(log => {
          const meta = log.metadata as any || {};
          const by = creatorMap[meta.created_by] || 'Unknown';
          const ts = log.occurred_at ? format(new Date(log.occurred_at), 'yyyy-MM-dd HH:mm') : '';
          return `[${ts}] ${by}: ${meta.note || ''}`;
        }).join(' | ');

      return [
        escCsv(student.student_id || ''),
        escCsv(student.full_name || ''),
        escCsv(student.email || ''),
        escCsv(student.phone || ''),
        escCsv(String(installmentCount)),
        escCsv(student.lms_status || ''),
        escCsv(student.created_at ? format(new Date(student.created_at), 'yyyy-MM-dd') : ''),
        escCsv(String(totalFees)),
        escCsv(String(paidAmount)),
        escCsv(String(remainingAmount)),
        escCsv(invoiceStatus),
        escCsv(invoiceDueDate),
        escCsv(student.lms_user_id || ''),
        escCsv(student.password_display || ''),
        escCsv(String(totalSubmitted)),
        escCsv(String(approved)),
        escCsv(String(declined)),
        escCsv(String(recordingsWatched)),
        escCsv(courseAccess || 'None'),
        escCsv(pathwayAccess || 'None'),
        escCsv(batchNames || 'Unassigned'),
        escCsv(activitySummary),
        escCsv(notesSummary),
      ].join(',');
    });

    const header = 'Student ID,Name,Email,Phone,Installments,LMS Status,Joining Date,Total Fee Amount,Total Paid,Remaining to Pay,Invoice Status,Invoice Due Date,LMS ID,LMS Password,Assignments Submitted,Assignments Approved,Assignments Declined,Recordings Watched,Course Access,Pathway Access,Batch,Activity Logs,Admin Notes';
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `students-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
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
  const hasActiveFilters = Boolean(searchTerm) || lmsStatusFilter !== 'all' || feesStructureFilter !== 'all' || invoiceFilter !== 'all' || totalFeeSort !== 'none' || Boolean(feeRangeFrom) || Boolean(feeRangeTo) || Boolean(joinDateRange.from || joinDateRange.to) || batchFilter !== 'all' || enrollmentFilter.length > 0;
  const activeFilterCount = [lmsStatusFilter !== 'all', feesStructureFilter !== 'all', invoiceFilter !== 'all', totalFeeSort !== 'none' || Boolean(feeRangeFrom) || Boolean(feeRangeTo), Boolean(joinDateRange.from || joinDateRange.to), batchFilter !== 'all', enrollmentFilter.length > 0].filter(Boolean).length;
  const displayStudents = hasActiveFilters ? filteredStudents : students;
  const totalPages = Math.ceil(displayStudents.length / pageSize);
  const paginatedStudents = displayStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  return <div className="flex-1 min-w-0 p-6 space-y-6 animate-fade-in overflow-x-hidden px-0 bg-transparent">
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            👥 Students Management
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Manage student records and track their progress</p>
        </div>
        {!isSupportMember && (
          <div className="flex gap-2 flex-shrink-0">
            <Button variant="outline" onClick={handleExportCSV} className="hover-scale animate-scale-in">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="hover-scale bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 animate-scale-in">
              <Plus className="w-4 h-4 mr-2" />
              Add Student
            </Button>
          </div>
        )}
        
        {!isSupportMember && <EnhancedStudentCreationDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onStudentCreated={fetchStudents} />}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
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

        {!isSupportMember && (
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
        )}

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
      <div className="flex gap-4 items-center flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={isSupportMember ? "Search by ID or name..." : "Search by ID, name, email, or phone..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        
        <Button
          variant={filtersOpen ? "default" : "outline"}
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="relative"
        >
          <Filter className="w-4 h-4 mr-2" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2 bg-primary/20 text-primary text-xs px-1.5 py-0.5 min-w-[20px] h-5">
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLmsStatusFilter('all');
              setFeesStructureFilter('all');
              setInvoiceFilter('all');
              setBatchFilter('all');
              setTotalFeeSort('none');
              setFeeRangeFrom('');
              setFeeRangeTo('');
              setJoinDateRange({});
              setEnrollmentFilter([]);
              setSearchTerm('');
            }}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* Collapsible Filter Panel */}
      {filtersOpen && (
        <Card className="animate-fade-in">
          <CardContent className="pt-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {/* LMS Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">LMS Status</Label>
                <Select value={lmsStatusFilter} onValueChange={setLmsStatusFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="LMS Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All LMS Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="dropout">Dropout</SelectItem>
                    <SelectItem value="complete">Complete</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Fees Structure */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Installments</Label>
                <Select value={feesStructureFilter} onValueChange={setFeesStructureFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Fees Structure" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Installments</SelectItem>
                    {installmentOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Invoice Status */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Fees Status</Label>
                <Select value={invoiceFilter} onValueChange={setInvoiceFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Invoice Status" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Fees Status</SelectItem>
                    <SelectItem value="no_invoice">No Invoice</SelectItem>
                    <SelectItem value="fees_due">Fees Due</SelectItem>
                    <SelectItem value="fees_overdue">Fees Overdue</SelectItem>
                    <SelectItem value="fees_cleared">Fees Cleared</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Batch */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Batch</Label>
                <Select value={batchFilter} onValueChange={setBatchFilter}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Batch" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all">All Batches</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {batchOptions.map(batch => (
                      <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Course / Pathway Filter */}
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-medium text-muted-foreground">Course / Pathway Enrollment</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-between text-left font-normal h-9 text-sm", enrollmentFilter.length === 0 && "text-muted-foreground")}>
                      <span className="truncate">
                        {enrollmentFilter.length === 0
                          ? 'All Courses & Pathways'
                          : `${enrollmentFilter.length} selected`}
                      </span>
                      <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0 bg-background z-50" align="start">
                    <ScrollArea className="h-72">
                      <div className="p-2">
                        {/* None option */}
                        <div
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setEnrollmentFilter(prev =>
                              prev.includes('none') ? prev.filter(f => f !== 'none') : [...prev, 'none']
                            );
                          }}
                        >
                          <Checkbox checked={enrollmentFilter.includes('none')} />
                          <span className="text-sm font-medium text-muted-foreground italic">No enrollment</span>
                        </div>

                        {/* Pathways group */}
                        {allPathways.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 mt-2">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pathways</span>
                            </div>
                            {allPathways.map(p => (
                              <div
                                key={`pathway:${p.id}`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                                onClick={() => {
                                  const key = `pathway:${p.id}`;
                                  setEnrollmentFilter(prev =>
                                    prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
                                  );
                                }}
                              >
                                <Checkbox checked={enrollmentFilter.includes(`pathway:${p.id}`)} />
                                <span className="text-sm">{p.name}</span>
                              </div>
                            ))}
                          </>
                        )}

                        {/* Courses group */}
                        {allCourses.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 mt-2">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Courses</span>
                            </div>
                            {allCourses.map(c => (
                              <div
                                key={`course:${c.id}`}
                                className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer"
                                onClick={() => {
                                  const key = `course:${c.id}`;
                                  setEnrollmentFilter(prev =>
                                    prev.includes(key) ? prev.filter(f => f !== key) : [...prev, key]
                                  );
                                }}
                              >
                                <Checkbox checked={enrollmentFilter.includes(`course:${c.id}`)} />
                                <span className="text-sm">{c.title}</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </ScrollArea>
                    {enrollmentFilter.length > 0 && (
                      <div className="border-t p-2">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setEnrollmentFilter([])}>
                          Clear selection
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Fee Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Fee Amount</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !(feeRangeFrom || feeRangeTo || totalFeeSort !== 'none') && "text-muted-foreground")}>
                      <DollarSign className="mr-2 h-4 w-4" />
                      {feeRangeFrom || feeRangeTo
                        ? `${feeRangeFrom || '0'} – ${feeRangeTo || '∞'}`
                        : totalFeeSort !== 'none'
                          ? totalFeeSort === 'low_to_high' ? 'Low → High' : 'High → Low'
                          : 'Fee Amount'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4 pointer-events-auto space-y-3 bg-background z-50" align="start" sideOffset={4}>
                    <p className="text-sm font-medium text-foreground">Fee Amount Range</p>
                    <div className="flex items-center gap-2">
                      <Input type="number" placeholder="From" value={feeRangeFrom} onChange={(e) => setFeeRangeFrom(e.target.value)} className="h-9 text-sm" min="0" />
                      <span className="text-muted-foreground text-sm">–</span>
                      <Input type="number" placeholder="To" value={feeRangeTo} onChange={(e) => setFeeRangeTo(e.target.value)} className="h-9 text-sm" min="0" />
                    </div>
                    <div className="border-t pt-2">
                      <p className="text-sm font-medium text-foreground mb-2">Sort</p>
                      <Select value={totalFeeSort} onValueChange={setTotalFeeSort}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Sort order" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="none">No sorting</SelectItem>
                          <SelectItem value="low_to_high">Lowest to Highest</SelectItem>
                          <SelectItem value="high_to_low">Highest to Lowest</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFeeRangeFrom(''); setFeeRangeTo(''); setTotalFeeSort('none'); }}>Clear</Button>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Joining Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Joining Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9 text-sm", !(joinDateRange.from || joinDateRange.to) && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {joinDateRange.from && joinDateRange.to
                        ? `${format(joinDateRange.from, 'dd MMM')} – ${format(joinDateRange.to, 'dd MMM yyyy')}`
                        : joinDateRange.from
                          ? `From ${format(joinDateRange.from, 'dd MMM yyyy')}`
                          : 'Joining Date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto bg-background z-50" align="start" sideOffset={4}>
                    <Calendar
                      mode="range"
                      defaultMonth={joinDateRange.from}
                      selected={joinDateRange.from ? { from: joinDateRange.from, to: joinDateRange.to } : undefined}
                      onSelect={(range: any) => {
                        if (!range) { setJoinDateRange({}); } else { setJoinDateRange({ from: range.from, to: range.to }); }
                      }}
                      disabled={(date) => date > new Date()}
                      numberOfMonths={1}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                    {(joinDateRange.from || joinDateRange.to) && (
                      <div className="p-3 pt-0">
                        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setJoinDateRange({})}>Clear dates</Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bulk Actions - Sticky toolbar */}
      {selectedStudents.size > 0 && !isSupportMember && (
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-border rounded-lg shadow-lg p-3 sm:p-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Left: Selection info */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant="secondary" className="bg-primary/10 text-primary font-semibold px-3 py-1 text-sm">
                {selectedStudents.size} selected
              </Badge>
              <Button variant="ghost" size="sm" onClick={() => setSelectedStudents(new Set())} className="text-muted-foreground hover:text-foreground text-xs h-7">
                Clear
              </Button>
            </div>

            {/* Right: Action groups */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              {/* Mark Paid Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm gap-1.5">
                    <DollarSign className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">Mark</span> Paid
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="end">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="sm" className="justify-start text-sm h-9" onClick={() => handleBulkMarkInstallmentPaid(1)}>
                      <DollarSign className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                      1st Installment
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start text-sm h-9" onClick={() => handleBulkMarkInstallmentPaid(2)}>
                      <DollarSign className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                      2nd Installment
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start text-sm h-9" onClick={() => handleBulkMarkInstallmentPaid(3)}>
                      <DollarSign className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                      3rd Installment
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Course Access Dropdown */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    Access
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-44 p-1.5" align="end">
                  <div className="flex flex-col gap-0.5">
                    <Button variant="ghost" size="sm" className="justify-start text-sm h-9" onClick={() => openBulkAccessDialog('grant')}>
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-600" />
                      Grant Access
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start text-sm h-9" onClick={() => openBulkAccessDialog('revoke')}>
                      <Ban className="w-3.5 h-3.5 mr-2 text-red-500" />
                      Revoke Access
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start text-sm h-9" onClick={() => handleBulkLMSAction('activate')}>
                      <CheckCircle className="w-3.5 h-3.5 mr-2 text-green-600" />
                      Activate LMS
                    </Button>
                    <Button variant="ghost" size="sm" className="justify-start text-sm h-9" onClick={() => handleBulkLMSAction('suspend')}>
                      <Ban className="w-3.5 h-3.5 mr-2 text-red-500" />
                      Suspend LMS
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Resend Invoice */}
              <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm gap-1.5" onClick={handleBulkResendInvoice} disabled={bulkResendLoading}>
                <Send className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{bulkResendLoading ? 'Sending...' : 'Resend'}</span> Invoice
              </Button>

              {/* Batch Assignment */}
              <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm gap-1.5" onClick={openBulkBatchDialog}>
                <Users className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Assign</span> Batch
              </Button>

              {/* Delete - separated with divider */}
              <div className="hidden sm:block w-px h-6 bg-border mx-1" />
              <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleBulkDelete} disabled={userManagementLoading}>
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Students Table */}
      <Card className="w-full animate-fade-in">
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
                  {!isSupportMember && (
                    <TableHead className="w-12 pl-6">
                      <Checkbox checked={selectedStudents.size === displayStudents.length && displayStudents.length > 0} onCheckedChange={handleSelectAll} />
                    </TableHead>
                  )}
                  <TableHead>Student ID</TableHead>
                  <TableHead>Name</TableHead>
                  {!isSupportMember && <TableHead>Email</TableHead>}
                  {!isSupportMember && <TableHead>Phone</TableHead>}
                  <TableHead>Batch</TableHead>
                  {!isSupportMember && <TableHead>Fees Structure</TableHead>}
                  <TableHead>LMS Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead className="pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedStudents.map(student => {
                const rowElements = [<TableRow key={`main-${student.id}`}>
                    {!isSupportMember && (
                      <TableCell className="pl-6">
                        <Checkbox checked={selectedStudents.has(student.id)} onCheckedChange={checked => handleSelectStudent(student.id, checked as boolean)} />
                      </TableCell>
                    )}
                      <TableCell className="font-medium whitespace-normal break-words">{student.student_id}</TableCell>
                      <TableCell className="whitespace-normal break-words">{student.full_name}</TableCell>
                      {!isSupportMember && <TableCell className="whitespace-normal break-words">{student.email}</TableCell>}
                      {!isSupportMember && <TableCell className="whitespace-normal break-words">{student.phone || 'N/A'}</TableCell>}
                      <TableCell className="whitespace-normal break-words">
                        {(() => {
                          const batchIds = studentBatchMap.get(student.id) || [];
                          if (batchIds.length === 0) return <span className="text-muted-foreground text-xs">Unassigned</span>;
                          return batchIds.map(bid => {
                            const found = batchOptions.find(b => b.id === bid);
                            return found?.name || bid;
                          }).join(', ');
                        })()}
                      </TableCell>
                      {!isSupportMember && <TableCell>{getFeesStructureLabel(student.fees_structure)}</TableCell>}
                        <TableCell>
                           <div className="flex flex-wrap gap-2">
                             <Badge className={getLMSStatusColor(student.lms_status)}>
                               <div className="flex items-center">
                                 {getLMSStatusIcon(student.lms_status)}
                                 <span className="text-xs font-medium">{getLMSStatusLabel(student.lms_status)}</span>
                               </div>
                             </Badge>
                              {(() => {
                                const scheduled = scheduledSuspensions.get(student.id);
                                if (!scheduled) return null;
                                const scheduledDate = formatDate(scheduled.schedule_suspend_date);
                                return (
                                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 cursor-pointer" onClick={() => handleCancelScheduledSuspension(student)} title={`Scheduled: ${scheduledDate}. Click to cancel.`}>
                                    <Clock className="w-3 h-3 mr-1" />
                                    <span className="text-xs font-medium">Suspend: {scheduledDate}</span>
                                  </Badge>
                                );
                              })()}
                             {!isSupportMember && (() => {
                        const inst = getInstallmentStatus(student);
                        return <Badge className={inst.color}>
                                 <span className="text-xs font-medium whitespace-normal break-words text-center">{inst.status}</span>
                               </Badge>;
                      })()}
                           </div>
                         </TableCell>
                         <TableCell>{student.creator?.full_name || 'System'}</TableCell>
                         <TableCell className="pr-6">
                           <div className="flex space-x-1">
                             {isSupportMember ? (
                               <Button variant="outline" size="sm" onClick={() => { setSelectedStudentForNotes(student); setNotesDialogOpen(true); }} title="View Notes" className="hover-scale hover:border-amber-300 hover:text-amber-600">
                                 <MessageSquare className="w-4 h-4 mr-1" />
                                 Notes
                               </Button>
                             ) : (
                               <>
                                 <Button variant="outline" size="sm" onClick={() => {
                                   if (user?.role === 'admin' || user?.role === 'superadmin') {
                                     handleEditStudent(student);
                                   } else {
                                     toast({
                                       title: "Access Denied",
                                       description: "Only admins and superadmins can edit student details.",
                                       variant: "destructive"
                                     });
                                   }
                                 }} title="Edit Student Details" className="hover-scale hover:border-blue-300 hover:text-blue-600">
                                   <Edit className="w-4 h-4" />
                                 </Button>
                                 <Button variant="outline" size="sm" onClick={() => toggleRowExpansion(student.id)} title={expandedRows.has(student.id) ? "Collapse" : "Expand"} className="hover-scale hover:border-green-300 hover:text-green-600">
                                   {expandedRows.has(student.id) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                 </Button>
                               </>
                             )}
                           </div>
                         </TableCell>
                      </TableRow>];
                if (expandedRows.has(student.id)) {
                  const expandedColSpan = isSupportMember ? 6 : 10;
                  rowElements.push(<TableRow key={`expanded-${student.id}`} className="animate-accordion-down">
                         <TableCell colSpan={expandedColSpan} className="w-full bg-gradient-to-r from-slate-50 to-blue-50 p-0 border-l-4 border-l-blue-200">
                          <div className="w-full space-y-3 p-4 box-border">
                            {isSupportMember ? (
                              /* Support member: only show joining date and notes */
                              <>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground">Joining Date</Label>
                                    <p className="text-sm text-foreground">{formatDate(student.created_at)}</p>
                                  </div>
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground">LMS Status</Label>
                                    <Badge className={getLMSStatusColor(student.lms_status)}>
                                      <div className="flex items-center">
                                        {getLMSStatusIcon(student.lms_status)}
                                        <span className="text-xs font-medium">{getLMSStatusLabel(student.lms_status)}</span>
                                      </div>
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-3 border-t border-blue-200">
                                  <Button variant="outline" size="sm" onClick={() => { setSelectedStudentForNotes(student); setNotesDialogOpen(true); }} className="hover-scale hover:border-amber-300 hover:text-amber-600">
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Notes
                                  </Button>
                                </div>
                              </>
                            ) : (
                              /* Admin/Superadmin: full expanded view */
                              <>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {/* Row 1: Joining Date, Fees Structure, Last Invoice Sent Date */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Joining Date</Label>
                                <p className="text-sm text-foreground">{formatDate(student.created_at)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Fees Structure</Label>
                                <p className="text-sm text-foreground">{getFeesStructureLabel(student.fees_structure)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Last Invoice Sent Date</Label>
                                <p className="text-sm text-foreground">{getLastInvoiceSentDate(student)}</p>
                              </div>

                              {/* Payment Summary */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Total Fee Amount</Label>
                                <p className="text-sm text-foreground font-semibold">
                                  {(() => {
                                    const key = student.student_record_id || '';
                                    const payments = installmentPayments.get(key) || [];
                                    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                                    return payments.length > 0 ? formatCurrency(totalAmount, companyCurrency) : 'N/A';
                                  })()}
                                </p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Amount Paid</Label>
                                <p className="text-sm text-green-600 font-semibold">
                                  {(() => {
                                    const key = student.student_record_id || '';
                                    const payments = installmentPayments.get(key) || [];
                                    const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
                                    return formatCurrency(paidAmount, companyCurrency);
                                  })()}
                                </p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Outstanding Balance</Label>
                                <p className={`text-sm font-semibold ${(() => {
                                  const key = student.student_record_id || '';
                                  const payments = installmentPayments.get(key) || [];
                                  const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                                  const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
                                  return (totalAmount - paidAmount) > 0 ? 'text-red-600' : 'text-green-600';
                                })()}`}>
                                  {(() => {
                                    const key = student.student_record_id || '';
                                    const payments = installmentPayments.get(key) || [];
                                    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
                                    const paidAmount = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.amount || 0), 0);
                                    const outstanding = totalAmount - paidAmount;
                                    return payments.length > 0 ? formatCurrency(outstanding, companyCurrency) : 'N/A';
                                  })()}
                                </p>
                              </div>

                              {/* Row 2: Invoice Due Date, Invoice Status, LMS User ID */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Invoice Due Date</Label>
                                <p className={`text-sm ${isInvoiceOverdue(student) ? 'text-destructive font-medium' : 'text-foreground'}`}>
                                  {getInvoiceDueDate(student)}
                                </p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">Invoice Status</Label>
                                <p className="text-sm text-foreground">{getInvoiceStatus(student)}</p>
                              </div>
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">LMS User ID</Label>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-foreground">{student.lms_user_id || 'Not set'}</p>
                                  {student.lms_user_id && <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(student.lms_user_id)} title="Copy LMS User ID">
                                      <Key className="w-3 h-3" />
                                    </Button>}
                                </div>
                              </div>

                              {/* Row 3: LMS Password */}
                              <div>
                                <Label className="text-sm font-medium text-muted-foreground">LMS Password</Label>
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm text-foreground font-mono bg-muted px-3 py-2 rounded border">
                                    {student.password_display || 'Not set'}
                                  </p>
                                  {student.password_display && <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(student.password_display)} title="Copy password">
                                      <Key className="w-3 h-3" />
                                    </Button>}
                                </div>
                              </div>

                              {/* Optional: Last Suspended Date */}
                              {student.last_suspended_date && <div>
                                  <Label className="text-sm font-medium text-muted-foreground">Last Suspended Date</Label>
                                  <p className="text-sm text-destructive">{formatDate(student.last_suspended_date)}</p>
                                </div>}
                            </div>
                            
                            {/* Installment Payment Buttons */}
                            {(student.fees_structure === '1_installment' || student.fees_structure === '2_installments' || student.fees_structure === '3_installments') && <div className="pt-3 border-t border-blue-200">
                                <Label className="text-sm font-medium text-gray-700 mb-2 block">Installment Payments</Label>
                                <div className="flex flex-wrap gap-2">
                                  {Array.from({
                              length: student.fees_structure === '1_installment' ? 1 : student.fees_structure === '2_installments' ? 2 : 3
                            }, (_, index) => {
                              const installmentNumber = index + 1;
                              const payments = installmentPayments.get(student.student_record_id || '') || installmentPayments.get(student.id) || [];
                              const isPaid = payments.some(p => p.installment_number === installmentNumber && p.status === 'paid');
                              return <Button key={installmentNumber} variant={isPaid ? "default" : "outline"} size="sm" disabled={isPaid} onClick={() => handleMarkInstallmentPaid(student.id, installmentNumber)} className={`hover-scale ${isPaid ? "bg-green-500 hover:bg-green-600" : "hover:border-green-300 hover:text-green-600"}`}>
                                        {isPaid ? <CheckCircle className="w-4 h-4 mr-2" /> : <DollarSign className="w-4 h-4 mr-2" />}
                                        {isPaid ? `${installmentNumber}${installmentNumber === 1 ? 'st' : installmentNumber === 2 ? 'nd' : 'rd'} Paid` : `Mark ${installmentNumber}${installmentNumber === 1 ? 'st' : installmentNumber === 2 ? 'nd' : 'rd'} Paid`}
                                      </Button>;
                            })}
                                </div>
                              </div>}
                            
                            <div className="flex flex-wrap gap-2 pt-3 border-t border-blue-200">
                              <Button variant="outline" size="sm" onClick={() => handleViewActivityLogs(student.id)} className="hover-scale hover:border-blue-300 hover:text-blue-600">
                                <Eye className="w-4 h-4 mr-2" />
                                View Activity Logs
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => { setSelectedStudentForNotes(student); setNotesDialogOpen(true); }} className="hover-scale hover:border-amber-300 hover:text-amber-600">
                                <MessageSquare className="w-4 h-4 mr-2" />
                                Notes
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => handleResendInvoice(student)} className="hover-scale hover:border-purple-300 hover:text-purple-600">
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
                              {student.last_invoice_date && <Button variant="outline" size="sm" onClick={() => downloadInvoicePDF(student)} className="hover-scale hover:border-orange-300 hover:text-orange-600">
                                  <Download className="w-4 h-4 mr-2" />
                                  Download Invoice
                                </Button>}
                              <Popover>
                                <PopoverTrigger asChild>
                                  <Button variant="outline" size="sm" className="hover-scale hover:border-blue-300 hover:text-blue-600">
                                    <Settings className="w-4 h-4 mr-2" />
                                    LMS Status
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-48 p-2" align="start">
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Change LMS Status</p>
                                    {['active', 'inactive', 'suspended', 'dropout', 'complete'].map((status) => (
                                      <Button
                                        key={status}
                                        variant={student.lms_status === status ? "secondary" : "ghost"}
                                        size="sm"
                                        className="w-full justify-start text-sm"
                                        onClick={async () => {
                                          if (student.lms_status !== status) {
                                            if (status === 'suspended') {
                                              setStudentForSuspension(student);
                                              setSuspensionDialogOpen(true);
                                              return;
                                            }
                                            try {
                                              const { error } = await supabase.from('users').update({
                                                lms_status: status,
                                                updated_at: new Date().toISOString()
                                              }).eq('id', student.id);
                                              if (error) throw error;
                                              toast({
                                                title: 'Success',
                                                description: `LMS status updated to ${status}`
                                              });
                                              fetchStudents();
                                            } catch (error) {
                                              console.error('Error updating status:', error);
                                              toast({
                                                title: 'Error',
                                                description: 'Failed to update status',
                                                variant: 'destructive'
                                              });
                                            }
                                          }
                                        }}
                                        disabled={student.lms_status === status}
                                      >
                                        {status === 'active' && <CheckCircle className="w-3 h-3 mr-2 text-green-600" />}
                                        {status === 'inactive' && <Clock className="w-3 h-3 mr-2 text-yellow-600" />}
                                        {status === 'suspended' && <Ban className="w-3 h-3 mr-2 text-red-600" />}
                                        {status === 'dropout' && <XCircle className="w-3 h-3 mr-2 text-orange-600" />}
                                        {status === 'complete' && <Award className="w-3 h-3 mr-2 text-blue-600" />}
                                        {status.charAt(0).toUpperCase() + status.slice(1)}
                                      </Button>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                               
                               <Button 
                                 variant="outline" 
                                 size="sm" 
                                 onClick={() => {
                                   setSelectedStudentForAccess(student);
                                   setAccessManagementOpen(true);
                                 }}
                                 className="hover-scale hover:border-indigo-300 hover:text-indigo-600"
                               >
                                 <BookOpen className="w-4 h-4 mr-2" />
                                 Manage Access
                               </Button>
                               <Button 
                                 variant="outline" 
                                 size="sm" 
                                 onClick={() => handleResetSuccessPartnerCredits(student.id)}
                                 className="hover-scale hover:border-yellow-300 hover:text-yellow-600"
                               >
                                 <RefreshCw className="w-4 h-4 mr-2" />
                                  Reset SP Credits
                                </Button>

                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm" 
                                      className="hover-scale hover:border-blue-300 hover:text-blue-600"
                                      disabled={!student.original_password && !student.password_display}
                                    >
                                      <Key className="w-4 h-4 mr-2" />
                                      Reset Password
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Reset Password</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will reset {student.full_name}'s login password to their original default password ({student.original_password || student.password_display || 'N/A'}). The student will need to use this password to log in.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleResetPassword(student.id, student.full_name, student.original_password || student.password_display, student.email)}>
                                        Reset Password
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                                
                               <AlertDialog>
                                 <AlertDialogTrigger asChild>
                                   <Button variant="outline" size="sm" className="hover-scale text-red-600 hover:text-red-700 hover:border-red-300">
                                     <Trash2 className="w-4 h-4 mr-2" />
                                     Delete Student
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
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>);
                }
                return rowElements;
              })}
              </TableBody>
            </Table>
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 px-2">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, displayStudents.length)} of {displayStudents.length} students
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                  <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* Activity Logs Dialog */}
      <Dialog open={activityLogsDialog} onOpenChange={setActivityLogsDialog}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
            <DialogTitle className="text-xl font-semibold text-primary">
              Activity Logs - {selectedStudentForLogs?.full_name}
            </DialogTitle>
            <Button variant="outline" size="sm" className="ml-auto hover:bg-primary/10">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </DialogHeader>
          
          <div className="space-y-4 overflow-hidden flex flex-col">
            {/* Search and Filters */}
            <div className="flex gap-4 items-center flex-wrap bg-muted/30 p-4 rounded-lg">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by user or activity..." className="pl-10 bg-background" />
              </div>
              
              <Select defaultValue="last_7_days">
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="last_7_days">Last 7 days</SelectItem>
                  <SelectItem value="last_30_days">Last 30 days</SelectItem>
                  <SelectItem value="all_time">All time</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all_roles">
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50">
                  <SelectItem value="all_roles">All Roles</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="mentor">Mentor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all_activities">
                <SelectTrigger className="w-36 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border z-50 max-h-60">
                  <SelectItem value="all_activities">All Activities</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="page_visit">Page Visit</SelectItem>
                  <SelectItem value="video_watched">Video Watched</SelectItem>
                  <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                  <SelectItem value="assignment_approved">Assignment Approved</SelectItem>
                  <SelectItem value="assignment_declined">Assignment Declined</SelectItem>
                  <SelectItem value="recording_unlocked">Recording Unlocked</SelectItem>
                  <SelectItem value="support_ticket_created">Support Ticket Created</SelectItem>
                  <SelectItem value="support_ticket_replied">Support Ticket Reply</SelectItem>
                  <SelectItem value="success_session_scheduled">Success Session Scheduled</SelectItem>
                  <SelectItem value="success_session_attended">Success Session Attended</SelectItem>
                  <SelectItem value="module_completed">Module Completed</SelectItem>
                  <SelectItem value="profile_updated">Profile Updated</SelectItem>
                  <SelectItem value="certificate_generated">Certificate Generated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {activityLogs.length} of {activityLogs.length} activities
              </p>
            </div>

            {/* Activity Logs Table */}
            <div className="flex-1 overflow-hidden">
              <ScrollArea className="h-[50vh] border rounded-lg bg-background">
                <Table>
                  <TableHeader className="sticky top-0 bg-muted/50 z-10">
                     <TableRow className="border-b">
                       <TableHead className="w-44 font-semibold">Timestamp</TableHead>
                       <TableHead className="w-36 font-semibold">Activity</TableHead>
                       <TableHead className="font-semibold">Details</TableHead>
                       <TableHead className="w-64 font-semibold">Sub Details</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {activityLogs.length === 0 ? <TableRow>
                         <TableCell colSpan={4} className="text-center text-muted-foreground py-12">
                           <div className="flex flex-col items-center space-y-2">
                             <Activity className="w-8 h-8 text-muted-foreground/50" />
                             <p>No activity logs found for this student.</p>
                           </div>
                         </TableCell>
                       </TableRow> : activityLogs.map((log, index) => <TableRow key={log.id} className={index % 2 === 0 ? "bg-muted/20" : "bg-background"}>
                           <TableCell className="text-xs text-muted-foreground">
                             {formatDateTime(log.occurred_at)}
                           </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${
                              log.activity_type === 'login' ? 'bg-green-100 text-green-800 border-green-200' : 
                              log.activity_type === 'logout' ? 'bg-red-100 text-red-800 border-red-200' : 
                              log.activity_type === 'page_visit' ? 'bg-blue-100 text-blue-800 border-blue-200' : 
                              log.activity_type === 'video_watched' ? 'bg-purple-100 text-purple-800 border-purple-200' : 
                              log.activity_type === 'assignment_submitted' ? 'bg-orange-100 text-orange-800 border-orange-200' : 
                              log.activity_type === 'assignment_approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                              log.activity_type === 'assignment_declined' ? 'bg-rose-100 text-rose-800 border-rose-200' : 
                              log.activity_type === 'recording_unlocked' ? 'bg-cyan-100 text-cyan-800 border-cyan-200' : 
                              log.activity_type === 'module_completed' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 
                              log.activity_type === 'support_ticket_created' ? 'bg-amber-100 text-amber-800 border-amber-200' : 
                              log.activity_type === 'support_ticket_replied' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' : 
                              log.activity_type === 'success_session_scheduled' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' : 
                              log.activity_type === 'success_session_attended' ? 'bg-teal-100 text-teal-800 border-teal-200' : 
                              'bg-gray-100 text-gray-800 border-gray-200'
                            }`}>
                              {log.activity_type.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="whitespace-normal">
                              {(() => {
                          const metadata = log.metadata || {};
                          switch (log.activity_type) {
                            case 'page_visit':
                              if (metadata.video_title) {
                                return `Visited video player: "${metadata.video_title}"`;
                              }
                              return `Visited page: ${metadata.page || metadata.url || 'Unknown page'}`;
                            case 'video_watched':
                              return `Watched video: "${metadata.video_title || metadata.title || 'Unknown video'}"${metadata.module_name ? ` — Module: "${metadata.module_name}"` : ''}${metadata.course_name && metadata.course_name !== 'N/A' ? ` — Course: "${metadata.course_name}"` : ''}`;
                            case 'assignment_submitted':
                              return `Submitted assignment: "${metadata.assignment_name || metadata.assignment_title || 'Unknown'}"${metadata.version ? ` (v${metadata.version})` : ''}`;
                            case 'assignment_approved':
                              return `Assignment approved: "${metadata.assignment_name || 'Unknown'}"${metadata.reviewed_by ? ` by ${metadata.reviewed_by}` : ''}${metadata.notes ? ` — "${metadata.notes}"` : ''}`;
                            case 'assignment_declined':
                              return `Assignment declined: "${metadata.assignment_name || 'Unknown'}"${metadata.reviewed_by ? ` by ${metadata.reviewed_by}` : ''}${metadata.notes ? ` — "${metadata.notes}"` : ''}`;
                            case 'recording_unlocked':
                              return `Recording unlocked: "${metadata.recording_title || 'Unknown'}"${metadata.module_name ? ` in "${metadata.module_name}"` : ''}`;
                            case 'module_completed':
                              return `Completed module: "${metadata.module_title || metadata.title || 'Unknown module'}"`;
                            case 'support_ticket_created':
                              return `Created support ticket: "${metadata.ticket_title || 'Unknown'}" (${metadata.ticket_type || 'general'})`;
                            case 'support_ticket_replied':
                              return `Replied to support ticket${metadata.ticket_id ? ` #${metadata.ticket_id.substring(0, 8)}` : ''}`;
                            case 'success_session_scheduled':
                              return `Success session scheduled: "${metadata.session_title || 'Unknown'}"${metadata.session_date ? ` for ${metadata.session_date}` : ''}${metadata.scheduled_by ? ` by ${metadata.scheduled_by}` : ''}`;
                            case 'success_session_attended':
                              return `Attended success session: "${metadata.session_title || 'Unknown'}"${metadata.session_date ? ` on ${metadata.session_date}` : ''}`;
                            case 'certificate_generated':
                              return `Generated certificate for: "${metadata.course_title || metadata.title || 'Unknown course'}"`;
                            case 'login':
                              return `Logged in${metadata.email ? ` (${metadata.email})` : ''}`;
                            case 'logout':
                              return `Logged out`;
                            case 'profile_updated':
                              return `Updated profile ${metadata.fields_changed ? `(Changed: ${metadata.fields_changed.join(', ')})` : ''}`;
                            default:
                              return formatActivityType(log.activity_type);
                          }
                        })()}
                             </div>
                           </TableCell>
                           <TableCell className="text-sm">
                             {(() => {
                               const metadata = log.metadata || {};
                               if (log.activity_type === 'lms_suspended') {
                                 const note = metadata.suspension_note || metadata.note || metadata.reason;
                                 return (
                                   <div className="space-y-0.5">
                                     {note && <div className="text-xs text-destructive font-medium">Reason: {note}</div>}
                                     {metadata.auto_unsuspend_date && (
                                       <div className="text-xs">Auto-unsuspend: {new Date(metadata.auto_unsuspend_date).toLocaleDateString()}</div>
                                     )}
                                     {metadata.suspended_by_name && <div className="text-xs">By: {metadata.suspended_by_name}</div>}
                                   </div>
                                 );
                               }
                               if (log.activity_type === 'admin_note') {
                                 const note = metadata.note || metadata.suspension_note;
                                 return (
                                   <div className="space-y-0.5">
                                     {note && <div className="text-xs italic">"{note}"</div>}
                                     {metadata.added_by_name && <div className="text-xs">By: {metadata.added_by_name}</div>}
                                   </div>
                                 );
                               }
                               if (metadata && Object.keys(metadata).length > 0) {
                                 return (
                                   <div className="text-xs opacity-60 max-w-[250px] truncate">
                                     {JSON.stringify(metadata)}
                                   </div>
                                 );
                               }
                               return <span className="text-xs text-muted-foreground">—</span>;
                             })()}
                           </TableCell>
                         </TableRow>)}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
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

      {/* Student Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Student Details - {editingStudent?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_full_name">Full Name</Label>
                <Input id="edit_full_name" value={editFormData.full_name} onChange={e => setEditFormData({
                ...editFormData,
                full_name: e.target.value
              })} placeholder="Enter full name" />
              </div>
              <div>
                <Label htmlFor="edit_email">Email</Label>
                <Input id="edit_email" type="email" value={editFormData.email} onChange={e => setEditFormData({
                ...editFormData,
                email: e.target.value
              })} placeholder="Enter email" />
              </div>
              <div>
                <Label htmlFor="edit_phone">Phone</Label>
                <Input id="edit_phone" value={editFormData.phone} onChange={e => setEditFormData({
                ...editFormData,
                phone: e.target.value
              })} placeholder="Enter phone number" />
              </div>
              <div>
                <Label htmlFor="edit_lms_user_id">LMS User ID</Label>
                <Input id="edit_lms_user_id" value={editFormData.lms_user_id} onChange={e => setEditFormData({
                ...editFormData,
                lms_user_id: e.target.value
              })} placeholder="Enter LMS User ID" />
              </div>
              <div>
                <Label htmlFor="edit_lms_status">LMS Status</Label>
                <Select value={editFormData.lms_status} onValueChange={value => setEditFormData({
                ...editFormData,
                lms_status: value
              })}>
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
              <div>
                <Label htmlFor="edit_batch">Batch Assignment</Label>
                <Select 
                  value={editFormData.batch_id || "none"} 
                  onValueChange={value => setEditFormData({
                    ...editFormData,
                    batch_id: value === "none" ? null : value
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a batch" />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="none">No Batch (Use LMS Access Date)</SelectItem>
                    {editBatches.map((batch) => (
                      <SelectItem key={batch.id} value={batch.id}>
                        {batch.name} (Start: {formatDate(batch.start_date)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => {
              setEditDialog(false);
              setEditingStudent(null);
            }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateStudent}>
                Update Student
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

      {/* Student Access Management Dialog */}
      {selectedStudentForAccess && (
        <StudentAccessManagement
          open={accessManagementOpen}
          onOpenChange={setAccessManagementOpen}
          studentId={selectedStudentForAccess.student_record_id || ''}
          studentUserId={selectedStudentForAccess.id}
          studentName={selectedStudentForAccess.full_name}
          onAccessUpdated={fetchStudents}
        />
      )}

      {/* Bulk Batch Assignment Dialog */}
      <Dialog open={bulkBatchDialogOpen} onOpenChange={setBulkBatchDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>Assign Batch to {selectedStudents.size} Student(s)</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Select Batch</Label>
              <Select value={bulkBatchId} onValueChange={setBulkBatchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="none">No Batch</SelectItem>
                  {bulkBatches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name} (Start: {formatDate(batch.start_date)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkBatchDialogOpen(false)} disabled={bulkBatchLoading}>Cancel</Button>
              <Button onClick={handleBulkBatchAssign} disabled={bulkBatchLoading}>
                {bulkBatchLoading ? 'Assigning...' : 'Assign Batch'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Access Grant/Revoke Dialog */}
      <Dialog open={bulkAccessDialogOpen} onOpenChange={setBulkAccessDialogOpen}>
        <DialogContent className="bg-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {bulkAccessAction === 'grant' ? 'Grant' : 'Revoke'} Access for {selectedStudents.size} Student(s)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                variant={bulkAccessType === 'course' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setBulkAccessType('course'); setBulkAccessSelectedId(''); }}
              >
                <BookOpen className="w-4 h-4 mr-1" />
                Course
              </Button>
              <Button
                variant={bulkAccessType === 'pathway' ? 'default' : 'outline'}
                size="sm"
                onClick={() => { setBulkAccessType('pathway'); setBulkAccessSelectedId(''); }}
              >
                <Activity className="w-4 h-4 mr-1" />
                Pathway
              </Button>
            </div>
            <div>
              <Label className="text-sm font-medium">
                Select {bulkAccessType === 'course' ? 'Course' : 'Pathway'}
              </Label>
              <Select value={bulkAccessSelectedId} onValueChange={setBulkAccessSelectedId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={`Choose a ${bulkAccessType}...`} />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {bulkAccessType === 'course'
                    ? bulkAccessCourses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))
                    : bulkAccessPathways.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))
                  }
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBulkAccessDialogOpen(false)} disabled={bulkAccessLoading}>
                Cancel
              </Button>
              <Button
                onClick={handleBulkAccessConfirm}
                disabled={bulkAccessLoading || !bulkAccessSelectedId}
                variant={bulkAccessAction === 'revoke' ? 'destructive' : 'default'}
              >
                {bulkAccessLoading
                  ? (bulkAccessAction === 'grant' ? 'Granting...' : 'Revoking...')
                  : (bulkAccessAction === 'grant' ? 'Grant Access' : 'Revoke Access')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
}