import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RoleGuard } from "@/components/RoleGuard";
import { EnhancedStudentCreationDialog } from "@/components/EnhancedStudentCreationDialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCheck, Calendar as CalendarIcon, Filter, AlertTriangle, Plus } from "lucide-react";
import { format, subDays, startOfDay, endOfDay, startOfMonth, subMonths } from 'date-fns';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";
interface EnrollmentRecord {
  id: string;
  student_name: string;
  student_email: string;
  enrollment_date: string;
  lms_status: 'active' | 'inactive' | 'suspended';
  payment_status: 'current' | 'overdue' | 'pending';
  first_payment_status: 'due' | 'overdue' | 'cleared';
  onboarding_completed: boolean;
  created_by: string;
  enrollment_manager_name?: string;
}
interface DashboardStats {
  totalEnrollments: number;
  activeEnrollments: number;
  pendingEnrollments: number;
  suspendedEnrollments: number;
  monthlyGrowth: number;
  todayEnrollments: number;
  thisWeekEnrollments: number;
  pendingPayments: number;
  overduePayments: number;
  pendingOnboarding: number;
}
const EnrollmentManagerDashboard = () => {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [stats, setStats] = useState<DashboardStats>({
    totalEnrollments: 0,
    activeEnrollments: 0,
    pendingEnrollments: 0,
    suspendedEnrollments: 0,
    monthlyGrowth: 0,
    todayEnrollments: 0,
    thisWeekEnrollments: 0,
    pendingPayments: 0,
    overduePayments: 0,
    pendingOnboarding: 0
  });
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const defaultEnd = new Date();
  const defaultStart = subDays(defaultEnd, 30);
  const [dateRangeApplied, setDateRangeApplied] = useState<DateRange>({
    from: startOfDay(defaultStart),
    to: endOfDay(defaultEnd)
  });
  const [dateRangePending, setDateRangePending] = useState<DateRange | undefined>();
  const [showStudentDialog, setShowStudentDialog] = useState(false);
  const [timeTick, setTimeTick] = useState(0);

  // Fetch real data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const appliedTo = dateRangeApplied?.to ? endOfDay(dateRangeApplied.to) : new Date();
        const appliedFrom = dateRangeApplied?.from ? startOfDay(dateRangeApplied.from) : subDays(appliedTo, 30);
        const startDate = appliedFrom;
        const endDate = appliedTo;
        const today = startOfDay(new Date());
        const weekStart = subDays(today, 7);
        const lastMonth = startOfMonth(subMonths(new Date(), 1));
        const thisMonth = startOfMonth(new Date());

        // Fetch enrollment data with user details - only for current enrollment manager
        const {
          data: enrollmentsData,
          error: enrollmentsError
        } = await supabase.from('students').select(`
            id,
            user_id,
            enrollment_date,
            onboarding_completed,
            created_at,
            users!students_user_id_fkey (
              id,
              full_name,
              email,
              lms_status,
              created_by,
              role
            )
          `).gte('enrollment_date', startDate.toISOString()).lte('enrollment_date', endDate.toISOString()).order('enrollment_date', {
          ascending: false
        });
        if (enrollmentsError) throw enrollmentsError;

        // Filter by current enrollment manager's created students
        const myEnrollments = (enrollmentsData || []).filter(student => student.users?.created_by === user?.id);

        // Fetch payment status data for my students only
        const {
          data: invoicesData,
          error: invoicesError
        } = await supabase.from('invoices').select('student_id, status, due_date, installment_number, paid_at').in('student_id', myEnrollments?.map(s => s.id) || []);
        if (invoicesError) throw invoicesError;

        // Process enrollment records for my students only
        const processedEnrollments: EnrollmentRecord[] = myEnrollments.filter(student => student.users).map(student => {
          const user = student.users;
          const invoices = invoicesData?.filter(inv => inv.student_id === student.id) || [];
          const hasOverdue = invoices.some(inv => inv.status === 'pending' && new Date(inv.due_date) < new Date());
          const hasPending = invoices.some(inv => inv.status === 'pending');
          // Determine 1st payment/invoice status
          const firstInvoice = invoices.find(inv => inv.installment_number === 1);
          let first_payment_status: 'due' | 'overdue' | 'cleared' = 'due';
          if (firstInvoice) {
            if (firstInvoice.status === 'paid' || firstInvoice.paid_at) {
              first_payment_status = 'cleared';
            } else if (firstInvoice.status === 'pending' && new Date(firstInvoice.due_date) < new Date()) {
              first_payment_status = 'overdue';
            } else {
              first_payment_status = 'due';
            }
          }
          return {
            id: student.id,
            student_name: user.full_name,
            student_email: user.email,
            enrollment_date: student.enrollment_date,
            lms_status: user.lms_status as 'active' | 'inactive' | 'suspended' || 'inactive',
            payment_status: hasOverdue ? 'overdue' as const : hasPending ? 'pending' as const : 'current' as const,
            first_payment_status,
            onboarding_completed: student.onboarding_completed || false,
            created_by: user.created_by || '',
            enrollment_manager_name: user.created_by ? 'Current User' : 'Unknown'
          };
        });

        // Calculate comprehensive stats
        const totalEnrollments = processedEnrollments.length;
        const activeEnrollments = processedEnrollments.filter(e => e.lms_status === 'active').length;
        const pendingEnrollments = processedEnrollments.filter(e => e.lms_status === 'inactive').length;
        const suspendedEnrollments = processedEnrollments.filter(e => e.lms_status === 'suspended').length;
        const todayEnrollments = processedEnrollments.filter(e => new Date(e.enrollment_date) >= today).length;
        const thisWeekEnrollments = processedEnrollments.filter(e => new Date(e.enrollment_date) >= weekStart).length;
        const pendingPayments = processedEnrollments.filter(e => e.payment_status === 'pending').length;
        const overduePayments = processedEnrollments.filter(e => e.payment_status === 'overdue').length;
        const pendingOnboarding = processedEnrollments.filter(e => !e.onboarding_completed).length;

        // Calculate monthly growth for my enrollments only
        const {
          data: lastMonthData
        } = await supabase.from('students').select('id, users!students_user_id_fkey(created_by)').gte('enrollment_date', lastMonth.toISOString()).lt('enrollment_date', thisMonth.toISOString());
        const {
          data: thisMonthData
        } = await supabase.from('students').select('id, users!students_user_id_fkey(created_by)').gte('enrollment_date', thisMonth.toISOString());
        const lastMonthCount = (lastMonthData || []).filter(s => s.users?.created_by === user?.id).length;
        const thisMonthCount = (thisMonthData || []).filter(s => s.users?.created_by === user?.id).length;
        const monthlyGrowth = lastMonthCount > 0 ? (thisMonthCount - lastMonthCount) / lastMonthCount * 100 : 0;
        setStats({
          totalEnrollments,
          activeEnrollments,
          pendingEnrollments,
          suspendedEnrollments,
          monthlyGrowth,
          todayEnrollments,
          thisWeekEnrollments,
          pendingPayments,
          overduePayments,
          pendingOnboarding
        });
        setEnrollments(processedEnrollments);
      } catch (error: any) {
        console.error('Error fetching enrollment data:', error);
        toast({
          title: "Error",
          description: "Failed to load enrollment data. Please try again.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRangeApplied?.from, dateRangeApplied?.to, user?.id, toast]);

  // Set up real-time subscriptions for live updates
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase.channel('enrollment-updates').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'students'
    }, () => {
      // Refetch data when students table changes
      const fetchData = async () => {
        const appliedTo = dateRangeApplied?.to ? endOfDay(dateRangeApplied.to) : new Date();
        const appliedFrom = dateRangeApplied?.from ? startOfDay(dateRangeApplied.from) : subDays(appliedTo, 30);
        const startDate = appliedFrom;
        const endDate = appliedTo;
        const {
          data: enrollmentsData
        } = await supabase.from('students').select(`
                id,
                user_id,
                enrollment_date,
                onboarding_completed,
                users!students_user_id_fkey (
                  id,
                  full_name,
                  email,
                  lms_status,
                  created_by
                )
              `).gte('enrollment_date', startDate.toISOString()).lte('enrollment_date', endDate.toISOString()).order('enrollment_date', {
          ascending: false
        });
        if (enrollmentsData) {
          // Filter by current enrollment manager's created students
          const myEnrollments = enrollmentsData.filter(student => student.users?.created_by === user?.id);
          const processedEnrollments: EnrollmentRecord[] = myEnrollments.filter(student => student.users).map(student => ({
            id: student.id,
            student_name: student.users.full_name,
            student_email: student.users.email,
            enrollment_date: student.enrollment_date,
            lms_status: student.users.lms_status as 'active' | 'inactive' | 'suspended' || 'inactive',
            payment_status: 'current' as const,
            first_payment_status: 'due' as const,
            onboarding_completed: student.onboarding_completed || false,
            created_by: student.users.created_by || ''
          }));
          setEnrollments(processedEnrollments);
        }
      };
      fetchData();
    }).on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'users'
    }, () => {
      // Also listen for user status changes
      const fetchData = async () => {
        const appliedTo = dateRangeApplied?.to ? endOfDay(dateRangeApplied.to) : new Date();
        const appliedFrom = dateRangeApplied?.from ? startOfDay(dateRangeApplied.from) : subDays(appliedTo, 30);
        const startDate = appliedFrom;
        const endDate = appliedTo;
        const {
          data: enrollmentsData
        } = await supabase.from('students').select(`
                id,
                user_id,
                enrollment_date,
                onboarding_completed,
                users!students_user_id_fkey (
                  id,
                  full_name,
                  email,
                  lms_status,
                  created_by
                )
              `).gte('enrollment_date', startDate.toISOString()).lte('enrollment_date', endDate.toISOString()).order('enrollment_date', {
          ascending: false
        });
        if (enrollmentsData) {
          // Filter by current enrollment manager's created students
          const myEnrollments = enrollmentsData.filter(student => student.users?.created_by === user?.id);
          const processedEnrollments: EnrollmentRecord[] = myEnrollments.filter(student => student.users).map(student => ({
            id: student.id,
            student_name: student.users.full_name,
            student_email: student.users.email,
            enrollment_date: student.enrollment_date,
            lms_status: student.users.lms_status as 'active' | 'inactive' | 'suspended' || 'inactive',
            payment_status: 'current' as const,
            first_payment_status: 'due' as const,
            onboarding_completed: student.onboarding_completed || false,
            created_by: student.users.created_by || ''
          }));
          setEnrollments(processedEnrollments);
        }
      };
      fetchData();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [dateRangeApplied?.from, dateRangeApplied?.to, user?.id]);
  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default';
      case 'inactive':
        return 'secondary';
      case 'suspended':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  const getPaymentBadgeVariant = (status: string) => {
    switch (status) {
      case 'current':
      case 'cleared':
        return 'default';
      case 'pending':
      case 'due':
        return 'secondary';
      case 'overdue':
        return 'destructive';
      default:
        return 'outline';
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>;
  }
  return <RoleGuard allowedRoles="enrollment_manager">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Enrollment Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage student enrollments and track performance</p>
          </div>
          
          <Button onClick={() => setShowStudentDialog(true)} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Student
          </Button>
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium">Date range:</span>
          </div>
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !dateRangeApplied && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRangeApplied?.from ? dateRangeApplied.to ? `${format(dateRangeApplied.from, 'MMM dd, yyyy')} - ${format(dateRangeApplied.to, 'MMM dd, yyyy')}` : `${format(dateRangeApplied.from, 'MMM dd, yyyy')}` : <span>Pick a date range</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="p-3 pointer-events-auto">
                <Calendar mode="range" numberOfMonths={2} selected={dateRangePending || dateRangeApplied} onSelect={setDateRangePending} initialFocus className={cn("p-3 pointer-events-auto")} />
                <div className="flex items-center justify-end gap-2 border-t p-2">
                  <Button variant="ghost" onClick={() => setDateRangePending(undefined)}>Clear</Button>
                  <Button onClick={() => {
                  setDateRangeApplied(dateRangePending || dateRangeApplied);
                  setCalendarOpen(false);
                }}>Confirm</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Live Metrics - Quick Stats */}
        

        {/* Main KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-blue-700">Total Enrollments</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-900">{stats.totalEnrollments}</div>
              <p className="text-xs text-blue-700/80">
                In selected period
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-green-700">Active Students</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-900">{stats.activeEnrollments}</div>
              <p className="text-xs text-green-700/80">
                Currently active in LMS
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-orange-700">Inactive Students</CardTitle>
              <CalendarIcon className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-900">{stats.pendingEnrollments}</div>
              <p className="text-xs text-orange-700/80">
                Awaiting activation
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700">Suspended</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-900">{stats.suspendedEnrollments}</div>
              <p className="text-xs text-red-700/80">
                LMS access suspended
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Enrollments Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              My Enrollments
              <Badge variant="secondary" className="text-xs">
                Live Updates
              </Badge>
            </CardTitle>
            <CardDescription>
              Students I enrolled in the selected period (updates automatically)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Enrollment Date</TableHead>
                  <TableHead>LMS Status</TableHead>
                  <TableHead>1st Payment Status</TableHead>
                  <TableHead>Onboarding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.length === 0 ? <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      No enrollments found for the selected period
                    </TableCell>
                  </TableRow> : enrollments.map(enrollment => <TableRow key={enrollment.id}>
                      <TableCell className="font-medium">{enrollment.student_name}</TableCell>
                      <TableCell>{enrollment.student_email}</TableCell>
                      <TableCell>{format(new Date(enrollment.enrollment_date), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <Badge
                          variant={getStatusBadgeVariant(enrollment.lms_status)}
                          className={cn(
                            enrollment.lms_status === 'active' && 'bg-green-600 text-white hover:bg-green-600',
                            enrollment.lms_status === 'inactive' && 'bg-yellow-500 text-black hover:bg-yellow-500',
                            enrollment.lms_status === 'suspended' && 'bg-red-600 text-white hover:bg-red-600'
                          )}
                        >
                          {enrollment.lms_status.charAt(0).toUpperCase() + enrollment.lms_status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                      <Badge
                        variant={getPaymentBadgeVariant(enrollment.first_payment_status)}
                        className={cn(
                          enrollment.first_payment_status === 'cleared' && 'bg-green-600 text-white hover:bg-green-600',
                          enrollment.first_payment_status === 'due' && 'bg-yellow-500 text-black hover:bg-yellow-500',
                          enrollment.first_payment_status === 'overdue' && 'bg-red-600 text-white hover:bg-red-600'
                        )}
                      >
                        {enrollment.first_payment_status.charAt(0).toUpperCase() + enrollment.first_payment_status.slice(1)}
                      </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={enrollment.onboarding_completed ? 'default' : 'secondary'}
                          className={cn(
                            enrollment.onboarding_completed ? 'bg-green-600 text-white hover:bg-green-600' : 'bg-yellow-500 text-black hover:bg-yellow-500'
                          )}
                        >
                          {enrollment.onboarding_completed ? 'Complete' : 'Pending'}
                        </Badge>
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Student Creation Dialog */}
        <EnhancedStudentCreationDialog open={showStudentDialog} onOpenChange={setShowStudentDialog} onStudentCreated={() => {
        // Refetch data after student creation
        const fetchData = async () => {
          const appliedTo = dateRangeApplied?.to ? endOfDay(dateRangeApplied.to) : new Date();
          const appliedFrom = dateRangeApplied?.from ? startOfDay(dateRangeApplied.from) : subDays(appliedTo, 30);
          const startDate = appliedFrom;
          const endDate = appliedTo;
          const {
            data: enrollmentsData
          } = await supabase.from('students').select(`
                  id,
                  user_id,
                  enrollment_date,
                  onboarding_completed,
                  users!students_user_id_fkey (
                    id,
                    full_name,
                    email,
                    lms_status,
                    created_by
                  )
                `).gte('enrollment_date', startDate.toISOString()).lte('enrollment_date', endDate.toISOString()).order('enrollment_date', {
            ascending: false
          });
          if (enrollmentsData) {
            const myEnrollments = enrollmentsData.filter(student => student.users?.created_by === user?.id);
            const processedEnrollments: EnrollmentRecord[] = myEnrollments.filter(student => student.users).map(student => ({
              id: student.id,
              student_name: student.users.full_name,
              student_email: student.users.email,
              enrollment_date: student.enrollment_date,
              lms_status: student.users.lms_status as 'active' | 'inactive' | 'suspended' || 'inactive',
              payment_status: 'current' as const,
              first_payment_status: 'due' as const,
              onboarding_completed: student.onboarding_completed || false,
              created_by: student.users.created_by || ''
            }));
            setEnrollments(processedEnrollments);
          }
        };
        fetchData();
      }} />
      </div>
    </RoleGuard>;
};
export default EnrollmentManagerDashboard;