import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Route, 
  BookOpen, 
  CheckCircle, 
  Lock, 
  ArrowRight,
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { PathwayState, PathwayCourse } from '@/hooks/useActivePathwayAccess';

interface PathwayProgressCardProps {
  pathwayState: PathwayState;
  pathwayCourses: PathwayCourse[];
  onAdvance: () => void;
  onMakeChoice: (courseId: string) => void;
  isAdvancing?: boolean;
}

// Helper to group and process courses for display
interface DisplayCourse {
  type: 'single' | 'choice-pending' | 'choice-selected';
  stepNumber: number;
  courses: PathwayCourse[];
  choiceGroup: number | null;
}

export function PathwayProgressCard({
  pathwayState,
  pathwayCourses,
  onAdvance,
  onMakeChoice,
  isAdvancing = false
}: PathwayProgressCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Process courses into display groups - sorted by step_number, handling choices
  const displayCourses = useMemo(() => {
    const result: DisplayCourse[] = [];
    const processedChoiceGroups = new Set<number>();
    
    // Sort by step_number first
    const sorted = [...pathwayCourses].sort((a, b) => a.stepNumber - b.stepNumber);
    
    for (const course of sorted) {
      // Regular non-choice course
      if (!course.isChoicePoint || course.choiceGroup === null) {
        result.push({
          type: 'single',
          stepNumber: course.stepNumber,
          courses: [course],
          choiceGroup: null
        });
        continue;
      }
      
      // Skip if we already processed this choice group
      if (processedChoiceGroups.has(course.choiceGroup)) {
        continue;
      }
      
      processedChoiceGroups.add(course.choiceGroup);
      
      // Get all courses in this choice group
      const choiceCourses = sorted.filter(c => c.choiceGroup === course.choiceGroup);
      
      // Check if a choice has been made (any course in the group is selected)
      const selectedCourse = choiceCourses.find(c => c.isSelectedChoice);
      
      if (selectedCourse) {
        // Choice made - only show selected course
        result.push({
          type: 'choice-selected',
          stepNumber: course.stepNumber,
          courses: [selectedCourse],
          choiceGroup: course.choiceGroup
        });
      } else {
        // No choice made - show as choice pending (with OR)
        result.push({
          type: 'choice-pending',
          stepNumber: course.stepNumber,
          courses: choiceCourses,
          choiceGroup: course.choiceGroup
        });
      }
    }
    
    return result;
  }, [pathwayCourses]);

  const completedSteps = pathwayCourses.filter(c => c.isCompleted && !c.isChoicePoint).length +
    pathwayCourses.filter(c => c.isCompleted && c.isSelectedChoice).length;
  const totalSteps = displayCourses.length;
  const progressPercentage = totalSteps > 0 
    ? (completedSteps / totalSteps) * 100 
    : 0;

  const currentCourse = pathwayCourses.find(c => c.isCurrent);
  const canAdvance = currentCourse?.isCompleted && !pathwayState.hasPendingChoice;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20 overflow-hidden">
        <CardContent className="p-4 space-y-4">
          {/* Pathway Header - Collapsible Trigger */}
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between cursor-pointer hover:opacity-80 transition-opacity">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Route className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{pathwayState.pathwayName}</h3>
                  <p className="text-xs text-muted-foreground">
                    Step {pathwayState.currentStepNumber} of {totalSteps}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Pathway Mode
                </Badge>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>

          {/* Progress Bar - Always visible */}
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Collapsible Content */}
          <CollapsibleContent className="space-y-4">
            {/* Course Steps */}
            <div className="space-y-2">
              {displayCourses.slice(0, 6).map((displayItem, index) => (
                <React.Fragment key={`step-${displayItem.stepNumber}-${index}`}>
                  {displayItem.type === 'single' || displayItem.type === 'choice-selected' ? (
                    // Single course or selected choice - render normally
                    <CourseRow 
                      course={displayItem.courses[0]} 
                      displayStepNumber={displayItem.stepNumber}
                      isChoiceSelected={displayItem.type === 'choice-selected'}
                      currentStepNumber={pathwayState.currentStepNumber}
                    />
                  ) : (
                    // Choice pending - show both options with OR
                    <div className="space-y-1">
                      {displayItem.courses.map((course, choiceIdx) => (
                        <React.Fragment key={course.courseId}>
                          <CourseRow 
                            course={course} 
                            displayStepNumber={displayItem.stepNumber}
                            isChoicePending={true}
                            currentStepNumber={pathwayState.currentStepNumber}
                          />
                          {choiceIdx < displayItem.courses.length - 1 && (
                            <div className="flex items-center justify-center py-1">
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded">
                                OR
                              </span>
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))}
              {displayCourses.length > 6 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{displayCourses.length - 6} more courses
                </p>
              )}
            </div>

            {/* Choice Point UI - Show when at a choice point */}
            {pathwayState.hasPendingChoice && currentCourse?.choiceOptions && (
              <div className="space-y-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <Sparkles className="w-4 h-4" />
                  <span className="font-medium text-sm">Choose Your Path</span>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Complete the current course to unlock your choice. Select which track you want to pursue:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {currentCourse.choiceOptions.map((option) => (
                    <Button
                      key={option.course_id}
                      variant="outline"
                      size="sm"
                      onClick={() => onMakeChoice(option.course_id)}
                      disabled={!currentCourse?.isCompleted || isAdvancing}
                      className="justify-start"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      {option.course_title}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Advance Button (when not at choice point) */}
            {!pathwayState.hasPendingChoice && currentCourse && (
              <div className="pt-2 border-t">
                {canAdvance ? (
                  <Button 
                    onClick={onAdvance} 
                    disabled={isAdvancing}
                    className="w-full"
                  >
                    {isAdvancing ? (
                      'Advancing...'
                    ) : (
                      <>
                        Unlock Next Course
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="text-center text-sm text-muted-foreground">
                    <p>Complete all videos and get assignments approved to unlock the next course</p>
                  </div>
                )}
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

// Helper component for rendering a single course row
function CourseRow({ 
  course, 
  displayStepNumber,
  isChoicePending = false,
  isChoiceSelected = false,
  currentStepNumber
}: { 
  course: PathwayCourse; 
  displayStepNumber: number;
  isChoicePending?: boolean;
  isChoiceSelected?: boolean;
  currentStepNumber: number;
}) {
  // Use stepNumber comparison for accurate current detection
  const isCurrentStep = course.stepNumber === currentStepNumber;
  
  return (
    <div 
      className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
        isCurrentStep 
          ? 'bg-primary/10 border border-primary/30' 
          : course.isCompleted 
            ? 'bg-green-50 dark:bg-green-900/20' 
            : isChoicePending
              ? 'bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/50'
              : 'bg-muted/50'
      }`}
    >
      <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
        course.isCompleted 
          ? 'bg-green-500 text-white' 
          : isCurrentStep 
            ? 'bg-primary text-primary-foreground' 
            : isChoicePending
              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
              : 'bg-muted-foreground/20 text-muted-foreground'
      }`}>
        {course.isCompleted ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          displayStepNumber
        )}
      </div>
      <span className={`flex-1 text-sm ${
        isCurrentStep ? 'font-medium' : ''
      } ${!course.isAvailable && !course.isCompleted ? 'text-muted-foreground' : ''}`}>
        {course.courseTitle}
      </span>
      {isCurrentStep && (
        <Badge variant="outline" className="text-xs">Current</Badge>
      )}
      {isChoiceSelected && course.isCompleted && (
        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          Selected
        </Badge>
      )}
      {!course.isAvailable && !course.isCompleted && !isCurrentStep && !isChoicePending && (
        <Lock className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}
