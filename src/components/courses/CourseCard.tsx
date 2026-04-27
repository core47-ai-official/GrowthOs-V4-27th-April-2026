import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BookOpen, Clock, CheckCircle, Lock, Play } from 'lucide-react';
import { CourseWithEnrollment } from '@/hooks/useCourses';

interface CourseCardProps {
  course: CourseWithEnrollment;
  onSelect: (courseId: string) => void;
  onContinue?: (courseId: string) => void;
  variant?: 'default' | 'compact';
}

export function CourseCard({ 
  course, 
  onSelect, 
  onContinue,
  variant = 'default' 
}: CourseCardProps) {
  const isCompleted = course.progress === 100;
  const isInProgress = course.progress > 0 && course.progress < 100;

  if (variant === 'compact') {
    return (
      <Card 
        className="cursor-pointer hover:shadow-md transition-all duration-200 hover:border-primary/50"
        onClick={() => onSelect(course.id)}
      >
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              {course.thumbnail_url ? (
                <img 
                  src={course.thumbnail_url} 
                  alt={course.title}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <BookOpen className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{course.title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={course.progress} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {course.progress}%
                </span>
              </div>
            </div>
            {isCompleted && (
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 group">
      {/* Thumbnail */}
      <div className="relative h-40 bg-gradient-to-br from-primary/20 to-primary/5">
        {course.thumbnail_url ? (
          <img 
            src={course.thumbnail_url} 
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <BookOpen className="h-16 w-16 text-primary/40" />
          </div>
        )}
        
        {/* Status badge overlay */}
        <div className="absolute top-3 right-3">
          {isCompleted && (
            <Badge className="bg-green-500 hover:bg-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              Completed
            </Badge>
          )}
          {isInProgress && (
            <Badge variant="secondary">
              <Clock className="h-3 w-3 mr-1" />
              In Progress
            </Badge>
          )}
          {!course.isEnrolled && (
            <Badge variant="outline" className="bg-background/80">
              <Lock className="h-3 w-3 mr-1" />
              Not Enrolled
            </Badge>
          )}
        </div>
      </div>

      <CardHeader className="pb-2">
        <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
          {course.title}
        </h3>
        {course.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {course.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="pb-2">
        {course.isEnrolled && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{course.progress}%</span>
            </div>
            <Progress value={course.progress} className="h-2" />
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2">
        {course.isEnrolled ? (
          <Button 
            className="w-full"
            onClick={() => onContinue ? onContinue(course.id) : onSelect(course.id)}
          >
            <Play className="h-4 w-4 mr-2" />
            {isCompleted ? 'Review Course' : isInProgress ? 'Continue' : 'Start Course'}
          </Button>
        ) : (
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => onSelect(course.id)}
          >
            View Details
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
