import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Shield, Banknote, Activity, AlertTriangle, BookOpen, Video, FileText, GraduationCap } from 'lucide-react';
import { RoleGuard } from '@/components/RoleGuard';
import { useRecoveryRate } from '@/hooks/useRecoveryRate';
import { ModulesManagement } from '@/components/superadmin/ModulesManagement';
import { AtRiskStudents } from '@/components/admin/AtRiskStudents';
import { RecordingsManagement } from '@/components/superadmin/RecordingsManagement';
import { AssignmentManagement } from '@/components/assignments/AssignmentManagement';
import { StudentsManagement } from '@/components/superadmin/StudentsManagement';
import { SuccessSessionsManagement } from '@/components/superadmin/SuccessSessionsManagement';
import { SubmissionsManagement } from '@/components/assignments/SubmissionsManagement';
import { SupportManagement } from '@/components/superadmin/SupportManagement';
import { CompanySettings } from '@/components/superadmin/CompanySettings';
import { SequentialUnlockAdmin } from '@/components/admin/SequentialUnlockAdmin';
import { CourseCompletionAnalytics } from '@/components/admin/CourseCompletionAnalytics';
import { MilestoneManagement } from '@/components/admin/MilestoneManagement';
import { StudentAnalytics } from '@/components/admin/StudentAnalytics';
import { ErrorLogsManagement } from '@/components/superadmin/ErrorLogsManagement';
import { CourseManagement } from '@/components/superadmin/CourseManagement';
import { PathwayManagement } from '@/components/superadmin/PathwayManagement';
import { BatchManagement } from '@/components/batch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ENV_CONFIG } from '@/lib/env-config';
import { ContentScheduleCalendar } from '@/components/admin/ContentScheduleCalendar';
interface DashboardStats {
  totalAdmins: number;
  totalSuperadmins: number;
  totalMentors: number;
  totalStudents: number;
  activeStudents: number;
  studentsUsingLMS: number;
  courseCompletionRate: number;
  recoveryRate: number;
  totalRevenue: number;
  totalPaidInvoices: number;
}
export default function SuperadminDashboard() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const renderContent = () => {
    switch (activeTab) {
      case 'modules':
        return <ModulesManagement />;
      case 'recordings':
        return <RecordingsManagement />;
      case 'assignments':
        return <AssignmentManagement />;
      case 'success-sessions':
        return <SuccessSessionsManagement />;
      case 'students':
        return <StudentsManagement />;
      case 'at-risk':
        return <AtRiskStudents />;
      case 'submissions':
        return <SubmissionsManagement userRole="superadmin" />;
      case 'support':
        return <SupportManagement />;
      case 'company-settings':
        return <CompanySettings />;
      case 'sequential-unlock':
        return <SequentialUnlockAdmin />;
      case 'course-completion':
        return <CourseCompletionAnalytics />;
      case 'milestones':
        return <MilestoneManagement />;
      case 'analytics':
        return <StudentAnalytics />;
      case 'error-logs':
        return <ErrorLogsManagement />;
      case 'courses':
        return <CourseManagement />;
      case 'pathways':
        return <PathwayManagement />;
      case 'batches':
        return <BatchManagement />;
      default:
        return <DashboardContent />;
    }
  };
  return <RoleGuard allowedRoles={['superadmin']}>
      <div className="w-full max-w-none p-6 animate-fade-in px-0 py-0">
        {renderContent()}
      </div>
    </RoleGuard>;
}
function DashboardContent() {
  const navigate = useNavigate();
  const { data: recoveryStats, isLoading: recoveryLoading } = useRecoveryRate();
  const [stats, setStats] = useState<DashboardStats & { totalCourses: number }>({
    totalAdmins: 0,
    totalSuperadmins: 0,
    totalMentors: 0,
    totalStudents: 0,
    activeStudents: 0,
    studentsUsingLMS: 0,
    courseCompletionRate: 0,
    recoveryRate: 0,
    totalRevenue: 0,
    totalPaidInvoices: 0,
    totalCourses: 0
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchDashboardStats();
  }, []);
  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      // Fetch user counts by role
      const {
        data: userData,
        error: userError
      } = await supabase.from('users').select('role, lms_status, status');
      if (userError) {
        console.error('Error fetching user data:', userError);
        return;
      }

      // Fetch total courses
      const { data: courses } = await supabase.from('courses').select('id');

      // Count users by role
      const totalAdmins = userData?.filter(user => user.role === 'admin').length || 0;
      const totalSuperadmins = userData?.filter(user => user.role === 'superadmin').length || 0;
      const totalMentors = userData?.filter(user => user.role === 'mentor').length || 0;
      const totalStudents = userData?.filter(user => user.role === 'student').length || 0;

      // Count active students (status = 'Active')
      const activeStudents = userData?.filter(user => user.role === 'student' && user.status === 'Active').length || 0;

      // Count students using LMS (lms_status = 'active')
      const studentsUsingLMS = userData?.filter(user => user.role === 'student' && user.lms_status === 'active').length || 0;

      // Calculate actual course completion rate (students who completed the course)
      const completedStudents = userData?.filter(user => 
        user.role === 'student' && user.status === 'Passed out / Completed'
      ).length || 0;
      
      const courseCompletionRate = activeStudents > 0 
        ? Math.round((completedStudents / activeStudents) * 100)
        : 0;

      // Use configurable recovery rate since performance_record table doesn't exist
      let recoveryRate = ENV_CONFIG.DEFAULT_RECOVERY_RATE;

      // Fetch revenue data from paid invoices
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('amount')
        .eq('status', 'paid');

      if (invoiceError) {
        console.error('Error fetching invoice data:', invoiceError);
      }

      const totalRevenue = invoiceData?.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0) || 0;
      const totalPaidInvoices = invoiceData?.length || 0;

      setStats({
        totalAdmins,
        totalSuperadmins,
        totalMentors,
        totalStudents,
        activeStudents,
        studentsUsingLMS,
        courseCompletionRate,
        recoveryRate,
        totalRevenue,
        totalPaidInvoices,
        totalCourses: courses?.length || 0
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };
  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading dashboard...</div>
      </div>;
  }
  return <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="animate-fade-in">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            🔧 System Command Center
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">Ultimate platform control and global oversight</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="border-l-4 border-l-red-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-red-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=students')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-red-800">Total Admins</CardTitle>
            <Shield className="h-5 w-5 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-900">{stats.totalAdmins}</div>
            <p className="text-xs text-muted-foreground">Platform administrators</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-purple-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-purple-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=students')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-purple-800">Superadmins</CardTitle>
            <Users className="h-5 w-5 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-900">{stats.totalSuperadmins}</div>
            <p className="text-xs text-muted-foreground">System superadmins</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-orange-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-orange-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=students')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-orange-800">Mentors</CardTitle>
            <Users className="h-5 w-5 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-900">{stats.totalMentors}</div>
            <p className="text-xs text-muted-foreground">Active mentors</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-blue-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-blue-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=students')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-800">Total Students</CardTitle>
            <Users className="h-5 w-5 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-900">{stats.totalStudents}</div>
            <p className="text-xs text-muted-foreground">All registered students</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card 
          className="border-l-4 border-l-green-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-green-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=courses')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-800">Total Courses</CardTitle>
            <GraduationCap className="h-5 w-5 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-900">{stats.totalCourses}</div>
            <p className="text-xs text-muted-foreground">Available courses</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-indigo-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-indigo-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=students')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-indigo-800">Students Using LMS</CardTitle>
            <Activity className="h-5 w-5 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-indigo-900">{stats.studentsUsingLMS}</div>
            <p className="text-xs text-muted-foreground">Students actively using LMS</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-cyan-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-cyan-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-cyan-800">Course Completion Rate</CardTitle>
            <Activity className="h-5 w-5 text-cyan-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-cyan-900">{stats.courseCompletionRate}%</div>
            <p className="text-xs text-muted-foreground">Active students who completed the course</p>
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-yellow-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-yellow-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800">Recovery Rate</CardTitle>
            <Activity className="h-5 w-5 text-yellow-600" />
          </CardHeader>
          <CardContent>
            {recoveryLoading ? (
              <div className="animate-pulse">
                <div className="h-8 bg-muted rounded w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded w-32"></div>
              </div>
            ) : (
              <>
                <div className="text-3xl font-bold text-yellow-900">{recoveryStats?.recovery_rate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {recoveryStats?.successful_recoveries || 0} of {recoveryStats?.total_messages_sent || 0} messages
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card 
          className="border-l-4 border-l-emerald-500 hover-scale transition-all duration-300 hover:shadow-lg bg-gradient-to-br from-emerald-50 to-white animate-fade-in cursor-pointer"
          onClick={() => navigate('/superadmin?tab=analytics')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-800">Revenue Till Now</CardTitle>
            <Banknote className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-900">PKR {stats.totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">{stats.totalPaidInvoices} paid invoices</p>
          </CardContent>
        </Card>
      </div>

      <ContentScheduleCalendar />
    </div>;
}