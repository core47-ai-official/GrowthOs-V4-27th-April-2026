import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from 'date-fns';
import { CalendarIcon, Search, DollarSign, Users, TrendingUp, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface PaymentRecord {
  id: string;
  studentId: string;
  studentName: string;
  email: string;
  courseName: string;
  pathwayName: string | null;
  paymentDate: string;
  amount: number;
  installmentNumber: number;
  status: string;
}

interface PaymentStats {
  totalPayments: number;
  totalAmount: number;
  newEnrollments: number;
  avgPaymentAmount: number;
}

export const PaymentReports = () => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  // Temporary date range for the picker (only applied on Apply button click)
  const [tempDateRange, setTempDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [currency, setCurrency] = useState('PKR');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const { toast } = useToast();

  useEffect(() => {
    fetchCurrency();
    fetchCourses();
    fetchPayments();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, courseFilter]);

  const fetchCurrency = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('currency')
      .single();
    if (data?.currency) setCurrency(data.currency);
  };

  const fetchCourses = async () => {
    const { data } = await supabase
      .from('courses')
      .select('id, title')
      .eq('is_active', true);
    if (data) setCourses(data);
  };

  const fetchPayments = async (useRange?: { from: Date; to: Date }) => {
    const range = useRange || dateRange;
    try {
      setTableLoading(true);

      // Fetch paid invoices with student and course info
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          amount,
          paid_at,
          installment_number,
          status,
          student_id,
          course_id,
          pathway_id,
          students!inner(
            id,
            student_id,
            user_id,
            users!inner(
              full_name,
              email
            )
          ),
          courses(title),
          learning_pathways(name)
        `)
        .eq('status', 'paid')
        .not('paid_at', 'is', null)
        .gte('paid_at', range.from.toISOString())
        .lte('paid_at', range.to.toISOString())
        .order('paid_at', { ascending: false });

      if (error) throw error;

      const processedPayments: PaymentRecord[] = (invoices || []).map((invoice: any) => ({
        id: invoice.id,
        studentId: invoice.students?.student_id || 'N/A',
        studentName: invoice.students?.users?.full_name || 'Unknown',
        email: invoice.students?.users?.email || '',
        courseName: invoice.courses?.title || 'N/A',
        pathwayName: invoice.learning_pathways?.name || null,
        paymentDate: invoice.paid_at,
        amount: invoice.amount || 0,
        installmentNumber: invoice.installment_number || 1,
        status: invoice.status
      }));

      setPayments(processedPayments);
    } catch (error) {
      console.error('Error fetching payments:', error);
      toast({
        title: "Error",
        description: "Failed to load payment data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setTableLoading(false);
    }
  };

  // Apply date range and fetch data
  const handleApplyDateRange = () => {
    if (tempDateRange.from && tempDateRange.to) {
      setDateRange({ from: tempDateRange.from, to: tempDateRange.to });
      fetchPayments({ from: tempDateRange.from, to: tempDateRange.to });
      setIsCalendarOpen(false);
      setCurrentPage(1);
    }
  };

  // Filter payments
  const filteredPayments = useMemo(() => {
    return payments.filter(payment => {
      const matchesSearch = 
        payment.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.studentId.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesCourse = courseFilter === 'all' || 
        courses.find(c => c.id === courseFilter)?.title === payment.courseName;

      return matchesSearch && matchesCourse;
    });
  }, [payments, searchTerm, courseFilter, courses]);

  // Calculate stats
  const stats: PaymentStats = useMemo(() => {
    const totalAmount = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const newEnrollments = filteredPayments.filter(p => p.installmentNumber === 1).length;
    
    return {
      totalPayments: filteredPayments.length,
      totalAmount,
      newEnrollments,
      avgPaymentAmount: filteredPayments.length > 0 ? totalAmount / filteredPayments.length : 0
    };
  }, [filteredPayments]);

  // Pagination
  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = filteredPayments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const handleExport = () => {
    const csvContent = [
      ['Student ID', 'Name', 'Email', 'Course/Pathway', 'Payment Date', 'Amount', 'Installment #'].join(','),
      ...filteredPayments.map(p => [
        p.studentId,
        `"${p.studentName}"`,
        p.email,
        `"${p.pathwayName || p.courseName}"`,
        format(new Date(p.paymentDate), 'yyyy-MM-dd'),
        p.amount,
        p.installmentNumber
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-report-${format(dateRange.from, 'yyyy-MM-dd')}-to-${format(dateRange.to, 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const setQuickDateRange = (range: 'thisMonth' | 'lastMonth' | 'last3Months') => {
    const now = new Date();
    let newRange: { from: Date; to: Date };
    switch (range) {
      case 'thisMonth':
        newRange = { from: startOfMonth(now), to: endOfMonth(now) };
        break;
      case 'lastMonth':
        newRange = { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
        break;
      case 'last3Months':
        newRange = { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
        break;
    }
    setTempDateRange(newRange);
    setDateRange(newRange);
    fetchPayments(newRange);
    setIsCalendarOpen(false);
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Payment Reports</h2>
          <p className="text-muted-foreground">Track all student fee payments</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Received
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{formatCurrency(stats.totalAmount)}</div>
            <p className="text-xs text-muted-foreground">{stats.totalPayments} payments</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              New Enrollments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.newEnrollments}</div>
            <p className="text-xs text-muted-foreground">First-time payments</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Avg. Payment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{formatCurrency(stats.avgPaymentAmount)}</div>
            <p className="text-xs text-muted-foreground">Per transaction</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" />
              Date Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-orange-600">
              {format(dateRange.from, 'MMM d')} - {format(dateRange.to, 'MMM d, yyyy')}
            </div>
            <p className="text-xs text-muted-foreground">Selected period</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search by name, email, or student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Date Range Picker */}
            <Popover open={isCalendarOpen} onOpenChange={(open) => {
              setIsCalendarOpen(open);
              if (open) {
                // Reset temp to current when opening
                setTempDateRange({ from: dateRange.from, to: dateRange.to });
              }
            }}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full lg:w-[280px] justify-start text-left font-normal">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <div className="p-3 border-b flex flex-wrap gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setQuickDateRange('thisMonth')}>
                    This Month
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuickDateRange('lastMonth')}>
                    Last Month
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setQuickDateRange('last3Months')}>
                    Last 3 Months
                  </Button>
                </div>
                <Calendar
                  mode="range"
                  selected={{ from: tempDateRange.from, to: tempDateRange.to }}
                  onSelect={(range) => {
                    setTempDateRange({ from: range?.from, to: range?.to });
                  }}
                  numberOfMonths={2}
                  className="pointer-events-auto"
                />
                <div className="p-3 border-t flex justify-end gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    onClick={() => setIsCalendarOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleApplyDateRange}
                    disabled={!tempDateRange.from || !tempDateRange.to}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Course Filter */}
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-full lg:w-[200px]">
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map(course => (
                  <SelectItem key={course.id} value={course.id}>{course.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payment Table */}
      <Card className="relative">
        <CardHeader>
          <CardTitle className="text-lg">Payment Records</CardTitle>
          <p className="text-sm text-muted-foreground">
            Showing {paginatedPayments.length} of {filteredPayments.length} payments
          </p>
        </CardHeader>
        <CardContent className={cn("p-0 overflow-x-auto", tableLoading && "opacity-50 pointer-events-none")}>
          {tableLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <Table className="min-w-[800px]">
            <TableHeader>
              <TableRow>
                <TableHead>Student ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Course/Pathway</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Installment</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No payments found for the selected criteria
                  </TableCell>
                </TableRow>
              ) : (
                paginatedPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="font-mono text-sm">{payment.studentId}</TableCell>
                    <TableCell className="font-medium">{payment.studentName}</TableCell>
                    <TableCell className="text-muted-foreground">{payment.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{payment.courseName}</span>
                        {payment.pathwayName && (
                          <span className="text-xs text-muted-foreground">{payment.pathwayName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(payment.paymentDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <Badge variant="outline">#{payment.installmentNumber}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-emerald-600">
                      {formatCurrency(payment.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PaymentReports;
