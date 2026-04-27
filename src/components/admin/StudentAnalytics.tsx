import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Play, CheckCircle, Clock, FileText, Target, TrendingUp, Users, Video, ChevronLeft, ChevronRight, Search, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { PaymentReports } from './PaymentReports';
interface StudentAnalytics {
  id: string;
  full_name: string;
  email: string;
  status: string;
  enrollment_date: string;
  videos_watched: number;
  videos_total: number;
  assignments_completed: number;
  assignments_total: number;
  last_activity: string;
  progress_percentage: number;
  current_module?: string;
}
interface OverviewStats {
  total_students: number;
  active_students: number;
  avg_progress: number;
  total_completions: number;
  videos_watched_today: number;
  assignments_submitted_today: number;
}
interface StudentAnalyticsProps {
  hidePayments?: boolean;
}

export const StudentAnalytics = ({ hidePayments = false }: StudentAnalyticsProps) => {
  const [students, setStudents] = useState<StudentAnalytics[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'engagement' | 'payments' | string>('overview');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [overviewStats, setOverviewStats] = useState<OverviewStats>({
    total_students: 0,
    active_students: 0,
    avg_progress: 0,
    total_completions: 0,
    videos_watched_today: 0,
    assignments_submitted_today: 0
  });
  const [loading, setLoading] = useState(true);
  
  // Filter students based on search term
  const filteredStudents = students.filter(student => 
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const studentsPerPage = 12;
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const startIndex = (currentPage - 1) * studentsPerPage;
  const endIndex = startIndex + studentsPerPage;
  const currentStudents = filteredStudents.slice(startIndex, endIndex);
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchAnalyticsData();
  }, []);
  
  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);

      // Fetch students with their progress data
      const {
        data: studentsData,
        error: studentsError
      } = await supabase.from('users').select(`
          id,
          full_name,
          email,
          status,
          created_at,
          last_active_at,
          students!inner(
            enrollment_date,
            onboarding_completed
          )
        `).eq('role', 'student');
      if (studentsError) throw studentsError;

      // Fetch recording views for each student
      const {
        data: recordingViews,
        error: viewsError
      } = await supabase.from('recording_views').select('user_id, recording_id, watched, watched_at');
      if (viewsError) throw viewsError;

      // Fetch total available recordings
      const {
        data: totalRecordings,
        error: recordingsError
      } = await supabase.from('available_lessons').select('id');
      if (recordingsError) throw recordingsError;

      // Fetch assignments data
      const {
        data: assignments,
        error: assignmentsError
      } = await supabase.from('assignments').select('id');
      if (assignmentsError) throw assignmentsError;

      // Fetch submissions for each student
      const {
        data: submissions,
        error: submissionsError
      } = await supabase.from('submissions').select('student_id, assignment_id, status, submitted_at');
      if (submissionsError) throw submissionsError;

      // Fetch recent activity
      const {
        data: recentActivity,
        error: activityError
      } = await supabase.from('user_activity_logs').select('user_id, created_at').order('created_at', {
        ascending: false
      });
      if (activityError) throw activityError;

      // Process student analytics
      const processedStudents = studentsData?.map(student => {
        const studentViews = recordingViews?.filter(view => view.user_id === student.id) || [];
        const watchedVideos = studentViews.filter(view => view.watched).length;
        const studentSubmissions = submissions?.filter(sub => sub.student_id === student.id) || [];
        const completedAssignments = studentSubmissions.filter(sub => sub.status === 'approved').length;
        const lastActivity = recentActivity?.find(activity => activity.user_id === student.id);
        const progress = Math.round((watchedVideos / (totalRecordings?.length || 1) * 0.6 + completedAssignments / (assignments?.length || 1) * 0.4) * 100);
        return {
          id: student.id,
          full_name: student.full_name || 'Unknown',
          email: student.email || '',
          status: student.status || 'active',
          enrollment_date: student.students?.[0]?.enrollment_date || student.created_at,
          videos_watched: watchedVideos,
          videos_total: totalRecordings?.length || 0,
          assignments_completed: completedAssignments,
          assignments_total: assignments?.length || 0,
          last_activity: student.last_active_at || lastActivity?.created_at || '',
          progress_percentage: progress,
          current_module: 'Module 1' // This would need proper module tracking
        };
      }) || [];

      // Calculate overview stats
      const today = new Date().toISOString().split('T')[0];
      const todayViews = recordingViews?.filter(view => view.watched_at && view.watched_at.startsWith(today)).length || 0;
      const todaySubmissions = submissions?.filter(sub => sub.submitted_at && sub.submitted_at.startsWith(today)).length || 0;
      const stats: OverviewStats = {
        total_students: processedStudents.length,
        active_students: processedStudents.filter(s => s.status === 'active').length,
        avg_progress: Math.round(processedStudents.reduce((acc, s) => acc + s.progress_percentage, 0) / processedStudents.length) || 0,
        total_completions: processedStudents.filter(s => s.progress_percentage >= 100).length,
        videos_watched_today: todayViews,
        assignments_submitted_today: todaySubmissions
      };
      setStudents(processedStudents);
      setOverviewStats(stats);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load student analytics",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>)}
          </div>
        </div>
      </div>;
  }
  return <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Student Analytics</h1>
        <p className="text-gray-600 mt-2">Comprehensive overview of student progress and engagement</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          {!hidePayments && (
            <TabsTrigger value="payments" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Payments
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 via-blue-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  Total Students
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-blue-600 mb-1">{overviewStats.total_students}</div>
                <p className="text-sm text-blue-500 font-medium">All enrolled</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 via-green-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  Active Students
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-green-600 mb-1">{overviewStats.active_students}</div>
                <p className="text-sm text-green-500 font-medium">Last 30 days</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 via-purple-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="w-4 h-4 text-purple-600" />
                  </div>
                  Avg Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-purple-600 mb-1">{overviewStats.avg_progress}%</div>
                <p className="text-sm text-purple-500 font-medium">Overall completion</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-emerald-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  Completions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-emerald-600 mb-1">{overviewStats.total_completions}</div>
                <p className="text-sm text-emerald-500 font-medium">Finished courses</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 via-orange-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Video className="w-4 h-4 text-orange-600" />
                  </div>
                  Videos Today
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-orange-600 mb-1">{overviewStats.videos_watched_today}</div>
                <p className="text-sm text-orange-500 font-medium">Views today</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 via-indigo-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  Submissions Today
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-indigo-600 mb-1">{overviewStats.assignments_submitted_today}</div>
                <p className="text-sm text-indigo-500 font-medium">New submissions</p>
              </CardContent>
            </Card>
          </div>

          {/* Search Filter */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredStudents.length)} of {filteredStudents.length} students
              {searchTerm && ` (filtered from ${students.length} total)`}
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentStudents.map(student => <Card key={student.id} className="shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-0 bg-gradient-to-br from-white to-gray-50">
                <CardHeader className="pb-4">
                  <div className="flex items-center space-x-4">
                    <Avatar className="w-12 h-12 ring-2 ring-blue-100">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-blue-600 text-white font-semibold">
                        {student.full_name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold text-gray-900 truncate">
                        {student.full_name}
                      </CardTitle>
                      <p className="text-sm text-gray-500 truncate">{student.email}</p>
                    </div>
                    <Badge variant={student.status === 'active' ? 'default' : 'secondary'} className={student.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600'}>
                      {student.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium text-gray-700">Overall Progress</span>
                      <span className="text-sm font-bold text-gray-900">{student.progress_percentage}%</span>
                    </div>
                    <Progress value={student.progress_percentage} className="h-3 bg-gray-200" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="p-1 bg-blue-200 rounded">
                          <Play className="w-3 h-3 text-blue-600" />
                        </div>
                        <span className="text-xs font-medium text-blue-700">Videos</span>
                      </div>
                      <div className="text-sm font-bold text-blue-800">
                        {student.videos_watched}/{student.videos_total}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                      <div className="flex items-center space-x-2 mb-1">
                        <div className="p-1 bg-green-200 rounded">
                          <FileText className="w-3 h-3 text-green-600" />
                        </div>
                        <span className="text-xs font-medium text-green-700">Assignments</span>
                      </div>
                      <div className="text-sm font-bold text-green-800">
                        {student.assignments_completed}/{student.assignments_total}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">Last active</span>
                    </div>
                    <span className="text-xs font-medium text-gray-700">
                      {student.last_activity && !isNaN(new Date(student.last_activity).getTime())
                        ? new Date(student.last_activity).toLocaleDateString()
                        : 'Never'}
                    </span>
                  </div>
                </CardContent>
              </Card>)}
          </div>
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-6">
              <p className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} ({filteredStudents.length} students)
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                {(() => {
                  const pages: (number | string)[] = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (currentPage > 3) pages.push('...');
                    const start = Math.max(2, currentPage - 1);
                    const end = Math.min(totalPages - 1, currentPage + 1);
                    for (let i = start; i <= end; i++) pages.push(i);
                    if (currentPage < totalPages - 2) pages.push('...');
                    pages.push(totalPages);
                  }
                  return pages.map((page, idx) =>
                    typeof page === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">…</span>
                    ) : (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-8 h-8 p-0"
                      >
                        {page}
                      </Button>
                    )
                  );
                })()}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Detailed Progress Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {students.map(student => <div key={student.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-medium">{student.full_name}</div>
                      <div className="text-sm text-gray-500">
                        Videos: {student.videos_watched}/{student.videos_total} | 
                        Assignments: {student.assignments_completed}/{student.assignments_total}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">{student.progress_percentage}%</div>
                      <Progress value={student.progress_percentage} className="w-20 h-2" />
                    </div>
                  </div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <Card className="border-l-4 border-l-blue-500 bg-gradient-to-br from-blue-50 via-blue-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-blue-700 flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  Total Students
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-blue-600 mb-1">{overviewStats.total_students}</div>
                <p className="text-sm text-blue-500 font-medium">All enrolled</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 bg-gradient-to-br from-green-50 via-green-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                  </div>
                  Active Students
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-green-600 mb-1">{overviewStats.active_students}</div>
                <p className="text-sm text-green-500 font-medium">Last 30 days</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 bg-gradient-to-br from-purple-50 via-purple-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="w-4 h-4 text-purple-600" />
                  </div>
                  Avg Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-purple-600 mb-1">{overviewStats.avg_progress}%</div>
                <p className="text-sm text-purple-500 font-medium">Overall completion</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-gradient-to-br from-emerald-50 via-emerald-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  Completions
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-emerald-600 mb-1">{overviewStats.total_completions}</div>
                <p className="text-sm text-emerald-500 font-medium">Finished courses</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500 bg-gradient-to-br from-orange-50 via-orange-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-orange-700 flex items-center gap-2">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Video className="w-4 h-4 text-orange-600" />
                  </div>
                  Videos Today
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-orange-600 mb-1">{overviewStats.videos_watched_today}</div>
                <p className="text-sm text-orange-500 font-medium">Views today</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-br from-indigo-50 via-indigo-25 to-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-indigo-700 flex items-center gap-2">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <FileText className="w-4 h-4 text-indigo-600" />
                  </div>
                  Submissions Today
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="text-4xl font-bold text-indigo-600 mb-1">{overviewStats.assignments_submitted_today}</div>
                <p className="text-sm text-indigo-500 font-medium">New submissions</p>
              </CardContent>
            </Card>
          </div>

          {/* Search Filter */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search students by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Most Active Students</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredStudents.sort((a, b) => {
                    const dateA = a.last_activity ? new Date(a.last_activity).getTime() : 0;
                    const dateB = b.last_activity ? new Date(b.last_activity).getTime() : 0;
                    return dateB - dateA;
                  }).slice(0, 5).map((student, index) => <div key={student.id} className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{student.full_name}</div>
                          <div className="text-xs text-gray-500">
                            {student.last_activity && !isNaN(new Date(student.last_activity).getTime())
                              ? new Date(student.last_activity).toLocaleDateString()
                              : 'Never'}
                          </div>
                        </div>
                        <Badge variant="outline">{student.progress_percentage}%</Badge>
                      </div>)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Completion Leaders</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredStudents.sort((a, b) => b.progress_percentage - a.progress_percentage).slice(0, 5).map((student, index) => <div key={student.id} className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-sm font-bold">
                          {index + 1}
                        </div>
                        <Avatar className="w-8 h-8">
                          <AvatarFallback>{student.full_name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{student.full_name}</div>
                          <div className="text-xs text-gray-500">
                            {student.videos_watched} videos, {student.assignments_completed} assignments
                          </div>
                        </div>
                        <Badge variant={student.progress_percentage >= 100 ? "default" : "secondary"}>
                          {student.progress_percentage}%
                        </Badge>
                      </div>)}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <PaymentReports />
        </TabsContent>
      </Tabs>
    </div>;
};