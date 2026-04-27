import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Download, Search, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  occurred_at: string;
  metadata: any;
  reference_id: string | null;
  description?: string;
  entity_type?: string;
  users: {
    email: string;
    full_name: string;
    role: string;
  } | null;
}

export const ActivityLogs = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [dateRange, setDateRange] = useState('7days');
  const { toast } = useToast();

  useEffect(() => {
    fetchLogs();
  }, [dateRange, roleFilter, activityFilter]);

  const fetchLogs = async () => {
    try {
      let query = supabase
        .from('admin_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      // Apply date filter
      if (dateRange !== 'all') {
        const days = parseInt(dateRange.replace('days', ''));
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        query = query.gte('created_at', startDate.toISOString());
      }

      // Apply role filter
      if (roleFilter !== 'all') {
        // This would need a join or separate query in production
      }

      // Apply activity filter
      if (activityFilter !== 'all') {
        query = query.eq('action', activityFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch user details for each log separately
      const logsWithUsers = await Promise.all((data || []).map(async (log) => {
        let userData = null;
        if (log.performed_by) {
          const { data: user } = await supabase
            .from('users')
            .select('email, full_name, role')
            .eq('id', log.performed_by)
            .maybeSingle();
          userData = user;
        }
        return { 
          ...log, 
          users: userData,
          activity_type: log.action,
          occurred_at: log.created_at,
          user_id: log.performed_by,
          metadata: log.data,
          description: log.description,
          entity_type: log.entity_type,
          reference_id: log.entity_id
        };
      }));
      
      setLogs(logsWithUsers);
    } catch (error) {
      console.error('Error fetching activity logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch activity logs',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const formatRoleLabel = (role: string): string => {
    const roleLabels: Record<string, string> = {
      superadmin: 'Super Admin',
      admin: 'Admin',
      mentor: 'Mentor',
      student: 'Student',
      enrollment_manager: 'Enrollment Manager',
      support_member: 'Support Member'
    };
    return roleLabels[role] || role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ');
  };

  const formatActivityLabel = (activity: string): string => {
    const activityLabels: Record<string, string> = {
      created: 'Created',
      updated: 'Updated',
      deleted: 'Deleted',
      login: 'Login',
      logout: 'Logout',
      video_watched: 'Video Watched',
      assignment_submitted: 'Assignment Submitted',
      profile_updated: 'Profile Updated',
      page_visit: 'Page Visit',
      cascade_deleted: 'Cascade Deleted',
      password_access_attempt: 'Password Access Attempt'
    };
    return activityLabels[activity] || activity.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatEntityLabel = (entity: string): string => {
    const entityLabels: Record<string, string> = {
      user: 'User',
      invoice: 'Invoice',
      student: 'Student',
      notification_template: 'Notification Template',
      data_access: 'Data Access',
      integration: 'Integration'
    };
    return entityLabels[entity] || entity.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const formatLogDetails = (log: ActivityLog) => {
    if (log.description) {
      return log.description;
    }
    
    if (log.metadata) {
      const data = log.metadata;
      const keyDetails = [];
      
      // Status changes
      if (data.status_old !== undefined && data.status_new !== undefined) {
        keyDetails.push(`Status changed from "${data.status_old || 'none'}" to "${data.status_new || 'none'}"`);
      }
      if (data.lms_status_old !== undefined && data.lms_status_new !== undefined) {
        keyDetails.push(`LMS status changed from "${data.lms_status_old || 'none'}" to "${data.lms_status_new || 'none'}"`);
      }
      
      // Invoice related
      if (data.amount) {
        keyDetails.push(`Amount: PKR ${data.amount.toLocaleString()}`);
      }
      if (data.installment_number) {
        keyDetails.push(`Installment #${data.installment_number}`);
      }
      if (data.due_date) {
        keyDetails.push(`Due: ${new Date(data.due_date).toLocaleDateString()}`);
      }
      if (data.paid_at) {
        keyDetails.push(`Paid: ${new Date(data.paid_at).toLocaleDateString()}`);
      }
      
      // User related
      if (data.email) {
        keyDetails.push(`Email: ${data.email}`);
      }
      if (data.full_name) {
        keyDetails.push(`Name: ${data.full_name}`);
      }
      
      return keyDetails.length > 0 ? keyDetails.join(' • ') : 'Action performed';
    }
    
    return 'No details available';
  };

  const exportLogs = async () => {
    try {
      const csvContent = [
        ['Date', 'User', 'Name', 'Role', 'Activity', 'Details'].join(','),
        ...filteredLogs.map(log => [
          new Date(log.occurred_at).toISOString(),
          log.users?.email || 'System',
          log.users?.full_name || 'System',
          log.users?.role || 'System',
          log.activity_type,
          formatLogDetails(log)
        ].join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Success',
        description: 'Activity logs exported successfully'
      });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to export logs',
        variant: 'destructive'
      });
    }
  };

  const getActivityBadge = (activity: string) => {
    const activityColors = {
      login: 'bg-blue-500',
      logout: 'bg-gray-500',
      video_watched: 'bg-green-500',
      assignment_submitted: 'bg-purple-500',
      profile_updated: 'bg-yellow-500',
      page_visit: 'bg-cyan-500'
    };
    return activityColors[activity as keyof typeof activityColors] || 'bg-gray-500';
  };

  const getRoleBadge = (role: string) => {
    const roleColors = {
      student: 'bg-blue-500',
      mentor: 'bg-green-500',
      admin: 'bg-purple-500',
      superadmin: 'bg-red-500'
    };
    return roleColors[role as keyof typeof roleColors] || 'bg-gray-500';
  };

  const getEntityBadgeColor = (entityType?: string) => {
    const colors = {
      user: 'bg-blue-500',
      invoice: 'bg-green-500',
      student: 'bg-purple-500',
      notification_template: 'bg-yellow-500',
      data_access: 'bg-red-500'
    };
    return colors[entityType as keyof typeof colors] || 'bg-gray-500';
  };

  const filteredLogs = logs.filter(log => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      log.users?.email?.toLowerCase().includes(searchLower) ||
      log.users?.full_name?.toLowerCase().includes(searchLower) ||
      log.activity_type.toLowerCase().includes(searchLower) ||
      log.description?.toLowerCase().includes(searchLower) ||
      (!log.users && 'system'.includes(searchLower));
    const matchesRole = roleFilter === 'all' || log.users?.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading activity logs...</div>;
  }

  return (
    <Card className="h-[80vh] flex flex-col">
      <CardHeader className="flex-shrink-0 border-b">
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Activity Logs
          </CardTitle>
          <Button onClick={exportLogs} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 min-h-0">
        {/* Fixed Filters */}
        <div className="flex-shrink-0 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
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
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="student">Students</SelectItem>
                <SelectItem value="mentor">Mentors</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="superadmin">Superadmins</SelectItem>
              </SelectContent>
            </Select>

            <Select value={activityFilter} onValueChange={setActivityFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activities</SelectItem>
                <SelectItem value="login">Login</SelectItem>
                <SelectItem value="logout">Logout</SelectItem>
                <SelectItem value="video_watched">Video Watched</SelectItem>
                <SelectItem value="assignment_submitted">Assignment Submitted</SelectItem>
                <SelectItem value="profile_updated">Profile Updated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm text-muted-foreground">
            Showing {filteredLogs.length} of {logs.length} activities
          </div>
        </div>

        {/* Scrollable Activity Logs Table */}
        <div className="flex-1 flex flex-col border rounded-md overflow-hidden min-h-0">
          {/* Fixed Table Header */}
          <div className="flex-shrink-0 border-b bg-muted/50">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-0">
                  <TableHead className="font-medium h-12 w-[180px]">Timestamp</TableHead>
                  <TableHead className="font-medium h-12">User</TableHead>
                  <TableHead className="font-medium h-12">Name</TableHead>
                  <TableHead className="font-medium h-12 w-[120px]">Role</TableHead>
                  <TableHead className="font-medium h-12 w-[120px]">Entity</TableHead>
                  <TableHead className="font-medium h-12 w-[140px]">Activity</TableHead>
                  <TableHead className="font-medium h-12">Details</TableHead>
                  <TableHead className="font-medium h-12 w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
            </Table>
          </div>

          {/* Scrollable Table Body */}
          <ScrollArea className="flex-1">
            <Table>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="whitespace-nowrap font-mono text-sm w-[180px]">
                      {new Date(log.occurred_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {log.users ? (
                        log.users.email
                      ) : (
                        <span className="text-muted-foreground italic">System Action</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate">
                      {log.users?.full_name || (
                        <span className="text-muted-foreground italic">System</span>
                      )}
                    </TableCell>
                    <TableCell className="w-[120px]">
                      {log.users ? (
                        <Badge className={getRoleBadge(log.users.role)}>
                          {formatRoleLabel(log.users.role)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-muted">
                          System
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-[120px]">
                      {log.entity_type && (
                        <Badge variant="outline" className={getEntityBadgeColor(log.entity_type)}>
                          {formatEntityLabel(log.entity_type)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="w-[140px]">
                      <Badge className={getActivityBadge(log.activity_type)}>
                        {formatActivityLabel(log.activity_type)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[400px]">
                      <div className="text-sm truncate" title={formatLogDetails(log)}>
                        {formatLogDetails(log)}
                      </div>
                    </TableCell>
                    <TableCell className="w-[80px]">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Activity Log Details</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Timestamp</h4>
                              <p className="text-sm font-mono">{new Date(log.occurred_at).toLocaleString()}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Performed By</h4>
                              <p className="text-sm">
                                {log.users ? (
                                  <>
                                    {log.users.full_name} ({log.users.email})
                                    <Badge className={`ml-2 ${getRoleBadge(log.users.role)}`}>
                                      {formatRoleLabel(log.users.role)}
                                    </Badge>
                                  </>
                                ) : (
                                  <>
                                    <span className="italic text-muted-foreground">Automated System Action</span>
                                    <Badge variant="secondary" className="ml-2 bg-muted">System</Badge>
                                  </>
                                )}
                              </p>
                            </div>
                            {log.entity_type && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Entity Type</h4>
                                <Badge variant="outline" className={getEntityBadgeColor(log.entity_type)}>
                                  {formatEntityLabel(log.entity_type)}
                                </Badge>
                              </div>
                            )}
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Activity</h4>
                              <Badge className={getActivityBadge(log.activity_type)}>
                                {formatActivityLabel(log.activity_type)}
                              </Badge>
                            </div>
                            {log.description && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Description</h4>
                                <p className="text-sm">{log.description}</p>
                              </div>
                            )}
                            {log.metadata && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Full Data</h4>
                                <pre className="text-xs bg-muted p-4 rounded-md overflow-x-auto">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No activity logs found matching your criteria.
              </div>
            )}
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};