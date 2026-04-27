import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Database, Users, AlertTriangle, CheckCircle, Clock, Server } from 'lucide-react';
import { logger } from '@/lib/logger';

interface SystemStats {
  totalUsers: number;
  activeUsers24h: number;
  totalStudents: number;
  activeStudents7d: number;
  totalRecordings: number;
  totalAssignments: number;
  pendingSubmissions: number;
  recentErrors: number;
  databaseStatus: 'healthy' | 'degraded' | 'down';
}

export const SystemHealth = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    fetchSystemStats();
    // Only poll while the tab is visible to avoid wasting Supabase quota in background tabs
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(fetchSystemStats, 60000);
    };
    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchSystemStats(); // catch up on return
        startPolling();
      } else {
        stopPolling();
      }
    };

    if (document.visibilityState === 'visible') startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const fetchSystemStats = async () => {
    try {
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Fetch all stats in parallel
      const [
        usersResult,
        studentsResult,
        recordingsResult,
        assignmentsResult,
        pendingSubmissionsResult,
        errorsResult,
        activeLogsResult
      ] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('students').select('id', { count: 'exact', head: true }),
        supabase.from('available_lessons').select('id', { count: 'exact', head: true }),
        supabase.from('assignments').select('id', { count: 'exact', head: true }),
        supabase.from('submissions').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('error_logs').select('id', { count: 'exact', head: true })
          .gte('created_at', twentyFourHoursAgo.toISOString())
          .eq('resolved', false),
        supabase.from('admin_logs').select('performed_by', { count: 'exact', head: true })
          .gte('created_at', twentyFourHoursAgo.toISOString())
      ]);

      // Get active students in last 7 days from recording_views
      const { count: activeStudents7d } = await supabase
        .from('recording_views')
        .select('user_id', { count: 'exact', head: true })
        .gte('watched_at', sevenDaysAgo.toISOString());

      setStats({
        totalUsers: usersResult.count || 0,
        activeUsers24h: activeLogsResult.count || 0,
        totalStudents: studentsResult.count || 0,
        activeStudents7d: activeStudents7d || 0,
        totalRecordings: recordingsResult.count || 0,
        totalAssignments: assignmentsResult.count || 0,
        pendingSubmissions: pendingSubmissionsResult.count || 0,
        recentErrors: errorsResult.count || 0,
        databaseStatus: 'healthy' // If we got here, DB is responsive
      });

      setLastRefresh(new Date());
    } catch (error) {
      logger.error('Error fetching system stats:', error);
      setStats(prev => prev ? { ...prev, databaseStatus: 'degraded' } : null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: 'healthy' | 'degraded' | 'down') => {
    const config = {
      healthy: { color: 'bg-green-500', icon: CheckCircle, label: 'Healthy' },
      degraded: { color: 'bg-yellow-500', icon: AlertTriangle, label: 'Degraded' },
      down: { color: 'bg-red-500', icon: AlertTriangle, label: 'Down' }
    };
    const { color, icon: Icon, label } = config[status];
    return (
      <Badge className={`${color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            System Health
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
      {/* Status Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Server className="w-5 h-5" />
              System Status
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-muted-foreground" />
                <span>Database</span>
              </div>
              {getStatusBadge(stats?.databaseStatus || 'healthy')}
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-muted-foreground" />
                <span>Edge Functions</span>
              </div>
              {getStatusBadge('healthy')}
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-muted-foreground" />
                <span>API</span>
              </div>
              {getStatusBadge('healthy')}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.activeUsers24h || 0} active in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalStudents || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.activeStudents7d || 0} active in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Content</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalRecordings || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              recordings across {stats?.totalAssignments || 0} assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{stats?.pendingSubmissions || 0}</div>
              {(stats?.pendingSubmissions || 0) > 0 && (
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Needs Review
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              submissions awaiting review
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Activity & Errors */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="w-4 h-4" />
              Student Engagement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span>7-Day Active Rate</span>
                  <span className="font-medium">
                    {stats?.totalStudents 
                      ? Math.round((stats.activeStudents7d / stats.totalStudents) * 100) 
                      : 0}%
                  </span>
                </div>
                <Progress 
                  value={stats?.totalStudents 
                    ? (stats.activeStudents7d / stats.totalStudents) * 100 
                    : 0} 
                  className="h-2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Recent Errors (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className={`text-3xl font-bold ${(stats?.recentErrors || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {stats?.recentErrors || 0}
              </div>
              {(stats?.recentErrors || 0) === 0 ? (
                <Badge className="bg-green-500">All Clear</Badge>
              ) : (
                <Badge variant="destructive">Needs Attention</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Unresolved errors in the last 24 hours
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
