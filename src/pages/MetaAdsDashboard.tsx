import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, TrendingUp, Eye, MousePointer, DollarSign, RefreshCw, ExternalLink, AlertCircle, CheckCircle2, ArrowUp, ArrowDown, Minus, Sparkles, Activity, CalendarIcon, Play, Pause, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { handleApplicationError } from '@/utils/errorHandling';
import { ErrorMessage } from '@/components/ui/error-message';
import { SafeErrorBoundary } from '@/components/SafeErrorBoundary';
interface MetaData {
  campaigns: Array<any>;
  adSets: Array<any>;
  ads: Array<any>;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  totalConversionValue: number;
  averageCTR: number;
  averageCPC: number;
  averageROAS: number;
  lastUpdated: string | null;
  currency?: string;
  warnings?: string[];
  error?: string;
}
interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}
const MetaAdsDashboard: React.FC = () => {
  const {
    toast
  } = useToast();
  const {
    user
  } = useAuth();
  const navigate = useNavigate();
  const {
    error,
    handleError,
    clearError
  } = useErrorHandler();
  const [loading, setLoading] = useState<boolean>(true);
  const [metaData, setMetaData] = useState<MetaData>({
    campaigns: [],
    adSets: [],
    ads: [],
    totalSpend: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalConversionValue: 0,
    averageCTR: 0,
    averageCPC: 0,
    averageROAS: 0,
    lastUpdated: null,
    currency: 'USD',
    warnings: [],
    error: undefined
  });
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected' | 'error'>('checking');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [currentCampaignPage, setCampaignCurrentPage] = useState<number>(1);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<'all' | 'active' | 'paused' | 'inactive'>('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  });
  const [pendingDateRange, setPendingDateRange] = useState<DateRange>({
    from: undefined,
    to: undefined
  });
  const [hasDateChanges, setHasDateChanges] = useState<boolean>(false);
  const adsPerPage = 3;
  const campaignsPerPage = 2;
  useEffect(() => {
    fetchMetaAdsData();
  }, []);
  /**
   * Fetches Meta Ads data from the API with proper error handling
   */
  const fetchMetaAdsData = useCallback(async (customDateRange: DateRange | null = null): Promise<void> => {
    setLoading(true);
    clearError();
    try {
      const requestBody: Record<string, any> = {};

      // Add date range if specified
      if (customDateRange?.from) {
        requestBody.dateFrom = customDateRange.from.toISOString();
      }
      if (customDateRange?.to) {
        requestBody.dateTo = customDateRange.to.toISOString();
      }
      const {
        data,
        error
      } = await supabase.functions.invoke('meta-ads-metrics', {
        body: requestBody
      });
      if (error) throw error;
      if (!data?.connected) {
        setConnectionStatus(data?.error ? 'error' : 'disconnected');
        setMetaData(prev => ({
          ...prev,
          error: data?.error,
          warnings: data?.warnings
        }));
        setLoading(false);
        return;
      }
      const m = data.metrics || {};
      setMetaData({
        campaigns: m.campaigns || [],
        adSets: m.adSets || [],
        ads: m.ads || [],
        totalSpend: m.totalSpend ?? m.spend ?? 0,
        totalImpressions: m.totalImpressions ?? m.impressions ?? 0,
        totalClicks: m.totalClicks ?? m.clicks ?? 0,
        totalConversions: m.totalConversions ?? m.conversions ?? 0,
        totalConversionValue: m.totalConversionValue ?? 0,
        averageCTR: m.averageCTR ?? m.ctr ?? 0,
        averageCPC: m.averageCPC ?? m.cpc ?? 0,
        averageROAS: m.averageROAS ?? 0,
        lastUpdated: new Date().toISOString(),
        currency: m.currency || 'USD',
        warnings: data.warnings || [],
        error: undefined
      });
      setConnectionStatus('connected');
    } catch (error: any) {
      handleApplicationError(error, 'Meta Ads data fetch', false);
      handleError(error, 'Meta Ads Dashboard');
      setConnectionStatus('error');
    } finally {
      setLoading(false);
    }
  }, [clearError, handleError]);
  /**
   * Formats a number value as currency using account currency
   */
  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: metaData.currency || 'USD'
    }).format(amount);
  }, [metaData.currency]);

  /**
   * Formats a number with locale-specific formatting
   */
  const formatNumber = useCallback((num: number): string => {
    return new Intl.NumberFormat('en-US').format(num);
  }, []);

  /**
   * Returns appropriate performance icon based on performance level
   */
  const getPerformanceIcon = useCallback((performance: string): JSX.Element => {
    switch (performance) {
      case 'excellent':
        return <ArrowUp className="h-4 w-4 text-success" />;
      case 'good':
        return <ArrowUp className="h-4 w-4 text-primary" />;
      case 'poor':
        return <ArrowDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-warning" />;
    }
  }, []);

  /**
   * Returns performance badge with appropriate styling
   */
  const getPerformanceBadge = useCallback((performance: string): JSX.Element => {
    const variants = {
      excellent: 'bg-success/10 text-success border-success/20',
      good: 'bg-primary/10 text-primary border-primary/20',
      average: 'bg-warning/10 text-warning border-warning/20',
      poor: 'bg-destructive/10 text-destructive border-destructive/20'
    };
    return <Badge className={variants[performance as keyof typeof variants] || variants.average}>
        {performance.charAt(0).toUpperCase() + performance.slice(1)}
      </Badge>;
  }, []);

  /**
   * Gets proper status badge for campaign effective_status
   */
  const getCampaignStatusBadge = useCallback((status: string): JSX.Element => {
    const normalizedStatus = (status || '').toUpperCase();
    if (['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES'].includes(normalizedStatus)) {
      return <Badge className="bg-success/10 text-success border-success/20 px-3 py-1 flex items-center gap-1">
          <Play className="h-3 w-3" />
          {status}
        </Badge>;
    }
    if (['PAUSED'].includes(normalizedStatus)) {
      return <Badge className="bg-warning/10 text-warning border-warning/20 px-3 py-1 flex items-center gap-1">
          <Pause className="h-3 w-3" />
          {status}
        </Badge>;
    }

    // ARCHIVED, DELETED, or other inactive statuses
    return;
  }, []);

  /**
   * Categorizes campaigns by effective_status
   */
  const categorizedCampaigns = useMemo(() => {
    const campaignsWithActivity = metaData.campaigns.filter(campaign => (campaign.spend || 0) > 0 || (campaign.impressions || 0) > 0 || (campaign.clicks || 0) > 0 || (campaign.conversions || 0) > 0);
    return {
      all: campaignsWithActivity,
      active: campaignsWithActivity.filter(c => {
        const status = (c.effective_status || c.status || '').toUpperCase();
        return ['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES'].includes(status);
      }),
      paused: campaignsWithActivity.filter(c => {
        const status = (c.effective_status || c.status || '').toUpperCase();
        return status === 'PAUSED';
      }),
      inactive: campaignsWithActivity.filter(c => {
        const status = (c.effective_status || c.status || '').toUpperCase();
        return ['ARCHIVED', 'DELETED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'].includes(status) || !['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES', 'PAUSED'].includes(status) && status !== '';
      })
    };
  }, [metaData.campaigns]);
  /**
   * Returns appropriate status icon based on connection status
   */
  const getStatusIcon = useCallback((): JSX.Element => {
    switch (connectionStatus) {
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <RefreshCw className="h-4 w-4 text-warning animate-spin" />;
    }
  }, [connectionStatus]);

  /**
   * Updates the active date range and refetches data
   */
  const updateDateRange = useCallback((): void => {
    setDateRange({
      from: pendingDateRange.from,
      to: pendingDateRange.to
    });
    setHasDateChanges(false);
    fetchMetaAdsData(pendingDateRange.from && pendingDateRange.to ? pendingDateRange : null);
  }, [pendingDateRange.from, pendingDateRange.to, fetchMetaAdsData]);
  if (loading) {
    return <div className="flex items-center justify-center min-h-96 animate-fade-in">
        <div className="text-center">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-success/20 rounded-full blur-lg opacity-50"></div>
            <RefreshCw className="h-12 w-12 animate-spin mx-auto mb-6 relative z-10" style={{
            color: 'hsl(var(--primary))'
          }} />
          </div>
          <p className="text-muted-foreground font-medium">Loading your Meta Ads insights...</p>
          <div className="flex items-center justify-center mt-4 space-x-2">
            <Sparkles className="h-4 w-4 animate-pulse" style={{
            color: 'hsl(var(--primary))'
          }} />
            <span className="text-sm text-muted-foreground">Fetching campaign data</span>
          </div>
        </div>
      </div>;
  }
  if (connectionStatus === 'disconnected' || connectionStatus === 'error') {
    return <div className="max-w-4xl mx-auto animate-fade-in">
        <Card className="text-center p-12 shadow-elevated">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-warning/10 rounded-full blur-2xl"></div>
            {connectionStatus === 'error' ? <AlertCircle className="h-20 w-20 mx-auto relative z-10 text-destructive" /> : <Target className="h-20 w-20 mx-auto relative z-10" style={{
            color: 'hsl(var(--primary))'
          }} />}
          </div>
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-success bg-clip-text text-transparent">
            {connectionStatus === 'error' ? 'Connection Issue' : 'Connect Your Meta Ads Account'}
          </h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto text-lg">
            {metaData.error || 'Unlock powerful insights and analytics for your advertising campaigns.'}
          </p>
          {metaData.warnings && metaData.warnings.length > 0 && <div className="mb-6 p-4 bg-warning/10 border border-warning/20 rounded-lg text-left max-w-md mx-auto">
              <p className="text-sm text-warning font-medium mb-2">Additional Details:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                {metaData.warnings.map((warning, idx) => <li key={idx}>• {warning}</li>)}
              </ul>
            </div>}
          <Button onClick={() => navigate('/connect')} size="lg" className="gradient-primary hover-lift shadow-medium px-8 py-3">
            <ExternalLink className="h-5 w-5 mr-2" />
            Manage Connection
          </Button>
        </Card>
      </div>;
  }
  return <SafeErrorBoundary>
      <TooltipProvider>
        <div className="max-w-7xl mx-auto space-y-6">
          {error && <ErrorMessage error={error} onDismiss={clearError} className="mb-4" />}
          
          {/* Meta API Notice */}
          

          {/* Warnings from backend */}
          {metaData.warnings && metaData.warnings.length > 0 && <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 mb-4 animate-fade-in">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
                  <div>
                    <p className="font-medium text-warning mb-2">Data Fetching Notes:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {metaData.warnings.map((warning, idx) => <li key={idx}>• {warning}</li>)}
                      <li>• Metrics might vary due to Meta API processing delays and data aggregation</li>
                    </ul>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setMetaData(prev => ({
              ...prev,
              warnings: []
            }))} className="text-muted-foreground hover:text-foreground">
                  Dismiss
                </Button>
              </div>
            </div>}
          
          {/* Zero data helper */}
          {connectionStatus === 'connected' && metaData.totalSpend === 0 && metaData.totalImpressions === 0 && metaData.campaigns.length === 0 && !dateRange.from && <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-4 animate-fade-in">
              <div className="flex items-start space-x-3">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-primary mb-2">No recent activity detected</p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Try viewing data from the last 30 days to see historical campaigns and ads.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => {
                const to = new Date();
                const from = new Date();
                from.setDate(from.getDate() - 30);
                setDateRange({
                  from,
                  to
                });
                setPendingDateRange({
                  from,
                  to
                });
                fetchMetaAdsData({
                  from,
                  to
                });
              }} className="text-primary border-primary/30 hover:bg-primary/10">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Try Last 30 Days
                  </Button>
                </div>
              </div>
            </div>}
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 animate-slide-up">
          <div>
            <h1 className="text-4xl font-bold text-foreground">
              Meta Ads Dashboard
            </h1>
            <p className="text-muted-foreground text-lg mt-2 flex items-center">
              <Activity className="h-5 w-5 mr-2" style={{
                color: 'hsl(var(--primary))'
              }} />
              Real-time campaign performance and advertising analytics
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <span className="text-sm font-medium">
                {connectionStatus === 'connected' ? 'Live Connected' : 'Connection Issue'}
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="hover-lift shadow-soft flex items-center space-x-2">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {dateRange.from && dateRange.to ? `${format(dateRange.from, 'MMM dd')} - ${format(dateRange.to, 'MMM dd')}` : 'Select date range'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" defaultMonth={pendingDateRange.from || dateRange.from} selected={pendingDateRange} onSelect={range => {
                    setPendingDateRange({
                      from: range?.from,
                      to: range?.to
                    });
                    setHasDateChanges(true);
                  }} numberOfMonths={2} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              
              {hasDateChanges && <Button variant="default" size="sm" onClick={updateDateRange} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Update
                </Button>}
              
              {(dateRange.from || dateRange.to) && <Button variant="ghost" size="sm" onClick={() => {
                setDateRange({
                  from: undefined,
                  to: undefined
                });
                setPendingDateRange({
                  from: undefined,
                  to: undefined
                });
                setHasDateChanges(false);
                fetchMetaAdsData();
              }} className="text-muted-foreground hover:text-foreground">
                  Clear
                </Button>}
            </div>
            
            <Button onClick={() => fetchMetaAdsData(dateRange.from ? dateRange : null)} variant="outline" size="sm" className="hover-lift shadow-soft">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Overall KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-scale-in">
          <Card className="metric-card metric-blue hover-lift shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-foreground">Total Spend</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 metric-icon" style={{
                  color: 'hsl(var(--primary))'
                }} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-2xl lg:text-3xl font-bold text-foreground mb-1 break-words overflow-hidden">
                {formatCurrency(metaData.totalSpend || 0)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="inline-block w-2 h-2 bg-primary rounded-full mr-2"></span>
                {dateRange.from && dateRange.to ? `${Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} days selected` : 'Last 7 days'} • {metaData.campaigns?.length || 0} campaigns
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card metric-green hover-lift shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-foreground">Impressions</CardTitle>
              <div className="p-2 rounded-lg bg-success/10">
                <Eye className="h-5 w-5 metric-icon" style={{
                  color: 'hsl(var(--success))'
                }} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-2xl lg:text-3xl font-bold text-foreground mb-1 break-words overflow-hidden">
                {formatNumber(metaData.totalImpressions || 0)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="inline-block w-2 h-2 bg-success rounded-full mr-2"></span>
                {(metaData.averageCTR || 0).toFixed(2)}% CTR • {formatNumber(metaData.totalClicks || 0)} clicks • {dateRange.from && dateRange.to ? `${Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} days` : '7 days'}
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card metric-amber hover-lift shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-foreground">Conversions</CardTitle>
              <div className="p-2 rounded-lg bg-warning/10">
                <TrendingUp className="h-5 w-5 metric-icon" style={{
                  color: 'hsl(var(--warning))'
                }} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-2xl lg:text-3xl font-bold text-foreground mb-1 break-words overflow-hidden">
                {formatNumber(metaData.totalConversions || 0)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="inline-block w-2 h-2 bg-warning rounded-full mr-2"></span>
                {formatCurrency(metaData.averageCPC || 0)} avg CPC • {dateRange.from && dateRange.to ? `${Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} days period` : '7 days'} • {(metaData.totalClicks || 0) > 0 ? ((metaData.totalConversions || 0) / (metaData.totalClicks || 0) * 100).toFixed(2) + '% conv rate' : '0% conv rate'}
              </p>
            </CardContent>
          </Card>

          <Card className="metric-card metric-pink hover-lift shadow-soft border-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
              <CardTitle className="text-sm font-medium text-foreground">ROAS</CardTitle>
              <div className="p-2 rounded-lg" style={{
                backgroundColor: 'hsl(330 81% 60% / 0.1)'
              }}>
                <MousePointer className="h-5 w-5 metric-icon" style={{
                  color: 'hsl(330 81% 60%)'
                }} />
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="text-2xl lg:text-3xl font-bold text-foreground mb-1 break-words overflow-hidden">
                {metaData.averageROAS ? `${metaData.averageROAS.toFixed(2)}x` : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground flex items-center">
                <span className="inline-block w-2 h-2 rounded-full mr-2" style={{
                  backgroundColor: 'hsl(330 81% 60%)'
                }}></span>
                {formatCurrency(metaData.totalConversionValue || 0)} revenue • {dateRange.from && dateRange.to ? `${Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} days period` : '7 days'} • {formatCurrency(metaData.totalSpend || 0)} spent
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Campaigns in Selected Period */}
        <Card className="shadow-medium hover-lift border-0 animate-fade-in">
          <CardHeader className="gradient-hero text-white rounded-t-lg">
            <CardTitle className="text-white flex items-center text-xl">
              <Target className="h-6 w-6 mr-3" />
              Campaigns by Status
            </CardTitle>
            <CardDescription className="text-white/80">
              Campaigns with spend, impressions, clicks, or conversions categorized by status
            </CardDescription>
          </CardHeader>
          <CardContent className="py-[15px]">
            <Tabs value={campaignStatusFilter} onValueChange={v => {
              setCampaignStatusFilter(v as typeof campaignStatusFilter);
              setCampaignCurrentPage(1);
            }} className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="all" className="flex items-center gap-2">
                  All
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {categorizedCampaigns.all.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="active" className="flex items-center gap-2">
                  <Play className="h-3 w-3" />
                  Active
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {categorizedCampaigns.active.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="paused" className="flex items-center gap-2">
                  <Pause className="h-3 w-3" />
                  Paused
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {categorizedCampaigns.paused.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="inactive" className="flex items-center gap-2">
                  <Ban className="h-3 w-3" />
                  Inactive
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {categorizedCampaigns.inactive.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              {['all', 'active', 'paused', 'inactive'].map(filterType => <TabsContent key={filterType} value={filterType} className="space-y-4">
                  {(() => {
                  const filteredCampaigns = categorizedCampaigns[filterType as keyof typeof categorizedCampaigns];
                  if (filteredCampaigns.length === 0) {
                    return <div className="text-center py-12">
                        <Target className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                        <h3 className="text-lg font-medium mb-2">
                          No {filterType === 'all' ? '' : filterType.charAt(0).toUpperCase() + filterType.slice(1)} Campaigns Found
                        </h3>
                        <p className="text-muted-foreground mb-4">
                          {categorizedCampaigns.all.length === 0 ? "No campaigns have been created yet or the API couldn't fetch campaign details." : `No ${filterType === 'all' ? '' : filterType} campaigns recorded activity in the chosen timeframe.`}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total account metrics: {formatCurrency(metaData.totalSpend)} spent, {formatNumber(metaData.totalImpressions)} impressions
                        </p>
                      </div>;
                  }

                  // Pagination logic for campaigns
                  const totalCampaignPages = Math.ceil(filteredCampaigns.length / campaignsPerPage);
                  const campaignStartIndex = (currentCampaignPage - 1) * campaignsPerPage;
                  const campaignEndIndex = campaignStartIndex + campaignsPerPage;
                  const currentCampaigns = filteredCampaigns.slice(campaignStartIndex, campaignEndIndex);
                  return <>
                      {currentCampaigns.map((campaign, index) => <div key={campaign.id} className="border rounded-xl p-6 hover-lift shadow-soft hover:shadow-medium transition-all duration-300 bg-gradient-to-r from-card to-muted/20" style={{
                      animationDelay: `${index * 100}ms`
                    }}>
                        <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center space-x-4">
                            <div className="p-3 rounded-full bg-gradient-to-r from-primary/20 to-success/20">
                              <Activity className="h-6 w-6" style={{
                              color: 'hsl(var(--primary))'
                            }} />
                            </div>
                            <div>
                              <h4 className="font-semibold text-xl text-foreground mb-1">{campaign.name}</h4>
                              <div className="flex items-center space-x-3">
                                {getCampaignStatusBadge(campaign.effective_status || campaign.status)}
                                {getPerformanceBadge(campaign.performance)}
                              </div>
                            </div>
                          </div>
                        <div className="flex items-center space-x-3 bg-muted/50 rounded-lg px-4 py-2">
                          {getPerformanceIcon(campaign.performance)}
                          <span className="text-sm font-semibold text-foreground">
                            {campaign.clicks > 0 ? ((campaign.conversions || 0) / campaign.clicks * 100).toFixed(2) : '0.00'}% Conv. Rate
                          </span>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                        <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-4 border border-primary/10">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <DollarSign className="h-3 w-3 mr-1" style={{
                              color: 'hsl(var(--primary))'
                            }} />
                            Total Spent
                          </p>
                          <p className="font-bold text-lg text-foreground whitespace-nowrap overflow-x-auto">{formatCurrency(campaign.spend || 0)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-success/5 to-success/10 rounded-lg p-4 border border-success/10">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" style={{
                              color: 'hsl(var(--success))'
                            }} />
                            ROAS (Meta)
                          </p>
                           <p className="font-bold text-lg text-foreground break-words overflow-hidden">{campaign.roas ? `${campaign.roas.toFixed(2)}x` : '—'}</p>
                        </div>
                        
                        <div className="bg-gradient-to-br from-warning/5 to-warning/10 rounded-lg p-4 border border-warning/10">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <Target className="h-3 w-3 mr-1" style={{
                              color: 'hsl(var(--warning))'
                            }} />
                            Results
                          </p>
                          <p className="font-bold text-lg text-foreground break-words overflow-hidden">{formatNumber(campaign.conversions || campaign.results || 0)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 rounded-lg p-4 border border-blue-500/10">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <Eye className="h-3 w-3 mr-1 text-blue-500" />
                            Impressions
                          </p>
                          <p className="font-bold text-lg text-foreground break-words overflow-hidden">{formatNumber(campaign.impressions || 0)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-500/5 to-purple-500/10 rounded-lg p-4 border border-purple-500/10">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <MousePointer className="h-3 w-3 mr-1 text-purple-500" />
                            Clicks
                          </p>
                          <p className="font-bold text-lg text-foreground break-words overflow-hidden">{formatNumber(campaign.clicks || 0)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 rounded-lg p-4 border border-emerald-500/10">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <Activity className="h-3 w-3 mr-1 text-emerald-500" />
                            CTR
                          </p>
                          <p className="font-bold text-lg text-foreground break-words overflow-hidden">{(campaign.ctr || 0).toFixed(2)}%</p>
                        </div>
                        <div className="bg-gradient-to-br from-pink-500/5 to-pink-500/10 rounded-lg p-4 border border-pink-500/10">
                          <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center">
                            <DollarSign className="h-3 w-3 mr-1 text-pink-500" />
                            Avg CPC
                          </p>
                          <p className="font-bold text-lg text-foreground break-words overflow-hidden">{formatCurrency(campaign.cpc || 0)}</p>
                        </div>
                      </div>
                      
                      {campaign.budget && campaign.spend && <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Budget Utilization</span>
                            <span className="font-medium">
                              {(campaign.spend / campaign.budget * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress value={campaign.spend / campaign.budget * 100} className="h-3" />
                        </div>}
                    </div>)}

                      {/* Campaign Pagination Controls */}
                      {totalCampaignPages > 1 && <div className="flex justify-center mt-6">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious onClick={() => setCampaignCurrentPage(prev => Math.max(prev - 1, 1))} className={currentCampaignPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                            </PaginationItem>
                            
                            {[...Array(totalCampaignPages)].map((_, i) => <PaginationItem key={i + 1}>
                              <PaginationLink onClick={() => setCampaignCurrentPage(i + 1)} isActive={currentCampaignPage === i + 1} className="cursor-pointer">
                                {i + 1}
                              </PaginationLink>
                            </PaginationItem>)}
                            
                            <PaginationItem>
                              <PaginationNext onClick={() => setCampaignCurrentPage(prev => Math.min(prev + 1, totalCampaignPages))} className={currentCampaignPage === totalCampaignPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>}
                      
                      <div className="text-center text-sm text-muted-foreground mt-4">
                        Showing {currentCampaigns.length} of {filteredCampaigns.length} {filterType === 'all' ? '' : filterType} campaigns with activity
                      </div>
                    </>;
                })()}
                </TabsContent>)}
            </Tabs>
          </CardContent>
        </Card>

        {/* Active Ads with Pagination */}
        <Card className="lg:col-span-2 shadow-medium hover-lift border-0 animate-fade-in">
          <CardHeader className="bg-gradient-to-r from-secondary to-accent text-foreground rounded-t-lg">
            <CardTitle className="flex items-center text-xl">
              <Sparkles className="h-6 w-6 mr-3" style={{
                color: 'hsl(var(--primary))'
              }} />
              Ads in Selected Period
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Ads that recorded spend, impressions, clicks, or conversions in the selected date range
            </CardDescription>
          </CardHeader>
          <CardContent className="py-[10px]">
            <div className="space-y-4">
              {(() => {
                const adsWithActivity = metaData.ads;
                const totalPages = Math.ceil(adsWithActivity.length / adsPerPage);
                const startIndex = (currentPage - 1) * adsPerPage;
                const endIndex = startIndex + adsPerPage;
                const currentAds = adsWithActivity.slice(startIndex, endIndex);
                return <>
                    {currentAds.length > 0 ? currentAds.map((ad, index) => <div key={ad.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <Badge variant="secondary" className="min-w-[32px] h-8 flex items-center justify-center">
                              {startIndex + index + 1}
                            </Badge>
                            <div className="flex-1">
                              <h4 className="font-medium text-sm">{ad.name}</h4>
                              <div className="flex items-center space-x-2 mt-1 mb-2">
                                {getPerformanceIcon(ad.performance)}
                                <span className="text-xs text-muted-foreground">
                                  {ad.ctr}% CTR • {formatCurrency(ad.cpc)} CPC
                                </span>
                                
                              </div>
                              <div className="text-xs text-muted-foreground space-y-1">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">Campaign:</span>
                                  <span>{ad.campaign_name || ad.campaignName || 'N/A'}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">Ad Set:</span>
                                  <span>{ad.adset_name || ad.adSetName || 'N/A'}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-sm">{formatCurrency(ad.spend)}</p>
                            <p className="text-xs text-muted-foreground">{formatNumber(ad.clicks)} clicks</p>
                            <p className="text-xs text-muted-foreground">{formatNumber(ad.impressions)} impressions</p>
                          </div>
                        </div>) : <div className="text-center py-8">
                        <p className="text-muted-foreground">No active ads found</p>
                      </div>}
                    
                    {/* Pagination Controls */}
                    {totalPages > 1 && <div className="flex justify-center mt-6">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                            </PaginationItem>
                            
                            {[...Array(totalPages)].map((_, i) => <PaginationItem key={i + 1}>
                                <PaginationLink onClick={() => setCurrentPage(i + 1)} isActive={currentPage === i + 1} className="cursor-pointer">
                                  {i + 1}
                                </PaginationLink>
                              </PaginationItem>)}
                            
                            <PaginationItem>
                              <PaginationNext onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'} />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                      </div>}
                    
                    <div className="text-center text-sm text-muted-foreground mt-4">
                      Showing {currentAds.length} of {adsWithActivity.length} ads with activity
                    </div>
                  </>;
              })()}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">

          <Card className="shadow-medium hover-lift border-0 animate-fade-in">
            <CardHeader className="bg-gradient-to-r from-muted to-accent/20 rounded-t-lg">
              <CardTitle className="flex items-center text-xl">
                <Activity className="h-6 w-6 mr-3" style={{
                  color: 'hsl(var(--success))'
                }} />
                Performance Health
              </CardTitle>
              <CardDescription>
                Real-time campaign health indicators and performance distribution
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="py-[10px]">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Excellent Performance</span>
                    <span className="text-sm text-muted-foreground">
                      {metaData.campaigns.filter(c => c.performance === 'excellent').length} campaigns
                    </span>
                  </div>
                  <Progress value={metaData.campaigns.filter(c => c.performance === 'excellent').length / metaData.campaigns.length * 100} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Good Performance</span>
                    <span className="text-sm text-muted-foreground">
                      {metaData.campaigns.filter(c => c.performance === 'good').length} campaigns
                    </span>
                  </div>
                  <Progress value={metaData.campaigns.filter(c => c.performance === 'good').length / metaData.campaigns.length * 100} className="h-2" />
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Needs Attention</span>
                    <span className="text-sm text-muted-foreground">
                      {metaData.campaigns.filter(c => c.performance === 'poor').length} campaigns
                    </span>
                  </div>
                  <Progress value={metaData.campaigns.filter(c => c.performance === 'poor').length / metaData.campaigns.length * 100} className="h-2" />
                </div>

                
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Last Updated */}
          <div className="text-center text-sm text-muted-foreground">
            Last updated: {metaData.lastUpdated ? new Date(metaData.lastUpdated).toLocaleString() : 'Never'}
          </div>
        </div>
      </TooltipProvider>
    </SafeErrorBoundary>;
};
export default MetaAdsDashboard;