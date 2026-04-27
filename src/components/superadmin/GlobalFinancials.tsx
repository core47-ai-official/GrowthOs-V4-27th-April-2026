import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, PieChart, BarChart3 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface FinancialStats {
  totalRevenue: number;
  monthlyRevenue: number;
  yearlyRevenue: number;
  pendingAmount: number;
  overdueAmount: number;
  collectionRate: number;
  revenueByMonth: { month: string; amount: number }[];
  revenueByCourse: { name: string; amount: number; count: number }[];
  revenueByPathway: { name: string; amount: number; count: number }[];
}

export const GlobalFinancials = () => {
  const [stats, setStats] = useState<FinancialStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('PKR');

  useEffect(() => {
    fetchFinancialStats();
  }, []);

  const fetchFinancialStats = async () => {
    try {
      // Get company currency
      const { data: companySettings } = await supabase
        .from('company_settings')
        .select('currency')
        .limit(1)
        .single();
      
      if (companySettings?.currency) {
        setCurrency(companySettings.currency);
      }

      // Fetch all invoices
      const { data: invoices, error: invoicesError } = await supabase
        .from('invoices')
        .select('id, amount, status, paid_at, due_date, course_id, pathway_id, created_at');

      if (invoicesError) throw invoicesError;

      // Fetch courses and pathways for names
      const [{ data: courses }, { data: pathways }] = await Promise.all([
        supabase.from('courses').select('id, title'),
        supabase.from('learning_pathways').select('id, name')
      ]);

      const courseMap = new Map((courses || []).map(c => [c.id, c.title]));
      const pathwayMap = new Map((pathways || []).map(p => [p.id, p.name]));

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfYear = new Date(now.getFullYear(), 0, 1);

      // Calculate stats
      const paidInvoices = (invoices || []).filter(i => i.status === 'paid');
      const unpaidInvoices = (invoices || []).filter(i => i.status !== 'paid');
      
      const totalRevenue = paidInvoices.reduce((sum, i) => sum + (i.amount || 0), 0);
      
      const monthlyRevenue = paidInvoices
        .filter(i => i.paid_at && new Date(i.paid_at) >= startOfMonth)
        .reduce((sum, i) => sum + (i.amount || 0), 0);
      
      const yearlyRevenue = paidInvoices
        .filter(i => i.paid_at && new Date(i.paid_at) >= startOfYear)
        .reduce((sum, i) => sum + (i.amount || 0), 0);

      const pendingAmount = unpaidInvoices
        .filter(i => new Date(i.due_date) >= now)
        .reduce((sum, i) => sum + (i.amount || 0), 0);

      const overdueAmount = unpaidInvoices
        .filter(i => new Date(i.due_date) < now)
        .reduce((sum, i) => sum + (i.amount || 0), 0);

      const totalExpected = totalRevenue + pendingAmount + overdueAmount;
      const collectionRate = totalExpected > 0 ? (totalRevenue / totalExpected) * 100 : 0;

      // Revenue by month (last 6 months)
      const revenueByMonth: { month: string; amount: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthRevenue = paidInvoices
          .filter(inv => {
            if (!inv.paid_at) return false;
            const paidDate = new Date(inv.paid_at);
            return paidDate >= monthDate && paidDate <= monthEnd;
          })
          .reduce((sum, inv) => sum + (inv.amount || 0), 0);
        
        revenueByMonth.push({
          month: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          amount: monthRevenue
        });
      }

      // Revenue by course
      const courseRevenue = new Map<string, { amount: number; count: number }>();
      paidInvoices.forEach(inv => {
        if (inv.course_id) {
          const current = courseRevenue.get(inv.course_id) || { amount: 0, count: 0 };
          courseRevenue.set(inv.course_id, {
            amount: current.amount + (inv.amount || 0),
            count: current.count + 1
          });
        }
      });

      const revenueByCourse = Array.from(courseRevenue.entries())
        .map(([id, data]) => ({
          name: courseMap.get(id) || 'Unknown Course',
          amount: data.amount,
          count: data.count
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      // Revenue by pathway
      const pathwayRevenue = new Map<string, { amount: number; count: number }>();
      paidInvoices.forEach(inv => {
        if (inv.pathway_id) {
          const current = pathwayRevenue.get(inv.pathway_id) || { amount: 0, count: 0 };
          pathwayRevenue.set(inv.pathway_id, {
            amount: current.amount + (inv.amount || 0),
            count: current.count + 1
          });
        }
      });

      const revenueByPathway = Array.from(pathwayRevenue.entries())
        .map(([id, data]) => ({
          name: pathwayMap.get(id) || 'Unknown Pathway',
          amount: data.amount,
          count: data.count
        }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);

      setStats({
        totalRevenue,
        monthlyRevenue,
        yearlyRevenue,
        pendingAmount,
        overdueAmount,
        collectionRate,
        revenueByMonth,
        revenueByCourse,
        revenueByPathway
      });

    } catch (error) {
      logger.error('Error fetching financial stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Global Financials
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(stats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">All time collected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats?.monthlyRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {formatCurrency(stats?.pendingAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(stats?.overdueAmount || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Past due date</p>
          </CardContent>
        </Card>
      </div>

      {/* Collection Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Collection Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-bold">
              {stats?.collectionRate.toFixed(1) || 0}%
            </div>
            <Badge className={stats?.collectionRate && stats.collectionRate >= 80 ? 'bg-green-500' : stats?.collectionRate && stats.collectionRate >= 60 ? 'bg-yellow-500' : 'bg-red-500'}>
              {stats?.collectionRate && stats.collectionRate >= 80 ? 'Excellent' : stats?.collectionRate && stats.collectionRate >= 60 ? 'Good' : 'Needs Improvement'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Percentage of expected revenue collected
          </p>
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue Trend (Last 6 Months)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {stats?.revenueByMonth.map((month, index) => {
              const maxAmount = Math.max(...(stats?.revenueByMonth.map(m => m.amount) || [1]));
              const height = maxAmount > 0 ? (month.amount / maxAmount) * 100 : 0;
              return (
                <div key={index} className="flex-1 flex flex-col items-center gap-2">
                  <div 
                    className="w-full bg-primary/20 rounded-t relative"
                    style={{ height: `${Math.max(height, 5)}%` }}
                  >
                    <div 
                      className="absolute inset-0 bg-primary rounded-t"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{month.month}</span>
                  <span className="text-xs font-medium">{formatCurrency(month.amount)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Revenue by Course/Pathway */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Courses by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenueByCourse.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.revenueByCourse.map((course, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium truncate max-w-[150px]">{course.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(course.amount)}</TableCell>
                      <TableCell className="text-right">{course.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No course revenue data yet</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Top Pathways by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.revenueByPathway.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pathway</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.revenueByPathway.map((pathway, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium truncate max-w-[150px]">{pathway.name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(pathway.amount)}</TableCell>
                      <TableCell className="text-right">{pathway.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No pathway revenue data yet</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Yearly Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Year to Date Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">YTD Revenue</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(stats?.yearlyRevenue || 0)}</p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Outstanding</p>
              <p className="text-2xl font-bold text-yellow-600">
                {formatCurrency((stats?.pendingAmount || 0) + (stats?.overdueAmount || 0))}
              </p>
            </div>
            <div className="text-center p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">Avg Monthly</p>
              <p className="text-2xl font-bold">
                {formatCurrency(Math.round((stats?.yearlyRevenue || 0) / (new Date().getMonth() + 1)))}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
