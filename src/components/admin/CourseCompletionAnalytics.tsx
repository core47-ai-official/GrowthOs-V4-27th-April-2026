import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BookOpen, Users, TrendingUp, Award } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { RecoveryManagement } from './RecoveryManagement';
import { useRecoveryRate } from '@/hooks/useRecoveryRate';

export const CourseCompletionAnalytics = () => {
  const { data: recoveryStats, isLoading: recoveryLoading } = useRecoveryRate();
  const { data: completionData, isLoading } = useQuery({
    queryKey: ['course-completion-analytics'],
    queryFn: async () => {
      // Get all active students
      const { data: students, error: studentsError } = await supabase
        .from('users')
        .select('id, status, created_at')
        .eq('role', 'student')
        .neq('status', 'inactive');

      if (studentsError) {
        console.error('Error fetching students:', studentsError);
        throw studentsError;
      }

      const totalStudents = students?.length || 0;
      const completedStudents = students?.filter(s => s.status === 'Passed out / Completed').length || 0;

      // Get students with recording views to determine progress
      const { data: recordingViews, error: viewsError } = await supabase
        .from('recording_views')
        .select('user_id, watched');

      if (viewsError) {
        console.error('Error fetching recording views:', viewsError);
        throw viewsError;
      }

      // Get total number of available lessons
      const { data: lessons, error: lessonsError } = await supabase
        .from('available_lessons')
        .select('id');

      if (lessonsError) {
        console.error('Error fetching lessons:', lessonsError);
        throw lessonsError;
      }

      const totalLessons = lessons?.length || 0;

      // Calculate progress for each student
      const studentProgress = students?.map(student => {
        const studentViews = recordingViews?.filter(rv => rv.user_id === student.id) || [];
        const watchedCount = studentViews.filter(rv => rv.watched).length;
        const progressPercentage = totalLessons > 0 ? (watchedCount / totalLessons) * 100 : 0;
        
        return {
          studentId: student.id,
          status: student.status,
          progressPercentage,
          enrollmentDate: student.created_at
        };
      }) || [];

      // Categorize students
      const inProgressStudents = studentProgress.filter(sp => 
        sp.status !== 'Passed out / Completed' && sp.progressPercentage > 0 && sp.progressPercentage < 100
      ).length;

      const notStartedStudents = studentProgress.filter(sp => 
        sp.status !== 'Passed out / Completed' && sp.progressPercentage === 0
      ).length;

      const studentsNearCompletion = studentProgress.filter(sp => 
        sp.status !== 'Passed out / Completed' && sp.progressPercentage >= 80
      ).length;

      // Calculate average completion time (simplified estimate)
      const completedStudentData = studentProgress.filter(sp => sp.status === 'Passed out / Completed');
      const averageCompletionTime = completedStudentData.length > 0 ? 30 : 0; // Placeholder

      const completionRate = totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0;

      return {
        totalStudents,
        completedStudents,
        inProgressStudents,
        notStartedStudents,
        averageCompletionTime,
        studentsNearCompletion,
        completionRate
      };
    },
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-6 w-6 text-primary" />
        <h2 className="text-2xl font-bold">Course Completion & Recovery Analytics</h2>
      </div>

      <Tabs defaultValue="completion" className="w-full">
        <TabsList>
          <TabsTrigger value="completion">Course Completion</TabsTrigger>
          <TabsTrigger value="recovery">Student Recovery</TabsTrigger>
        </TabsList>
        
        <TabsContent value="completion" className="space-y-6">
          {/* Main Completion Rate Card */}
          <Card className="border-l-4 border-l-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Overall Course Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary mb-2">
                {completionData?.completionRate?.toFixed(1) || 0}%
              </div>
              <div className="text-sm text-muted-foreground mb-4">
                {completionData?.completedStudents || 0} out of {completionData?.totalStudents || 0} students completed the course
              </div>
              <Progress value={completionData?.completionRate || 0} className="h-3" />
            </CardContent>
          </Card>

          {/* Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionData?.completionRate?.toFixed(1) || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  Students who completed the course
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {recoveryLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <>
                    <div className="text-2xl font-bold">{recoveryStats?.recovery_rate || 0}%</div>
                    <p className="text-xs text-muted-foreground">
                      {recoveryStats?.successful_recoveries || 0} of {recoveryStats?.total_messages_sent || 0} messages
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Near Completion</CardTitle>
                <Award className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionData?.studentsNearCompletion || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Students at 80%+ progress
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completionData?.totalStudents || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Currently enrolled students
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Distribution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{completionData?.completedStudents || 0}</div>
                <p className="text-xs text-muted-foreground">Students finished course</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">{completionData?.inProgressStudents || 0}</div>
                <p className="text-xs text-muted-foreground">Students actively learning</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-gray-500">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Not Started</CardTitle>
                <Users className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-700">{completionData?.notStartedStudents || 0}</div>
                <p className="text-xs text-muted-foreground">Haven't begun course</p>
              </CardContent>
            </Card>
          </div>

          {/* Progress Funnel */}
          <Card>
            <CardHeader>
              <CardTitle>Course Progress Funnel</CardTitle>
              <CardDescription>Track students through their learning journey</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Enrolled Students</span>
                  <Badge variant="outline">{completionData?.totalStudents || 0}</Badge>
                </div>
                <Progress value={100} className="h-2" />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Started Course</span>
                  <Badge variant="outline">
                    {(completionData?.inProgressStudents || 0) + (completionData?.completedStudents || 0)}
                  </Badge>
                </div>
                <Progress 
                  value={completionData?.totalStudents ? 
                    (((completionData.inProgressStudents + completionData.completedStudents) / completionData.totalStudents) * 100) : 0
                  } 
                  className="h-2" 
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Near Completion (80%+)</span>
                  <Badge variant="outline">
                    {(completionData?.studentsNearCompletion || 0) + (completionData?.completedStudents || 0)}
                  </Badge>
                </div>
                <Progress 
                  value={completionData?.totalStudents ? 
                    (((completionData.studentsNearCompletion + completionData.completedStudents) / completionData.totalStudents) * 100) : 0
                  } 
                  className="h-2" 
                />
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Completed Course</span>
                  <Badge variant="outline">{completionData?.completedStudents || 0}</Badge>
                </div>
                <Progress value={completionData?.completionRate || 0} className="h-2" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recovery">
          <RecoveryManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
};