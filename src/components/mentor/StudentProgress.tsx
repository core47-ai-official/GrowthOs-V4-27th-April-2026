import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Users, Search, TrendingUp, Clock, CheckCircle, AlertCircle, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';

interface StudentProgressData {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  videosWatched: number;
  totalVideos: number;
  assignmentsCompleted: number;
  totalAssignments: number;
  lastActivity: string | null;
  progressPercentage: number;
  status: 'active' | 'inactive' | 'at-risk';
}

interface StudentProgressProps {
  students?: any[];
}

export const StudentProgress = ({ students: propStudents }: StudentProgressProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [studentsProgress, setStudentsProgress] = useState<StudentProgressData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'at-risk'>('all');

  useEffect(() => {
    if (user?.id) {
      fetchStudentProgress();
    }
  }, [user?.id]);

  const fetchStudentProgress = async () => {
    if (!user?.id) return;

    try {
      // Get mentor's assigned students
      const { data: mentorAssignments } = await supabase
        .from('mentor_course_assignments')
        .select('course_id, is_global')
        .eq('mentor_id', user.id);

      const isGlobal = mentorAssignments?.some(a => a.is_global);
      const courseIds = mentorAssignments?.map(a => a.course_id).filter(Boolean) || [];

      // Get students based on mentor access
      let studentsQuery = supabase
        .from('students')
        .select('id, user_id, created_at');

      if (!isGlobal && courseIds.length > 0) {
        // Filter by course enrollments
        const { data: enrollments } = await supabase
          .from('course_enrollments')
          .select('student_id')
          .in('course_id', courseIds);
        
        const studentIds = [...new Set(enrollments?.map(e => e.student_id) || [])];
        if (studentIds.length > 0) {
          studentsQuery = studentsQuery.in('id', studentIds);
        }
      }

      const { data: studentsData } = await studentsQuery;

      if (!studentsData?.length) {
        setStudentsProgress([]);
        setLoading(false);
        return;
      }

      // Get user info for students
      const userIds = studentsData.map(s => s.user_id);
      const { data: usersData } = await supabase
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);

      const userMap = new Map((usersData || []).map(u => [u.id, u]));

      // Get video watch counts
      const { data: watchData } = await supabase
        .from('recording_views')
        .select('user_id, watched')
        .in('user_id', userIds)
        .eq('watched', true);

      const watchCountMap = new Map<string, number>();
      (watchData || []).forEach(w => {
        watchCountMap.set(w.user_id, (watchCountMap.get(w.user_id) || 0) + 1);
      });

      // Get total videos
      const { count: totalVideos } = await supabase
        .from('available_lessons')
        .select('id', { count: 'exact', head: true });

      // Get submissions count per user
      const { data: submissionsData } = await supabase
        .from('submissions')
        .select('student_id, status')
        .in('student_id', userIds);

      const approvedSubmissions = new Map<string, number>();
      (submissionsData || []).forEach(s => {
        if (s.status === 'approved') {
          approvedSubmissions.set(s.student_id, (approvedSubmissions.get(s.student_id) || 0) + 1);
        }
      });

      // Get total assignments
      const { count: totalAssignments } = await supabase
        .from('assignments')
        .select('id', { count: 'exact', head: true });

      // Get last activity per user
      const { data: lastActivityData } = await supabase
        .from('recording_views')
        .select('user_id, watched_at')
        .in('user_id', userIds)
        .order('watched_at', { ascending: false });

      const lastActivityMap = new Map<string, string>();
      (lastActivityData || []).forEach(a => {
        if (!lastActivityMap.has(a.user_id)) {
          lastActivityMap.set(a.user_id, a.watched_at);
        }
      });

      // Build progress data
      const progressData: StudentProgressData[] = studentsData.map(student => {
        const userInfo = userMap.get(student.user_id);
        const videosWatched = watchCountMap.get(student.user_id) || 0;
        const assignmentsCompleted = approvedSubmissions.get(student.user_id) || 0;
        const lastActivity = lastActivityMap.get(student.user_id) || null;

        const totalProgress = (totalVideos || 0) + (totalAssignments || 0);
        const completedProgress = videosWatched + assignmentsCompleted;
        const progressPercentage = totalProgress > 0 
          ? Math.round((completedProgress / totalProgress) * 100) 
          : 0;

        // Determine status based on last activity
        let status: 'active' | 'inactive' | 'at-risk' = 'active';
        if (lastActivity) {
          const daysSinceActivity = Math.floor(
            (new Date().getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysSinceActivity > 14) {
            status = 'inactive';
          } else if (daysSinceActivity > 7) {
            status = 'at-risk';
          }
        } else {
          status = 'inactive';
        }

        return {
          id: student.id,
          user_id: student.user_id,
          full_name: userInfo?.full_name || 'Unknown',
          email: userInfo?.email || '',
          videosWatched,
          totalVideos: totalVideos || 0,
          assignmentsCompleted,
          totalAssignments: totalAssignments || 0,
          lastActivity,
          progressPercentage,
          status
        };
      });

      // Sort by progress (descending)
      progressData.sort((a, b) => b.progressPercentage - a.progressPercentage);
      setStudentsProgress(progressData);

    } catch (error) {
      logger.error('Error fetching student progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: 'active' | 'inactive' | 'at-risk') => {
    const config = {
      active: { color: 'bg-green-500', icon: CheckCircle, label: 'Active' },
      'at-risk': { color: 'bg-yellow-500', icon: AlertCircle, label: 'At Risk' },
      inactive: { color: 'bg-red-500', icon: Clock, label: 'Inactive' }
    };
    const { color, icon: Icon, label } = config[status];
    return (
      <Badge className={`${color} text-white`}>
        <Icon className="w-3 h-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const filteredStudents = studentsProgress.filter(student => {
    const matchesSearch = 
      student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || student.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: studentsProgress.length,
    active: studentsProgress.filter(s => s.status === 'active').length,
    atRisk: studentsProgress.filter(s => s.status === 'at-risk').length,
    inactive: studentsProgress.filter(s => s.status === 'inactive').length
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Student Progress
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
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Students</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">At Risk</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.atRisk}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
              </div>
              <Clock className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Progress Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Student Progress Details
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              <div className="flex gap-1">
                {(['all', 'active', 'at-risk', 'inactive'] as const).map(status => (
                  <Button
                    key={status}
                    variant={statusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setStatusFilter(status)}
                  >
                    {status === 'all' ? 'All' : status === 'at-risk' ? 'At Risk' : status.charAt(0).toUpperCase() + status.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No students found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Videos</TableHead>
                  <TableHead>Assignments</TableHead>
                  <TableHead>Overall Progress</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{student.full_name}</span>
                        <span className="text-xs text-muted-foreground">{student.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(student.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{student.videosWatched}/{student.totalVideos}</span>
                        <Progress 
                          value={student.totalVideos > 0 ? (student.videosWatched / student.totalVideos) * 100 : 0} 
                          className="w-16 h-2"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{student.assignmentsCompleted}/{student.totalAssignments}</span>
                        <Progress 
                          value={student.totalAssignments > 0 ? (student.assignmentsCompleted / student.totalAssignments) * 100 : 0} 
                          className="w-16 h-2"
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{student.progressPercentage}%</span>
                        <Progress value={student.progressPercentage} className="w-20 h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      {student.lastActivity ? (
                        <span className="text-sm text-muted-foreground">
                          {new Date(student.lastActivity).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => navigate(`/mentor/students/${student.id}`)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
