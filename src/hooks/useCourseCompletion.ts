import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';

interface StudentProgress {
  studentId: string;
  studentName: string;
  email: string;
  progressPercentage: number;
  videosWatched: number;
  totalVideos: number;
  assignmentsCompleted: number;
  totalAssignments: number;
  status: string;
  enrollmentDate: string;
  estimatedCompletionDate?: string;
}

interface CompletionStats {
  totalStudents: number;
  completedStudents: number;
  completionRate: number;
  averageProgress: number;
  studentsAtRisk: number;
}

export const useCourseCompletion = () => {
  const [studentProgress, setStudentProgress] = useState<StudentProgress[]>([]);
  const [completionStats, setCompletionStats] = useState<CompletionStats>({
    totalStudents: 0,
    completedStudents: 0,
    completionRate: 0,
    averageProgress: 0,
    studentsAtRisk: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourseCompletionData();
  }, []);

  const fetchCourseCompletionData = async () => {
    try {
      setLoading(true);

      // Get all active students with their basic info
      const { data: students, error: studentsError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          email,
          status,
          created_at,
          students!inner(enrollment_date, fees_cleared)
        `)
        .eq('role', 'student')
        .neq('status', 'inactive');

      if (studentsError) {
        safeLogger.error('Error fetching students:', studentsError);
        return;
      }

      // Get all available lessons count
      const { data: lessons, error: lessonsError } = await supabase
        .from('available_lessons')
        .select('id');

      if (lessonsError) {
        safeLogger.error('Error fetching lessons:', lessonsError);
        return;
      }

      const totalVideos = lessons?.length || 0;

      // Get all assignments count
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('id');

      if (assignmentsError) {
        safeLogger.error('Error fetching assignments:', assignmentsError);
        return;
      }

      const totalAssignments = assignments?.length || 0;

      // Get recording views for all students
      const { data: recordingViews, error: viewsError } = await supabase
        .from('recording_views')
        .select('user_id, recording_id, watched');

      if (viewsError) {
        safeLogger.error('Error fetching recording views:', viewsError);
      }

      // Get assignment submissions for all students
      const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('student_id, assignment_id, status')
        .eq('status', 'approved');

      if (submissionsError) {
        safeLogger.error('Error fetching submissions:', submissionsError);
      }

      // Calculate progress for each student
      const progressData: StudentProgress[] = students?.map(student => {
        const studentViews = recordingViews?.filter(rv => rv.user_id === student.id) || [];
        const videosWatched = studentViews.filter(rv => rv.watched).length;
        
        const studentSubmissions = submissions?.filter(s => s.student_id === student.id) || [];
        const assignmentsCompleted = studentSubmissions.length;

        const videoProgress = totalVideos > 0 ? (videosWatched / totalVideos) * 100 : 0;
        const assignmentProgress = totalAssignments > 0 ? (assignmentsCompleted / totalAssignments) * 100 : 0;
        
        // Overall progress is average of video and assignment progress
        const progressPercentage = Math.round((videoProgress + assignmentProgress) / 2);

        return {
          studentId: student.id,
          studentName: student.full_name || 'Unknown',
          email: student.email,
          progressPercentage,
          videosWatched,
          totalVideos,
          assignmentsCompleted,
          totalAssignments,
          status: student.status,
          enrollmentDate: student.created_at,
          estimatedCompletionDate: calculateEstimatedCompletion(
            student.created_at, 
            progressPercentage
          )
        };
      }) || [];

      // Calculate completion statistics
      const totalStudents = progressData.length;
      const completedStudents = progressData.filter(p => p.status === 'Passed out / Completed').length;
      const completionRate = totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0;
      
      const averageProgress = totalStudents > 0 
        ? progressData.reduce((sum, p) => sum + p.progressPercentage, 0) / totalStudents 
        : 0;
      
      // Students at risk: enrolled > 7 days ago but < 10% progress
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const studentsAtRisk = progressData.filter(p => 
        new Date(p.enrollmentDate) < sevenDaysAgo && 
        p.progressPercentage < 10 &&
        p.status !== 'Passed out / Completed'
      ).length;

      setStudentProgress(progressData);
      setCompletionStats({
        totalStudents,
        completedStudents,
        completionRate,
        averageProgress,
        studentsAtRisk
      });

    } catch (error) {
      safeLogger.error('Error fetching course completion data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedCompletion = (enrollmentDate: string, progressPercentage: number): string => {
    if (progressPercentage >= 100) return 'Completed';
    if (progressPercentage === 0) return 'Not started';

    const enrollment = new Date(enrollmentDate);
    const now = new Date();
    const daysEnrolled = Math.floor((now.getTime() - enrollment.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysEnrolled === 0 || progressPercentage === 0) return 'Unknown';

    const progressRate = progressPercentage / daysEnrolled;
    const remainingProgress = 100 - progressPercentage;
    const estimatedDaysToComplete = Math.ceil(remainingProgress / progressRate);
    
    const estimatedCompletion = new Date();
    estimatedCompletion.setDate(estimatedCompletion.getDate() + estimatedDaysToComplete);
    
    return estimatedCompletion.toLocaleDateString();
  };

  const refreshData = () => {
    fetchCourseCompletionData();
  };

  return {
    studentProgress,
    completionStats,
    loading,
    refreshData
  };
};