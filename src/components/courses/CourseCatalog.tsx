import React from 'react';
import { useCourses } from '@/hooks/useCourses';
import { CourseCard } from './CourseCard';
import { Skeleton } from '@/components/ui/skeleton';
import { BookOpen, AlertCircle } from 'lucide-react';

interface CourseCatalogProps {
  onCourseSelect: (courseId: string) => void;
  onCourseContinue?: (courseId: string) => void;
  showOnlyEnrolled?: boolean;
  variant?: 'default' | 'compact';
  className?: string;
}

export function CourseCatalog({
  onCourseSelect,
  onCourseContinue,
  showOnlyEnrolled = true,
  variant = 'default',
  className = ''
}: CourseCatalogProps) {
  const { courses, enrolledCourses, loading, error, isMultiCourseEnabled } = useCourses();

  if (loading) {
    return (
      <div className={`grid gap-4 ${variant === 'compact' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} ${className}`}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className={variant === 'compact' ? 'h-20' : 'h-80'} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="font-medium text-lg mb-2">Failed to load courses</h3>
        <p className="text-sm text-muted-foreground">
          {error.message}
        </p>
      </div>
    );
  }

  const displayCourses = showOnlyEnrolled ? enrolledCourses : courses.map(c => ({
    ...c,
    isEnrolled: enrolledCourses.some(ec => ec.id === c.id),
    progress: enrolledCourses.find(ec => ec.id === c.id)?.progress || 0
  }));

  if (displayCourses.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-medium text-lg mb-2">
          {showOnlyEnrolled ? 'No courses enrolled' : 'No courses available'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {showOnlyEnrolled 
            ? 'You are not enrolled in any courses yet.'
            : 'There are no courses available at this time.'
          }
        </p>
      </div>
    );
  }

  return (
    <div className={`grid gap-4 ${variant === 'compact' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'} ${className}`}>
      {displayCourses.map((course) => (
        <CourseCard
          key={course.id}
          course={course}
          onSelect={onCourseSelect}
          onContinue={onCourseContinue}
          variant={variant}
        />
      ))}
    </div>
  );
}
