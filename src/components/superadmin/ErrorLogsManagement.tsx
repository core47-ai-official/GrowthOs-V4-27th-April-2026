import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  XCircle, 
  CheckCircle,
  RefreshCw,
  Filter,
  Calendar,
  User,
  Code,
  Database,
  Wifi,
  Shield,
  Zap
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface ErrorLog {
  id: string;
  user_id: string | null;
  error_type: string;
  error_code: string | null;
  error_message: string;
  error_details: any;
  stack_trace: string | null;
  url: string | null;
  user_agent: string | null;
  severity: string;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  user?: {
    email: string;
    full_name: string;
    role: string;
  };
}

// Helper function to parse stack trace and extract file location
const parseStackTraceForDisplay = (stackTrace: string | null, errorDetails: any) => {
  // If error_details already has parsed info, use it
  if (errorDetails?.file) {
    return {
      file: errorDetails.file,
      line: errorDetails.line,
      column: errorDetails.column,
      function: errorDetails.function,
      component: errorDetails.component,
      classification: errorDetails.classification,
      category: errorDetails.category,
      userAction: errorDetails.user_action
    };
  }

  // Otherwise, parse from stack trace as fallback
  if (!stackTrace) return null;

  const lines = stackTrace.split('\n');
  for (const line of lines) {
    // Match patterns like "at Component (file.tsx:123:45)"
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                  line.match(/at\s+(.+?):(\d+):(\d+)/) ||
                  line.match(/(.+?):(\d+):(\d+)/);
    
    if (match) {
      const hasFunction = match.length === 5;
      return {
        file: hasFunction ? match[2].split('/').pop() : match[1].split('/').pop(),
        line: hasFunction ? match[3] : match[2],
        column: hasFunction ? match[4] : match[3],
        function: hasFunction ? match[1] : undefined,
        component: hasFunction && match[1].includes('use') ? undefined : match[1],
        classification: null,
        category: match[1]?.includes('.tsx') || match[2]?.includes('.tsx') ? 'frontend' : null,
        userAction: null
      };
    }
  }
  return null;
};

// Helper to classify error from message
const classifyErrorFromMessage = (message: string, stackTrace: string | null) => {
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('is not defined') || lowerMessage.includes('is not a function')) {
    return 'Missing Import';
  }
  if (lowerMessage.includes('cannot read') || lowerMessage.includes('undefined')) {
    return 'Undefined Variable';
  }
  if (lowerMessage.includes('permission') || lowerMessage.includes('rls') || lowerMessage.includes('policy')) {
    return 'Permission Error (RLS)';
  }
  if (lowerMessage.includes('network') || lowerMessage.includes('fetch')) {
    return 'API Request Failed';
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return 'Validation Error';
  }
  if (stackTrace?.includes('Component') || stackTrace?.includes('use')) {
    return 'Component Error';
  }
  if (lowerMessage.includes('query') || lowerMessage.includes('database')) {
    return 'Database Query Error';
  }
  
  return 'Runtime Error';
};

// Helper to determine error category from context
const getErrorCategory = (errorType: string, stackTrace: string | null, message: string) => {
  if (errorType === 'database' || message.toLowerCase().includes('database')) return 'backend';
  if (errorType === 'api' || message.toLowerCase().includes('api')) return 'integration';
  if (errorType === 'validation') return 'user_input';
  if (stackTrace?.includes('.tsx') || stackTrace?.includes('.jsx')) return 'frontend';
  return 'unknown';
};

export const ErrorLogsManagement = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterResolved, setFilterResolved] = useState<string>('all');
  
  const pageSize = 5;
  const totalPages = Math.ceil(totalCount / pageSize);

  useEffect(() => {
    fetchErrorLogs();
  }, [currentPage, filterType, filterSeverity, filterResolved]);

  const fetchErrorLogs = async () => {
    try {
      setLoading(true);

      // Build query with filters
      let countQuery = supabase
        .from('error_logs')
        .select('*', { count: 'exact', head: true });
      
      let dataQuery = supabase
        .from('error_logs')
        .select('*');

      // Apply filters to both queries
      if (filterType !== 'all') {
        countQuery = countQuery.eq('error_type', filterType);
        dataQuery = dataQuery.eq('error_type', filterType);
      }
      if (filterSeverity !== 'all') {
        countQuery = countQuery.eq('severity', filterSeverity);
        dataQuery = dataQuery.eq('severity', filterSeverity);
      }
      if (filterResolved !== 'all') {
        countQuery = countQuery.eq('resolved', filterResolved === 'resolved');
        dataQuery = dataQuery.eq('resolved', filterResolved === 'resolved');
      }

      // Get count
      const { count } = await countQuery;

      // Pagination and ordering for data
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      dataQuery = dataQuery
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error } = await dataQuery;

      if (error) throw error;

      // Fetch user details separately
      const logsWithUsers = await Promise.all(
        (data || []).map(async (log) => {
          if (log.user_id) {
            const { data: userData } = await supabase
              .from('users')
              .select('email, full_name, role')
              .eq('id', log.user_id)
              .maybeSingle();
            
            return {
              ...log,
              user: userData || undefined
            };
          }
          return { ...log, user: undefined };
        })
      );

      setLogs(logsWithUsers);
      setTotalCount(count || 0);
    } catch (error: any) {
      console.error('Error fetching error logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load error logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsResolved = async (logId: string) => {
    try {
      const { error } = await supabase
        .from('error_logs')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString(),
        })
        .eq('id', logId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Error marked as resolved'
      });

      fetchErrorLogs();
    } catch (error: any) {
      console.error('Error updating log:', error);
      toast({
        title: 'Error',
        description: 'Failed to update error log',
        variant: 'destructive'
      });
    }
  };

  const getErrorTypeIcon = (type: string) => {
    switch (type) {
      case 'ui': return <Code className="h-4 w-4" />;
      case 'database': return <Database className="h-4 w-4" />;
      case 'api': return <Zap className="h-4 w-4" />;
      case 'network': return <Wifi className="h-4 w-4" />;
      case 'auth': return <Shield className="h-4 w-4" />;
      case 'integration': return <Zap className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Critical
        </Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1 bg-destructive/80">
          <AlertCircle className="h-3 w-3" />
          Error
        </Badge>;
      case 'warning':
        return <Badge variant="outline" className="gap-1 border-warning text-warning">
          <AlertTriangle className="h-3 w-3" />
          Warning
        </Badge>;
      case 'info':
        return <Badge variant="outline" className="gap-1 border-primary text-primary">
          <Info className="h-3 w-3" />
          Info
        </Badge>;
      default:
        return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const resetFilters = () => {
    setFilterType('all');
    setFilterSeverity('all');
    setFilterResolved('all');
    setCurrentPage(1);
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading error logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Error Logs</h1>
          <p className="text-muted-foreground mt-2">
            Monitor and track all system errors across the platform
          </p>
        </div>
        <Button onClick={fetchErrorLogs} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Error Type</label>
              <Select value={filterType} onValueChange={(value) => { setFilterType(value); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="ui">UI</SelectItem>
                  <SelectItem value="database">Database</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="validation">Validation</SelectItem>
                  <SelectItem value="auth">Authentication</SelectItem>
                  <SelectItem value="integration">Integration</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Severity</label>
              <Select value={filterSeverity} onValueChange={(value) => { setFilterSeverity(value); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filterResolved} onValueChange={(value) => { setFilterResolved(value); setCurrentPage(1); }}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="unresolved">Unresolved</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={resetFilters} variant="outline" className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Errors</p>
                <p className="text-2xl font-bold">{totalCount}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unresolved</p>
                <p className="text-2xl font-bold text-destructive">
                  {logs.filter(l => !l.resolved).length}
                </p>
              </div>
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical</p>
                <p className="text-2xl font-bold text-destructive">
                  {logs.filter(l => l.severity === 'critical').length}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolved</p>
                <p className="text-2xl font-bold text-success">
                  {logs.filter(l => l.resolved).length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>
            Showing {logs.length} of {totalCount} total errors (Page {currentPage} of {totalPages || 1})
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
              <p className="text-muted-foreground">No errors found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                // Parse stack trace for display
                const parsedInfo = parseStackTraceForDisplay(log.stack_trace, log.error_details);
                const classification = parsedInfo?.classification || classifyErrorFromMessage(log.error_message, log.stack_trace);
                const category = parsedInfo?.category || getErrorCategory(log.error_type, log.stack_trace, log.error_message);
                
                return (
                <Card key={log.id} className={`border-l-4 ${
                  log.severity === 'critical' ? 'border-l-destructive' :
                  log.severity === 'error' ? 'border-l-destructive/70' :
                  log.severity === 'warning' ? 'border-l-warning' :
                  'border-l-primary'
                }`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Header Row */}
                        <div className="flex items-center gap-3 flex-wrap">
                          <div className="flex items-center gap-2 bg-muted px-3 py-1 rounded-md">
                            {getErrorTypeIcon(log.error_type)}
                            <span className="text-sm font-medium capitalize">{log.error_type}</span>
                          </div>
                          {getSeverityBadge(log.severity)}
                          {log.resolved && (
                            <Badge variant="outline" className="gap-1 border-success text-success">
                              <CheckCircle className="h-3 w-3" />
                              Resolved
                            </Badge>
                          )}
                          {log.error_code && (
                            <Badge variant="secondary" className="font-mono text-xs">
                              {log.error_code}
                            </Badge>
                          )}
                        </div>

                        {/* File Location - Prominently Displayed */}
                        {parsedInfo && (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-1">
                              <Code className="h-4 w-4 text-destructive" />
                              <span className="text-sm font-medium text-destructive">Error Location:</span>
                            </div>
                            <div className="font-mono text-sm">
                              <span className="font-bold text-foreground">{parsedInfo.file}</span>
                              {parsedInfo.line && (
                                <span className="text-muted-foreground">:{parsedInfo.line}</span>
                              )}
                              {parsedInfo.column && (
                                <span className="text-muted-foreground">:{parsedInfo.column}</span>
                              )}
                            </div>
                            {parsedInfo.function && (
                              <div className="text-xs text-muted-foreground mt-1">
                                in function: <span className="font-mono">{parsedInfo.function}()</span>
                              </div>
                            )}
                            {parsedInfo.component && (
                              <div className="text-xs text-muted-foreground">
                                component: <span className="font-mono">&lt;{parsedInfo.component} /&gt;</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Error Classification */}
                        {classification && (
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-medium">
                              {classification}
                            </Badge>
                            {category && (
                              <Badge variant="secondary" className="text-xs">
                                {category === 'frontend' ? '🎨 Frontend' :
                                 category === 'backend' ? '⚙️ Backend' :
                                 category === 'user_input' ? '👤 User Input' :
                                 category === 'integration' ? '🔌 Integration' :
                                 category}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Error Message */}
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground">
                            {log.error_message}
                          </p>
                          {parsedInfo?.userAction && parsedInfo.userAction !== 'Unknown' && (
                            <p className="text-sm text-muted-foreground">
                              During: <span className="font-medium">{parsedInfo.userAction}</span>
                            </p>
                          )}
                        </div>

                        {/* Quick Fix Suggestions */}
                        {classification && (
                          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm">
                            <p className="font-medium text-primary mb-1">💡 Suggested Fix:</p>
                            <p className="text-muted-foreground">
                              {classification === 'Missing Import' && 
                                `Check if the module is imported correctly. For "${log.error_message.split(' ')[0]}", add: import { ${log.error_message.split(' ')[0]} } from 'lucide-react' (or the appropriate package)`}
                              {classification === 'Undefined Variable' && 
                                'Add null checks before accessing properties. Use optional chaining (?.) or provide default values.'}
                              {classification === 'Type Error' && 
                                'Verify the data type being passed. Check if the function exists and is being called correctly.'}
                              {classification === 'Permission Error (RLS)' && 
                                'Check Row Level Security policies. Ensure the user has proper permissions and the RLS policy allows this operation.'}
                              {classification === 'Component Error' && 
                                'Review component props and state. Check for missing dependencies in useEffect or incorrect prop types.'}
                              {classification === 'Database Query Error' && 
                                'Verify the query syntax and table/column names. Check if the referenced data exists.'}
                              {classification === 'API Request Failed' && 
                                'Check network connectivity and API endpoint. Verify request parameters and authentication tokens.'}
                              {classification === 'Validation Error' && 
                                'Review form validation rules. Ensure user input matches expected format and constraints.'}
                              {classification === 'Runtime Error' && 
                                'Review the error message and stack trace for clues. Check recent code changes that might have introduced this issue.'}
                            </p>
                          </div>
                        )}

                        {/* User Info */}
                        {log.user && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-4 w-4" />
                            <span className="font-medium">{log.user.full_name || log.user.email}</span>
                            <Badge variant="outline" className="text-xs">{log.user.role}</Badge>
                          </div>
                        )}

                        {/* Meta Info */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(log.created_at), 'MMM dd, yyyy HH:mm:ss')}
                          </div>
                          {log.url && (
                            <div className="flex items-center gap-1 max-w-[300px] truncate">
                              <Code className="h-3 w-3" />
                              <span className="truncate">{log.url}</span>
                            </div>
                          )}
                        </div>

                        {/* Stack Trace (if available) */}
                        {log.stack_trace && (
                          <details className="mt-2">
                            <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                              View stack trace
                            </summary>
                            <pre className="mt-2 p-3 bg-muted rounded-md text-xs overflow-x-auto max-h-40">
                              {log.stack_trace}
                            </pre>
                          </details>
                        )}
                      </div>

                      {/* Actions */}
                      {!log.resolved && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markAsResolved(log.id)}
                          className="flex-shrink-0"
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
