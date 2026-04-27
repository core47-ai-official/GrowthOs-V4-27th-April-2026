import React from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { BookOpen, CheckCircle } from 'lucide-react';
import { CourseWithEnrollment } from '@/hooks/useCourses';

interface CourseSelectorProps {
  courses: CourseWithEnrollment[];
  activeCourseId: string | null;
  onCourseChange: (courseId: string) => void;
  loading?: boolean;
  className?: string;
}

export function CourseSelector({
  courses,
  activeCourseId,
  onCourseChange,
  loading = false,
  className = ''
}: CourseSelectorProps) {
  if (loading) {
    return (
      <div className={`h-10 w-48 bg-muted animate-pulse rounded-md ${className}`} />
    );
  }

  if (courses.length === 0) {
    return null;
  }

  // Don't show selector if only one course
  if (courses.length === 1) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md ${className}`}>
        <BookOpen className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium truncate max-w-[200px]">
          {courses[0].title}
        </span>
      </div>
    );
  }

  const activeCourse = courses.find(c => c.id === activeCourseId);

  return (
    <Select value={activeCourseId || undefined} onValueChange={onCourseChange}>
      <SelectTrigger className={`w-[220px] ${className}`}>
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <SelectValue placeholder="Select a course">
            {activeCourse && (
              <span className="truncate">{activeCourse.title}</span>
            )}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {courses.map((course) => (
          <SelectItem key={course.id} value={course.id}>
            <div className="flex items-center justify-between gap-3 w-full">
              <span className="truncate">{course.title}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {course.progress === 100 && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {course.progress > 0 && course.progress < 100 && (
                  <Badge variant="secondary" className="text-xs">
                    {course.progress}%
                  </Badge>
                )}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
