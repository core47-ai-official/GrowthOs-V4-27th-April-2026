import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, AlertTriangle, Download, Search, CalendarIcon, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/currencyFormatter';

interface Invoice {
  id: string;
  student_id: string | null;
  course_id: string | null;
  pathway_id: string | null;
  installment_number: number;
  amount: number;
  due_date: string;
  extended_due_date: string | null;
  status: string;
  payment_date: string | null;
  users: {
    email: string;
  };
  course_name?: string;
  pathway_name?: string;
}

export const FinancialManagement = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    totalRevenue: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    collectionRate: 0
  });
  const [extensionDate, setExtensionDate] = useState<Date | undefined>(undefined);
  const [extensionInvoiceId, setExtensionInvoiceId] = useState<string | null>(null);
  const [extensionPopoverOpen, setExtensionPopoverOpen] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (invoices.length > 0) {
      calculateStats();
    }
  }, [invoices]);

const fetchInvoices = async () => {
  setLoading(true);
  try {
    const { data: invData, error: invErr } = await supabase
      .from('invoices')
      .select('id, student_id, course_id, pathway_id, installment_number, amount, due_date, extended_due_date, status, paid_at');
    if (invErr) throw invErr;

    const invoicesRaw = invData || [];
    const studentIds = Array.from(new Set(invoicesRaw.map((i: any) => i.student_id).filter(Boolean)));
    const courseIds = Array.from(new Set(invoicesRaw.map((i: any) => i.course_id).filter(Boolean)));
    const pathwayIds = Array.from(new Set(invoicesRaw.map((i: any) => i.pathway_id).filter(Boolean)));

    let studentMap = new Map<string, string>(); // student_id -> user_id
    let emailMap = new Map<string, string>();   // user_id -> email
    let courseMap = new Map<string, string>();  // course_id -> title
    let pathwayMap = new Map<string, string>(); // pathway_id -> name

    // Fetch related data
    if (studentIds.length) {
      const [{ data: students, error: sErr }, { data: users, error: uErr }] = await Promise.all([
        supabase.from('students').select('id, user_id').in('id', studentIds),
        supabase.from('users').select('id, email')
      ]);
      if (sErr) throw sErr;
      if (uErr) throw uErr;
      (students || []).forEach((s: any) => studentMap.set(s.id, s.user_id));
      (users || []).forEach((u: any) => emailMap.set(u.id, u.email));
    }
    
    if (courseIds.length) {
      const { data: courses, error: cErr } = await supabase
        .from('courses')
        .select('id, title')
        .in('id', courseIds);
      if (cErr) throw cErr;
      (courses || []).forEach((c: any) => courseMap.set(c.id, c.title));
    }
    
    if (pathwayIds.length) {
      const { data: pathways, error: pErr } = await supabase
        .from('learning_pathways')
        .select('id, name')
        .in('id', pathwayIds);
      if (pErr) throw pErr;
      (pathways || []).forEach((p: any) => pathwayMap.set(p.id, p.name));
    }

    const mapped: Invoice[] = (invoicesRaw as any[]).map((row: any) => {
      const userId = row.student_id ? (studentMap.get(row.student_id) || '') : '';
      const email = userId ? (emailMap.get(userId) || '') : '';
      return {
        id: row.id,
        student_id: row.student_id || null,
        course_id: row.course_id || null,
        pathway_id: row.pathway_id || null,
        installment_number: row.installment_number,
        amount: Number(row.amount || 0),
        due_date: row.due_date,
        extended_due_date: row.extended_due_date || null,
        status: row.status,
        payment_date: row.paid_at,
        users: { email },
        course_name: row.course_id ? courseMap.get(row.course_id) : undefined,
        pathway_name: row.pathway_id ? pathwayMap.get(row.pathway_id) : undefined
      };
    });

    setInvoices(mapped);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    toast({ title: 'Error', description: 'Failed to fetch invoices', variant: 'destructive' });
  } finally {
    setLoading(false);
  }
};

const calculateStats = async () => {
  try {
    const now = new Date();
    const totalRevenue = invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const pendingAmount = invoices
      .filter(i => i.status !== 'paid')
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const overdueAmount = invoices
      .filter(i => {
        if (i.status === 'paid') return false;
        const effectiveDate = i.extended_due_date || i.due_date;
        return effectiveDate && new Date(effectiveDate) < now;
      })
      .reduce((sum, i) => sum + (i.amount || 0), 0);
    const collectionRate = invoices.length
      ? (totalRevenue / (totalRevenue + pendingAmount + overdueAmount)) * 100
      : 0;

    setStats({ totalRevenue, pendingAmount, overdueAmount, collectionRate });
  } catch (error) {
    console.error('Error calculating stats:', error);
  }
};

const updateInvoiceStatus = async (invoiceId: string, status: string) => {
  try {
    if (status === 'paid') {
      // Use the edge function to properly mark as paid, update fees_cleared, and activate user
      console.log('Calling mark-invoice-paid edge function for invoice:', invoiceId);
      
      const { data, error } = await supabase.functions.invoke('mark-invoice-paid', {
        body: { invoice_id: invoiceId }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw new Error(error.message || 'Failed to mark invoice as paid');
      }

      if (!data?.success) {
        console.error('Payment processing failed:', data?.error);
        throw new Error(data?.error || 'Failed to process payment');
      }

      console.log('Payment processed successfully:', data);
      toast({ title: 'Success', description: 'Invoice marked as paid and student account activated' });
    } else {
      // For other status updates, use direct update
      const updates: any = { status };
      if (status !== 'paid') {
        updates.paid_at = null;
      }

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);
      
      if (error) throw error;
      toast({ title: 'Success', description: 'Invoice status updated' });
    }

    await fetchInvoices();
  } catch (error: any) {
    console.error('Error updating invoice:', error);
    toast({ 
      title: 'Error', 
      description: error?.message || 'Failed to update invoice', 
      variant: 'destructive' 
    });
  }
};

const grantExtension = async (invoiceId: string, newDate: Date) => {
  try {
    const { error } = await supabase
      .from('invoices')
      .update({ 
        extended_due_date: newDate.toISOString(),
        // Reset status to pending if it was due/overdue
        status: 'pending'
      })
      .eq('id', invoiceId);
    
    if (error) throw error;

    // Get invoice details for notification
    const invoice = invoices.find(i => i.id === invoiceId);
    if (invoice?.student_id) {
      // Get user_id from student
      const { data: student } = await supabase
        .from('students')
        .select('user_id')
        .eq('id', invoice.student_id)
        .single();

      if (student?.user_id) {
        // Create notification for the student
        await supabase.rpc('create_notification', {
          p_user_id: student.user_id,
          p_type: 'fee_extension',
          p_title: 'Fee Extension Granted',
          p_message: `Your payment deadline for Installment #${invoice.installment_number} has been extended to ${format(newDate, 'PPP')}`,
          p_metadata: { 
            invoice_id: invoiceId, 
            new_due_date: newDate.toISOString(),
            installment_number: invoice.installment_number
          }
        });

        // Also reactivate LMS if it was suspended due to this overdue
        await supabase
          .from('users')
          .update({ lms_status: 'active' })
          .eq('id', student.user_id)
          .eq('lms_status', 'suspended');
      }
    }

    toast({ 
      title: 'Extension Granted', 
      description: `Due date extended to ${format(newDate, 'PPP')}` 
    });
    
    setExtensionPopoverOpen(null);
    setExtensionDate(undefined);
    await fetchInvoices();
  } catch (error: any) {
    console.error('Error granting extension:', error);
    toast({ 
      title: 'Error', 
      description: error?.message || 'Failed to grant extension', 
      variant: 'destructive' 
    });
  }
};

const clearExtension = async (invoiceId: string) => {
  try {
    const { error } = await supabase
      .from('invoices')
      .update({ extended_due_date: null })
      .eq('id', invoiceId);
    
    if (error) throw error;

    toast({ title: 'Extension Cleared', description: 'Due date reset to original' });
    await fetchInvoices();
  } catch (error: any) {
    console.error('Error clearing extension:', error);
    toast({ 
      title: 'Error', 
      description: error?.message || 'Failed to clear extension', 
      variant: 'destructive' 
    });
  }
};

const getStatusBadge = (status: string) => {
  const statusConfig: any = {
    paid: { color: 'bg-green-500', label: 'Paid' },
    pending: { color: 'bg-yellow-500', label: 'Pending' },
    issued: { color: 'bg-amber-500', label: 'Issued' },
    overdue: { color: 'bg-red-500', label: 'Overdue' },
    due: { color: 'bg-red-500', label: 'Due' },
    failed: { color: 'bg-gray-500', label: 'Failed' }
  };
  const config = statusConfig[status] || { color: 'bg-gray-500', label: status };
  return (
    <Badge className={config.color}>
      {config.label}
    </Badge>
  );
};

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.users?.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading financial data...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">From paid invoices</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.pendingAmount)}</div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdueAmount)}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.collectionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">Payment success rate</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Management */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Invoice Management</CardTitle>
            <Button variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student Email</TableHead>
                <TableHead>Course/Pathway</TableHead>
                <TableHead>Installment</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{invoice.users?.email}</TableCell>
                  <TableCell>
                    {invoice.course_name && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {invoice.course_name}
                      </Badge>
                    )}
                    {invoice.pathway_name && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                        {invoice.pathway_name}
                      </Badge>
                    )}
                    {!invoice.course_name && !invoice.pathway_name && (
                      <span className="text-muted-foreground text-sm">General</span>
                    )}
                  </TableCell>
                  <TableCell>Installment {invoice.installment_number}</TableCell>
                  <TableCell>{formatCurrency(invoice.amount)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <span className={invoice.extended_due_date ? 'line-through text-muted-foreground text-xs' : ''}>
                        {new Date(invoice.due_date).toLocaleDateString()}
                      </span>
                      {invoice.extended_due_date && (
                        <span className="flex items-center gap-1 text-amber-600 font-medium">
                          <Clock className="w-3 h-3" />
                          {new Date(invoice.extended_due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(invoice.status)}
                      {invoice.extended_due_date && (
                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                          Extended
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {invoice.payment_date ? new Date(invoice.payment_date).toLocaleDateString() : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Select
                        value={invoice.status}
                        onValueChange={(value) => updateInvoiceStatus(invoice.id, value)}
                      >
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="issued">Issued</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="due">Due</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                            <SelectItem value="failed">Failed</SelectItem>
                          </SelectContent>
                      </Select>
                      
                      {invoice.status !== 'paid' && (
                        <Popover 
                          open={extensionPopoverOpen === invoice.id} 
                          onOpenChange={(open) => {
                            setExtensionPopoverOpen(open ? invoice.id : null);
                            if (!open) setExtensionDate(undefined);
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="gap-1"
                            >
                              <CalendarIcon className="w-3 h-3" />
                              Extend
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <div className="p-3 border-b">
                              <p className="text-sm font-medium">Extend Due Date</p>
                              <p className="text-xs text-muted-foreground">
                                Current: {new Date(invoice.extended_due_date || invoice.due_date).toLocaleDateString()}
                              </p>
                            </div>
                            <Calendar
                              mode="single"
                              selected={extensionDate}
                              onSelect={setExtensionDate}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                            <div className="p-3 border-t flex gap-2">
                              <Button 
                                size="sm" 
                                className="flex-1"
                                disabled={!extensionDate}
                                onClick={() => extensionDate && grantExtension(invoice.id, extensionDate)}
                              >
                                Grant Extension
                              </Button>
                              {invoice.extended_due_date && (
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => clearExtension(invoice.id)}
                                >
                                  Clear
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};