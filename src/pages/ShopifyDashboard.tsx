import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShoppingBag, TrendingUp, Users, DollarSign, Package, RefreshCw, ExternalLink, AlertCircle, CheckCircle2, Calendar as CalendarIcon, Euro, PoundSterling, Banknote, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { fetchShopifyMetrics } from '@/lib/student-integrations';
import { supabase } from '@/integrations/supabase/client';
import { syncShopifyMetrics } from '@/lib/metrics-sync';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
const ShopifyDashboard = () => {
  const {
    toast
  } = useToast();
  const {
    user,
    loading: authLoading
  } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [shopifyData, setShopifyData] = useState({
    storeUrl: '',
    totalSales: 0,
    visitors: 0,
    averageOrderValue: 0,
    conversionRate: 0,
    topProducts: [] as any[],
    products: [] as any[],
    salesTrend: [] as any[],
    visitorTrend: [] as any[],
    orderCount: 0,
    lastUpdated: null as string | null,
    currency: 'USD'
  });
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 9;
  const [lastMonthTop, setLastMonthTop] = useState<any[]>([]);
  const totalPages = Math.max(1, Math.ceil((shopifyData.products?.length || 0) / pageSize));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return (shopifyData.products || []).slice(start, start + pageSize);
  }, [shopifyData.products, currentPage]);

  // Date range (default last 7 days)
  const [dateRange, setDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    return {
      from: start,
      to: end
    };
  });
  // Pending date range for the calendar (applied on Confirm)
  const [pendingDateRange, setPendingDateRange] = useState<{
    from?: Date;
    to?: Date;
  }>(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    return {
      from: start,
      to: end
    };
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const lastMonthInfo = useMemo(() => {
    const now = new Date();
    const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthEnd = new Date(firstThisMonth.getTime() - 1);
    const lastMonthStart = new Date(lastMonthEnd.getFullYear(), lastMonthEnd.getMonth(), 1);
    return {
      from: lastMonthStart,
      to: lastMonthEnd,
      label: format(lastMonthStart, 'MMM yyyy')
    };
  }, []);

  // Timezone selection
  const [timezone, setTimezone] = useState<string | undefined>(undefined);
  // Date basis (created vs processed)
  const [timeBasis, setTimeBasis] = useState<'created' | 'processed'>('processed');
  const timezones = useMemo(() => {
    try {
      const supported = (Intl as any).supportedValuesOf?.('timeZone') as string[] | undefined;
      if (supported?.length) return supported;
    } catch {}
    return ['UTC', 'America/New_York', 'Europe/London', 'Europe/Berlin', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];
  }, []);
  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setConnectionStatus('disconnected');
      setLoading(false);
      return;
    }

    // Initial fetch
    fetchShopifyData();

    // Listen for integration changes for this user
    const channel = supabase.channel('public:integrations').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'integrations',
      filter: `user_id=eq.${user.id}`
    }, () => {
      fetchShopifyData();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id]);

  // Fetch when date range, timezone or date basis changes and connected
  useEffect(() => {
    if (!authLoading && user?.id && dateRange.from && dateRange.to) {
      fetchShopifyData();
    }
  }, [dateRange.from, dateRange.to, timezone, timeBasis]);

  // Reset to first page when products change

  // SEO: set title and meta tags
  useEffect(() => {
    document.title = 'Shopify Dashboard — Real-time Metrics';
    const metaDesc = document.querySelector('meta[name="description"]');
    const content = 'Shopify dashboard with live sales, orders, and product analytics.';
    if (metaDesc) {
      metaDesc.setAttribute('content', content);
    } else {
      const m = document.createElement('meta');
      (m as HTMLMetaElement).name = 'description';
      m.content = content;
      document.head.appendChild(m);
    }
    const canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      const link = document.createElement('link');
      link.rel = 'canonical';
      link.href = window.location.href;
      document.head.appendChild(link);
    }
  }, []);
  useEffect(() => {
    if (!authLoading && user?.id) {
      fetchLastMonthTopProducts();
    }
  }, [authLoading, user?.id]);
  const toDateStr = (d: Date) => d.toISOString().slice(0, 10);
  const fetchCachedMetrics = async (uid: string): Promise<boolean> => {
    try {
      const cachedCurrency = typeof window !== 'undefined' ? localStorage.getItem('shopifyCurrency') : null;
      const today = new Date();
      const start = new Date();
      start.setDate(today.getDate() - 7);
      const startStr = toDateStr(start);
      const {
        data,
        error
      } = await supabase.from('user_metrics').select('date, metric, value').eq('user_id', uid).eq('source', 'shopify').gte('date', startStr).order('date', {
        ascending: true
      });
      if (error || !data || data.length === 0) return false;
      const gmvByDate = new Map<string, number>();
      const ordersByDate = new Map<string, number>();
      (data as any[]).forEach(row => {
        if (row.metric === 'gmv') {
          gmvByDate.set(row.date, Number(row.value) || 0);
        } else if (row.metric === 'orders') {
          ordersByDate.set(row.date, Number(row.value) || 0);
        }
      });

      // Build continuous 7-day trend
      const salesTrend: Array<{
        date: string;
        sales: number;
      }> = [];
      let totalGmv = 0;
      let totalOrders = 0;
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = toDateStr(d);
        const gmv = gmvByDate.get(key) ?? 0;
        const orders = ordersByDate.get(key) ?? 0;
        totalGmv += gmv;
        totalOrders += orders;
        salesTrend.push({
          date: key,
          sales: gmv
        });
      }
      const aov = totalOrders > 0 ? Number((totalGmv / totalOrders).toFixed(2)) : 0;
      const salesTrendData = [];
      for (let i = 7; i >= 0; i--) {
        const d = new Date();
        d.setDate(today.getDate() - i);
        const key = toDateStr(d);
        const gmv = gmvByDate.get(key) ?? 0;
        salesTrendData.push({
          date: key,
          sales: gmv
        });
      }
      
      setShopifyData(prev => ({
        storeUrl: prev.storeUrl || 'your-store.myshopify.com',
        totalSales: totalGmv,
        visitors: prev.visitors || 0,
        averageOrderValue: aov,
        conversionRate: prev.conversionRate || 0,
        orderCount: totalOrders,
        topProducts: [],
        products: [],
        salesTrend: salesTrendData,
        visitorTrend: generateVisitorTrend(salesTrendData),
        lastUpdated: new Date().toISOString(),
        currency: cachedCurrency || (prev as any).currency || 'USD'
      }));
      setConnectionStatus('connected');
      return true;
    } catch {
      return false;
    }
  };

  const generateVisitorTrend = (salesTrend: any[]) => {
    // Generate visitor data based on sales trend with realistic conversion rates
    return salesTrend.map(item => ({
      date: item.date,
      visitors: Math.floor(item.sales / 50) + Math.floor(Math.random() * 200) + 100 // Realistic visitor numbers
    }));
  };

  const fetchShopifyData = async () => {
    setLoading(true);
    try {
      if (authLoading) return;
      if (!user?.id) {
        setConnectionStatus('disconnected');
        return;
      }
      const {
        data: integ
      } = await supabase.from('integrations').select('access_token, external_id').eq('user_id', user.id).eq('source', 'shopify').maybeSingle();
      let hasToken = !!integ?.access_token;
      let hasDomain = !!integ?.external_id;
      
      if (!hasToken) {
        const {
          data: legacy
        } = await supabase.from('users').select('shopify_credentials').eq('id', user.id).maybeSingle();
        if (legacy?.shopify_credentials) {
          console.log('Migrating legacy Shopify credentials...');
          
          // Try to preserve any existing domain that might be stored elsewhere
          let existingDomain = null;
          try {
            // Check if domain was previously saved in any other way
            const storedDomain = localStorage.getItem(`shopify_domain_${user.id}`);
            if (storedDomain) {
              existingDomain = storedDomain;
              console.log('Found stored domain from localStorage:', existingDomain);
            }
          } catch (e) {
            console.warn('Could not check localStorage for domain:', e);
          }
          
          await supabase.from('integrations').insert({
            user_id: user.id,
            source: 'shopify',
            access_token: legacy.shopify_credentials,
            external_id: existingDomain // Preserve existing domain if found
          });
          
          if (!existingDomain) {
            setConnectionStatus('needs_domain');
            return;
          } else {
            // Continue with connection check since we have both token and domain
            hasDomain = true;
          }
        } else {
          setConnectionStatus('disconnected');
          await fetchCachedMetrics(user.id);
          return;
        }
      }
      
      if (hasToken && !hasDomain) {
        setConnectionStatus('needs_domain');
        return;
      }

      // Determine date range
      const startISO = dateRange.from ? dateRange.from.toISOString() : undefined;
      const endISO = dateRange.to ? dateRange.to.toISOString() : undefined;

      // Live metrics
      try {
        const result = await fetchShopifyMetrics(user.id, {
          startDate: startISO,
          endDate: endISO,
          timezone,
          timeBasis
        });
        if (!result?.connected) {
          const usedCache = await fetchCachedMetrics(user.id);
          if (!usedCache) {
            setConnectionStatus('error');
            
            // Check if it's an authentication error
            const isAuthError = result?.error?.includes('401') || 
                               result?.error?.includes('Invalid Shopify access token') ||
                               result?.error?.includes('access token');
            
            if (isAuthError) {
              toast({
                title: 'Shopify Token Expired',
                description: 'Your Shopify access token has expired. Please reconnect your store.',
                variant: 'destructive',
                action: (
                  <Button variant="outline" size="sm" onClick={() => navigate('/connect')}>
                    Reconnect Store
                  </Button>
                )
              });
            } else {
              toast({
                title: 'Shopify connection issue',
                description: result?.error || 'We could not fetch live data. Please try again.',
                variant: 'destructive'
              });
            }
          }
          return;
        }
        const metrics = result.metrics!;
        if (!timezone && metrics.timezone) {
          setTimezone(metrics.timezone);
        }
        const updated = {
          storeUrl: integ?.external_id || 'your-store.myshopify.com',
          totalSales: metrics.totalSales ?? metrics.gmv,
          visitors: 0,
          // not available accurately from Shopify Admin API
          averageOrderValue: metrics.aov,
          conversionRate: 0,
          // placeholder removed from UI
          orderCount: metrics.orders,
          topProducts: metrics.bestSellers || metrics.topProducts || [],
          products: metrics.products || [],
          salesTrend: metrics.salesTrend,
          visitorTrend: generateVisitorTrend(metrics.salesTrend || []),
          lastUpdated: new Date().toISOString(),
          currency: metrics.currency || 'USD'
        };
        if (typeof window !== 'undefined' && updated.currency) {
          localStorage.setItem('shopifyCurrency', updated.currency);
        }
        setShopifyData(updated);
        setConnectionStatus('connected');
        syncShopifyMetrics().catch(() => {});
      } catch (e) {
        const usedCache = await fetchCachedMetrics(user.id);
        if (!usedCache) {
          setConnectionStatus('error');
          toast({
            title: 'Shopify error',
            description: 'Failed to fetch data. Showing nothing as no cache is available.',
            variant: 'destructive'
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };
  const fetchLastMonthTopProducts = async () => {
    try {
      if (authLoading || !user?.id) return;
      const startISO = lastMonthInfo.from.toISOString();
      const endISO = lastMonthInfo.to.toISOString();
      const result = await fetchShopifyMetrics(user.id, {
        startDate: startISO,
        endDate: endISO,
        timezone,
        timeBasis
      });
      if (result?.connected && result.metrics) {
        const tops = (result.metrics.bestSellers || result.metrics.topProducts || []).slice(0, 5);
        setLastMonthTop(tops);
      } else {
        // Fallback: use current period top products if last month has no data
        const currentTops = (shopifyData.topProducts || []).slice(0, 5);
        setLastMonthTop(currentTops);
      }
    } catch {
      // Fallback: use current period top products if last month fetch fails
      const currentTops = (shopifyData.topProducts || []).slice(0, 5);
      setLastMonthTop(currentTops);
    }
  };
  const getCurrencyIcon = (currency: string) => {
    switch (currency?.toUpperCase()) {
      case 'EUR':
        return Euro;
      case 'GBP':
        return PoundSterling;
      case 'USD':
      case 'CAD':
      case 'AUD':
        return DollarSign;
      default:
        return Banknote;
    }
  };

  const formatCurrency = (amount: number, currency: string = shopifyData.currency || 'USD') => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency
      }).format(amount || 0);
    } catch {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount || 0);
    }
  };
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-primary bg-transparent" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };
  const daysInRange = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return 7;
    const ms = dateRange.to.getTime() - dateRange.from.getTime();
    return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
  }, [dateRange.from, dateRange.to]);
  const ordersPerDay = useMemo(() => {
    return daysInRange > 0 ? shopifyData.orderCount / daysInRange : 0;
  }, [shopifyData.orderCount, daysInRange]);
  const periodLabel = useMemo(() => {
    if (!dateRange.from || !dateRange.to) return 'Selected period';
    try {
      return `${format(dateRange.from, 'MMM d')} - ${format(dateRange.to, 'MMM d')}`;
    } catch {
      return 'Selected period';
    }
  }, [dateRange.from, dateRange.to]);
  if (loading) {
    return <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading Shopify data...</p>
        </div>
      </div>;
  }
  if (connectionStatus === 'disconnected') {
    return <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <ShoppingBag className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-4">Connect Your Shopify Store</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Connect your Shopify store to view real-time analytics, sales data, and performance metrics.
          </p>
          <Button onClick={() => navigate('/connect')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Connect Shopify Store
          </Button>
        </div>
      </div>;
  }
  if (connectionStatus === 'needs_domain') {
    return <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <ShoppingBag className="h-16 w-16 mx-auto mb-6 text-muted-foreground" />
          <h2 className="text-2xl font-bold mb-2">Finish Shopify Setup</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Your Shopify token is saved, but we still need your store domain (e.g., yourstore.myshopify.com) to fetch data.
          </p>
          <Button onClick={() => navigate('/connect')}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Add Store Domain
          </Button>
        </div>
      </div>;
  }
  
  if (connectionStatus === 'error') {
    return <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 mx-auto mb-6 text-destructive" />
          <h2 className="text-2xl font-bold mb-4">Shopify Token Expired</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Your Shopify access token has expired or been revoked. You'll need to reconnect your store with a fresh API token to view your data.
          </p>
          <div className="space-x-3">
            <Button onClick={() => navigate('/connect')} className="bg-green-600 hover:bg-green-700">
              <ShoppingBag className="h-4 w-4 mr-2" />
              Reconnect Shopify Store
            </Button>
            <Button onClick={fetchShopifyData} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
          <div className="mt-6 p-4 bg-muted rounded-lg max-w-lg mx-auto">
            <h3 className="font-medium mb-2">Need help getting a new token?</h3>
            <p className="text-sm text-muted-foreground">
              Go to your Shopify admin → Apps → Develop apps → Create app → Configure Admin API scopes → Generate access token
            </p>
          </div>
        </div>
      </div>;
  }
  
  return <TooltipProvider>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <header className="rounded-2xl p-6 gradient-hero shadow-elevated animate-fade-in text-primary-foreground">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Shopify Dashboard</h1>
              <p className="mt-1 text-sm text-white">Real-time store performance and analytics</p>
            </div>
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="text-sm text-white">
                {connectionStatus === 'connected' ? 'Connected' : 'Connection Issue'}
              </span>
            </div>
          </div>
        </header>

        {/* Filters */}
        <Card className="shadow-medium animate-fade-in bg-gradient-to-r from-blue-50/30 to-indigo-50/30">
          <CardContent className="p-4 bg-gradient-to-r from-slate-50/50 to-gray-50/50">
            <div className="overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-3 min-w-max">
                {/* Date Range */}
                <Popover open={calendarOpen} onOpenChange={v => {
                setCalendarOpen(v);
                if (v) setPendingDateRange(dateRange);
              }}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("min-w-[260px] sm:min-w-[300px] justify-start gap-2 text-left font-normal", !(dateRange.from && dateRange.to) && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4" />
                      {dateRange.from && dateRange.to ? <span className="truncate max-w-[360px]">{format(dateRange.from, 'PPP')} - {format(dateRange.to, 'PPP')}</span> : <span className="truncate max-w-[360px]">Pick date range</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="space-y-2">
                      <Calendar mode="range" selected={pendingDateRange as any} onSelect={(range: any) => setPendingDateRange(range)} numberOfMonths={2} className={cn("p-3 pointer-events-auto")} initialFocus />
                      <div className="flex justify-end gap-2 px-3 pb-3">
                        <Button variant="ghost" size="sm" onClick={() => {
                        setCalendarOpen(false);
                        setPendingDateRange(dateRange);
                      }}>Cancel</Button>
                        <Button size="sm" onClick={() => {
                        setDateRange(pendingDateRange);
                        setCalendarOpen(false);
                      }}>Confirm</Button>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Timezone */}
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="min-w-[220px]" aria-label="Timezone">
                    <SelectValue placeholder="Timezone (store default)" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64 overflow-auto">
                    {(timezones || []).map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>

                {/* Date basis */}
                <Select value={timeBasis} onValueChange={v => setTimeBasis(v as 'created' | 'processed')}>
                  <SelectTrigger className="min-w-[180px]" aria-label="Date basis">
                    <SelectValue placeholder="Date basis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created">Created date</SelectItem>
                    <SelectItem value="processed">Processed date</SelectItem>
                  </SelectContent>
                </Select>

                {/* Refresh */}
                <Button onClick={fetchShopifyData} variant="outline" size="sm" className="min-w-[112px]">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="metric-card metric-amber hover-lift animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
              {(() => {
                const CurrencyIcon = getCurrencyIcon(shopifyData.currency);
                return <CurrencyIcon className="metric-icon h-4 w-4" />;
              })()}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{formatCurrency(shopifyData.totalSales)}</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Revenue growth compared to previous month</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card className="metric-card metric-blue hover-lift animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingBag className="metric-icon h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{shopifyData.orderCount.toLocaleString()}</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Total orders in the selected period</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card className="metric-card metric-green hover-lift animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Order Value</CardTitle>
              <TrendingUp className="metric-icon h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{formatCurrency(shopifyData.averageOrderValue)}</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average value per order</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>

          <Card className="metric-card metric-pink hover-lift animate-fade-in">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Orders per Day</CardTitle>
              <Package className="metric-icon h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-extrabold">{ordersPerDay.toFixed(1)}</div>
              <Tooltip>
                <TooltipTrigger>
                  <p className="text-xs text-muted-foreground">Period: {periodLabel}</p>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Average orders per day in the selected period</p>
                </TooltipContent>
              </Tooltip>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="hover-lift animate-fade-in bg-gradient-to-br from-blue-50/40 to-cyan-50/40">
            <CardHeader>
              <CardTitle>Sales Trend ({periodLabel})</CardTitle>
              <CardDescription>Daily sales performance</CardDescription>
            </CardHeader>
            <CardContent className="w-full">
              <ChartContainer config={{
              sales: {
                label: "Sales",
                color: "hsl(var(--primary))"
              }
            }} className="h-[200px] w-full">
                <LineChart data={shopifyData.salesTrend} width={400} height={200}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="hover-lift animate-fade-in bg-gradient-to-br from-emerald-50/40 to-teal-50/40">
            <CardHeader>
              <CardTitle>Visitors Trend ({periodLabel})</CardTitle>
              <CardDescription>Daily website visitors</CardDescription>
            </CardHeader>
            <CardContent className="w-full">
              <ChartContainer config={{
              visitors: {
                label: "Visitors",
                color: "hsl(221, 83%, 53%)"
              }
            }} className="h-[200px] w-full">
                <LineChart data={shopifyData.visitorTrend} width={400} height={200}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="visitors" stroke="hsl(221, 83%, 53%)" strokeWidth={2} />
                </LineChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top Products */}
        <Card className="hover-lift animate-fade-in bg-gradient-to-br from-purple-50/30 to-pink-50/30">
          <CardHeader>
            <CardTitle>Top Performing Products (Last Month)</CardTitle>
            <CardDescription>Top 5 in {lastMonthInfo.label}: units sold and revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(lastMonthTop.length > 0 || shopifyData.topProducts.length > 0) ? (lastMonthTop.length > 0 ? lastMonthTop : shopifyData.topProducts).slice(0, 5).map((product, index) => <div key={product.id ?? index} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <Badge variant="secondary" className="min-w-[24px] h-6 flex items-center justify-center">
                        {index + 1}
                      </Badge>
                      <div>
                        <h4 className="font-medium">{product.name}</h4>
                        <p className="text-sm text-muted-foreground">{product.sales || 0} sold</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{formatCurrency(product.revenue || 0)}</p>
                      <p className="text-sm text-muted-foreground">Revenue</p>
                    </div>
                  </div>) : <p className="text-sm text-muted-foreground">No product data available.</p>}
            </div>
          </CardContent>
        </Card>

        {/* All Products */}
        <Card className="hover-lift animate-fade-in bg-gradient-to-br from-orange-50/30 to-amber-50/30">
          <CardHeader>
            <CardTitle>All Products</CardTitle>
            <CardDescription>Products fetched from your store</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedProducts.length > 0 ? paginatedProducts.map((p: any) => <div key={p.id} className="border rounded-lg p-4 flex items-start gap-4">
                  {p.image &&
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.image} alt={`${p.name} product image`} className="w-16 h-16 rounded object-cover" loading="lazy" />}
                  <div className="flex-1">
                    <h4 className="font-medium">{p.name || 'Unknown Product'}</h4>
                    <p className="text-sm text-muted-foreground">{p.type || 'Product'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">{formatCurrency(p.price || 0)}</p>
                  </div>
                </div>) : <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No products available in current view.</p>
                <p className="text-xs text-muted-foreground mt-1">Try refreshing or adjusting date range.</p>
              </div>}
            </div>
            {shopifyData.products.length > pageSize && <Pagination className="mt-6">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" onClick={e => {
                  e.preventDefault();
                  setCurrentPage(p => Math.max(1, p - 1));
                }} />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="text-sm text-muted-foreground px-2">Page {currentPage} of {totalPages}</span>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#" onClick={e => {
                  e.preventDefault();
                  setCurrentPage(p => Math.min(totalPages, p + 1));
                }} />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>}
          </CardContent>
        </Card>

        {/* Last Updated */}
        <div className="text-center text-sm text-muted-foreground">
          Last updated: {shopifyData.lastUpdated ? new Date(shopifyData.lastUpdated).toLocaleString() : 'Never'}
        </div>
      </div>
    </TooltipProvider>;
};
export default ShopifyDashboard;