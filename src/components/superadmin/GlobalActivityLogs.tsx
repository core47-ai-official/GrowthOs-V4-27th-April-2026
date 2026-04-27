import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Download, Search, RefreshCw, Filter, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface GlobalLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  description: string | null;
  data: any;
  performed_by: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
  user_role?: string;
  target_user_name?: string;
  target_user_email?: string;
}

export const GlobalActivityLogs = () => {
  const [logs, setLogs] = useState<GlobalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const { toast } = useToast();

  useEffect(() => {
    fetchGlobalLogs();
  }, [dateRange, actionFilter]);

  const fetchGlobalLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      // Apply date filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange.replace('days', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('created_at', startDate.toISOString());
      }

      // Apply action filter
      if (actionFilter !== 'all') {
        query = query.eq('action', actionFilter);
      }

      const { data: logsData, error: logsError } = await query;
      if (logsError) throw logsError;

      // Get unique user IDs for fetching user info (both performed_by and target_user_id from data)
      const performerIds = (logsData || []).map(l => l.performed_by).filter(Boolean);
      const targetIds = (logsData || []).map(l => {
        const d = l.data as any;
        return d?.target_user_id;
      }).filter(Boolean);
      const userIds = [...new Set([...performerIds, ...targetIds])];
      
      // Fetch user details
      let userMap = new Map<string, { email: string; full_name: string; role: string }>();
      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from('users')
          .select('id, email, full_name, role')
          .in('id', userIds);
        
        (users || []).forEach(u => {
          userMap.set(u.id, { email: u.email, full_name: u.full_name, role: u.role });
        });
      }

      // Map logs with user info
      const enrichedLogs: GlobalLog[] = (logsData || []).map(log => {
        const logData = log.data as any;
        const targetUserId = logData?.target_user_id;
        const targetUser = targetUserId ? userMap.get(targetUserId) : null;
        return {
          id: log.id,
          action: log.action,
          entity_type: log.entity_type,
          entity_id: log.entity_id,
          description: log.description,
          data: log.data,
          performed_by: log.performed_by,
          created_at: log.created_at,
          user_email: log.performed_by ? userMap.get(log.performed_by)?.email : undefined,
          user_name: log.performed_by ? userMap.get(log.performed_by)?.full_name : undefined,
          user_role: log.performed_by ? userMap.get(log.performed_by)?.role : undefined,
          target_user_name: targetUser?.full_name || undefined,
          target_user_email: targetUser?.email || undefined,
        };
      });

      setLogs(enrichedLogs);
    } catch (error) {
      logger.error('Error fetching global activity logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAction = (action: string): string => {
    return action.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatEntity = (entity: string): string => {
    return entity.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatRole = (role: string): string => {
    const roleLabels: Record<string, string> = {
      superadmin: 'Super Admin',
      admin: 'Admin',
      mentor: 'Mentor',
      student: 'Student',
      enrollment_manager: 'Enrollment Manager',
      support_member: 'Support Member'
    };
    return roleLabels[role] || role;
  };

  const getActionBadgeColor = (action: string): string => {
    const colors: Record<string, string> = {
      created: 'bg-green-500',
      updated: 'bg-blue-500',
      deleted: 'bg-red-500',
      login: 'bg-cyan-500',
      logout: 'bg-gray-500',
      approved: 'bg-emerald-500',
      rejected: 'bg-orange-500',
      cascade_deleted: 'bg-red-700'
    };
    return colors[action] || 'bg-gray-500';
  };

  const getRoleBadgeColor = (role?: string): string => {
    const colors: Record<string, string> = {
      superadmin: 'bg-red-500',
      admin: 'bg-purple-500',
      mentor: 'bg-green-500',
      student: 'bg-blue-500',
      enrollment_manager: 'bg-yellow-500',
      support_member: 'bg-teal-500'
    };
    return colors[role || ''] || 'bg-gray-500';
  };

  const exportLogs = () => {
    try {
      const csvContent = [
        ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Description'].join(','),
        ...filteredLogs.map(log => [
          new Date(log.created_at).toISOString(),
          log.user_email || 'System',
          log.user_role || 'System',
          log.action,
          log.entity_type,
          (log.description || '').replace(/,/g, ';')
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `global_activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Logs exported successfully'
      });
    } catch (error) {
      logger.error('Error exporting logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export logs',
        variant: 'destructive'
      });
    }
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      log.user_email?.toLowerCase().includes(searchLower) ||
      log.user_name?.toLowerCase().includes(searchLower) ||
      log.action.toLowerCase().includes(searchLower) ||
      log.entity_type.toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower) ||
      (!log.performed_by && 'system'.includes(searchLower));
    const matchesRole = roleFilter === 'all' || log.user_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Get unique actions for filter dropdown
  const uniqueActions = [...new Set(logs.map(l => l.action))].sort();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Global Activity Logs
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
    <Card className="h-[80vh] flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Global Activity Logs
            <Badge variant="secondary">{filteredLogs.length} records</Badge>
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={fetchGlobalLogs} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={exportLogs} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 min-h-0">
        {/* Filters */}
        <div className="flex-shrink-0 flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64"
            />
          </div>

          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1days">Last 24 hours</SelectItem>
              <SelectItem value="7days">Last 7 days</SelectItem>
              <SelectItem value="30days">Last 30 days</SelectItem>
              <SelectItem value="90days">Last 90 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="superadmin">Super Admin</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="mentor">Mentor</SelectItem>
              <SelectItem value="student">Student</SelectItem>
              <SelectItem value="enrollment_manager">Enrollment Manager</SelectItem>
              <SelectItem value="support_member">Support Member</SelectItem>
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by action" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              {uniqueActions.map(action => (
                <SelectItem key={action} value={action}>{formatAction(action)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Logs Table */}
        <div className="flex-1 flex flex-col border rounded-md overflow-hidden min-h-0">
          <div className="flex-shrink-0 border-b bg-muted/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead className="w-[200px]">Performed By</TableHead>
                  <TableHead className="w-[120px]">Role</TableHead>
                  <TableHead className="w-[160px]">Target Student</TableHead>
                  <TableHead className="w-[120px]">Action</TableHead>
                  <TableHead className="w-[120px]">Entity</TableHead>
                  <TableHead>Description</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          <ScrollArea className="flex-1">
            <Table>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No activity logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs w-[160px]">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="w-[200px]">
                        <div className="flex flex-col">
                          <span className="text-sm truncate">{log.user_name || 'System'}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {log.user_email || 'Automated'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="w-[120px]">
                        <Badge className={getRoleBadgeColor(log.user_role)}>
                          {log.user_role ? formatRole(log.user_role) : 'System'}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[160px]">
                        {log.target_user_name ? (
                          <div className="flex flex-col">
                            <span className="text-sm truncate">{log.target_user_name}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {log.target_user_email}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="w-[120px]">
                        <Badge className={getActionBadgeColor(log.action)}>
                          {formatAction(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[120px]">
                        <Badge variant="outline">
                          {formatEntity(log.entity_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm truncate block max-w-[400px]" title={log.description || ''}>
                          {log.description || 'No description'}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};
