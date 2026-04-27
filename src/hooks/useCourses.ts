import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';

export interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  price: number | null;
  currency: string | null;
  is_active: boolean;
  is_published: boolean;
  sequence_order: number | null;
  created_at: string | null;
}

export interface CourseEnrollment {
  id: string;
  course_id: string;
  student_id: string;
  status: string;
  progress_percentage: number;
  enrolled_at: string | null;
  completed_at: string | null;
  course?: Course;
}

export interface CourseWithEnrollment extends Course {
  enrollment?: CourseEnrollment;
  isEnrolled: boolean;
  progress: number;
}

interface UseCoursesReturn {
  courses: Course[];
  enrolledCourses: CourseWithEnrollment[];
  activeCourse: CourseWithEnrollment | null;
  loading: boolean;
  error: Error | null;
  setActiveCourse: (courseId: string) => void;
  refreshCourses: () => Promise<void>;
  isMultiCourseEnabled: boolean;
}

export function useCourses(): UseCoursesReturn {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<CourseWithEnrollment[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [isMultiCourseEnabled, setIsMultiCourseEnabled] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check if multi-course is enabled
      const { data: settings } = await supabase
        .from('company_settings')
        .select('multi_course_enabled')
        .eq('id', 1)
        .maybeSingle();

      const multiCourseEnabled = settings?.multi_course_enabled ?? false;
      setIsMultiCourseEnabled(multiCourseEnabled);

      // Fetch all active courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .eq('is_active', true)
        .order('sequence_order', { ascending: true });

      if (coursesError) throw coursesError;
      setCourses(coursesData || []);

      // Fetch student enrollments (only for students)
      if (user.role === 'student') {
        // First, look up the student record to get the correct students.id
        const { data: studentData } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const studentId = studentData?.id;

        if (!studentId) {
          logger.warn('No student record found for user', { userId: user.id });
          setEnrolledCourses([]);
          setLoading(false);
          return;
        }

        const { data: enrollmentsData, error: enrollmentsError } = await supabase
          .from('course_enrollments')
          .select(`
            id,
            course_id,
            student_id,
            status,
            progress_percentage,
            enrolled_at,
            completed_at,
            access_expires_at,
            enrollment_source,
            pathway_id
          `)
          .eq('student_id', studentId);

        if (enrollmentsError) throw enrollmentsError;

        // Check if user has an active pathway enrollment
        const hasActivePathway = enrollmentsData?.some(
          e => e.pathway_id !== null && e.enrollment_source === 'pathway' && e.status === 'active'
        );

        // If user has an active pathway, only show courses from that pathway
        let filteredCourseIds: Set<string> | null = null;
        if (hasActivePathway) {
          // Get the pathway ID from the pathway enrollment
          const pathwayEnrollment = enrollmentsData?.find(
            e => e.pathway_id !== null && e.enrollment_source === 'pathway' && e.status === 'active'
          );
          if (pathwayEnrollment?.pathway_id) {
            const { data: pathwayCourseData } = await supabase
              .from('pathway_courses')
              .select('course_id')
              .eq('pathway_id', pathwayEnrollment.pathway_id);
            if (pathwayCourseData) {
              filteredCourseIds = new Set(pathwayCourseData.map(pc => pc.course_id));
            }
          }
        }

        // Map courses with enrollment data, filtering out expired access and non-pathway courses
        const enrolledCoursesData: CourseWithEnrollment[] = (coursesData || [])
          .filter(course => {
            const enrollment = enrollmentsData?.find(e => e.course_id === course.id);
            if (!enrollment) return false;

            // If in pathway mode, only include courses that are in the pathway
            if (filteredCourseIds && !filteredCourseIds.has(course.id)) {
              logger.debug('Filtering out non-pathway course', { courseId: course.id });
              return false;
            }
            
            // Check if access has expired
            if (enrollment.access_expires_at) {
              const expiresAt = new Date(enrollment.access_expires_at);
              if (expiresAt < new Date()) {
                logger.debug('Course access expired', { courseId: course.id, expiresAt });
                return false;
              }
            }
            
            return true;
          })
          .map(course => {
            const enrollment = enrollmentsData?.find(e => e.course_id === course.id);
            return {
              ...course,
              enrollment: enrollment || undefined,
              isEnrolled: !!enrollment,
              progress: enrollment?.progress_percentage || 0
            };
          });

        setEnrolledCourses(enrolledCoursesData);

        // Set active course from localStorage or default to first enrolled
        const storedCourseId = localStorage.getItem(`active_course_${user.id}`);
        if (storedCourseId && enrolledCoursesData.some(c => c.id === storedCourseId)) {
          setActiveCourseId(storedCourseId);
        } else if (enrolledCoursesData.length > 0) {
          setActiveCourseId(enrolledCoursesData[0].id);
        }
      } else {
        // For non-students (mentors, admins), show all courses
        const allCoursesWithEnrollment: CourseWithEnrollment[] = (coursesData || []).map(course => ({
          ...course,
          isEnrolled: true,
          progress: 0
        }));
        setEnrolledCourses(allCoursesWithEnrollment);
        
        if (allCoursesWithEnrollment.length > 0) {
          const storedCourseId = localStorage.getItem(`active_course_${user.id}`);
          if (storedCourseId && allCoursesWithEnrollment.some(c => c.id === storedCourseId)) {
            setActiveCourseId(storedCourseId);
          } else {
            setActiveCourseId(allCoursesWithEnrollment[0].id);
          }
        }
      }
    } catch (err) {
      logger.error('Error fetching courses:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch courses'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const setActiveCourse = useCallback((courseId: string) => {
    if (user?.id) {
      localStorage.setItem(`active_course_${user.id}`, courseId);
    }
    setActiveCourseId(courseId);
  }, [user?.id]);

  const activeCourse = enrolledCourses.find(c => c.id === activeCourseId) || null;

  return {
    courses,
    enrolledCourses,
    activeCourse,
    loading,
    error,
    setActiveCourse,
    refreshCourses: fetchCourses,
    isMultiCourseEnabled
  };
}
