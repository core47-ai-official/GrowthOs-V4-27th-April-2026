import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Route, CheckCircle } from "lucide-react";
import { extractFinancialGoalForDisplay } from "@/utils/dreamGoalUtils";

interface PathwayCourse {
  courseId: string;
  courseTitle: string;
  stepNumber: number;
  isCompleted: boolean;
}

interface LearningJourneyCardProps {
  isInPathwayMode: boolean;
  pathwayState: {
    pathwayName: string;
    currentStepNumber: number;
    totalSteps: number;
    currentCourseTitle: string;
  } | null;
  pathwayCourses: PathwayCourse[];
  courseProgress: number;
  firstOnboardingAnswer: string;
  dreamGoal: string;
}

export const LearningJourneyCard: React.FC<LearningJourneyCardProps> = ({
  isInPathwayMode,
  pathwayState,
  pathwayCourses,
  courseProgress,
  firstOnboardingAnswer,
  dreamGoal,
}) => {
  return (
    <Card className="bg-primary/5 border-primary/20 shadow-sm hover:shadow-md transition-shadow duration-200 animate-fade-in">
      <CardContent className="p-4 sm:p-6">
        <div className="space-y-4 sm:space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                {isInPathwayMode ? (
                  <Route className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                ) : (
                  <span className="text-lg sm:text-xl">🎯</span>
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-medium text-primary mb-0.5 sm:mb-1 truncate">
                  {isInPathwayMode ? 'Your Learning Journey' : 'Your Financial Goal'}
                </h2>
                <p className="text-xs text-muted-foreground truncate">
                  {isInPathwayMode && pathwayState
                    ? `${pathwayState.pathwayName} • Step ${pathwayState.currentStepNumber} of ${pathwayState.totalSteps}`
                    : 'Track your progress towards financial freedom'}
                </p>
              </div>
            </div>
            {isInPathwayMode && (
              <Badge variant="secondary" className="bg-primary/10 text-primary w-fit">
                Pathway Mode
              </Badge>
            )}
          </div>

          {/* Pathway step indicators */}
          {isInPathwayMode && pathwayCourses.length > 0 && (
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto py-2 -mx-1 px-1 scrollbar-thin">
              {pathwayCourses.slice(0, 8).map((course, index) => {
                const isCurrentStep = course.stepNumber === pathwayState?.currentStepNumber;
                return (
                  <div
                    key={course.courseId}
                    className={`flex items-center ${index < pathwayCourses.length - 1 ? 'flex-1' : ''}`}
                  >
                    <div
                      className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-medium flex-shrink-0 ${
                        course.isCompleted
                          ? 'bg-green-500 text-white'
                          : isCurrentStep
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                            : 'bg-muted text-muted-foreground'
                      }`}
                      title={course.courseTitle}
                    >
                      {course.isCompleted ? (
                        <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                      ) : (
                        course.stepNumber
                      )}
                    </div>
                    {index < pathwayCourses.slice(0, 8).length - 1 && (
                      <div className={`h-0.5 flex-1 mx-0.5 sm:mx-1 min-w-2 sm:min-w-4 ${
                        course.isCompleted ? 'bg-green-500' : 'bg-muted'
                      }`} />
                    )}
                  </div>
                );
              })}
              {pathwayCourses.length > 8 && (
                <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0">
                  +{pathwayCourses.length - 8} more
                </span>
              )}
            </div>
          )}

          {/* Financial goal display */}
          <div className="bg-background/80 rounded-lg p-3 sm:p-4 border border-primary/10">
            <p className="text-sm sm:text-base font-normal text-foreground leading-relaxed line-clamp-3 sm:line-clamp-none">
              {firstOnboardingAnswer || extractFinancialGoalForDisplay(dreamGoal)}
            </p>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5 sm:space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-[10px] sm:text-xs font-normal text-muted-foreground">
                {isInPathwayMode ? 'Pathway progress' : 'Progress toward your goal'}
              </span>
              <span className="text-xs sm:text-sm font-medium text-primary">{courseProgress}% complete</span>
            </div>
            <Progress
              value={courseProgress}
              className="h-1 sm:h-1.5 transition-all duration-1000 ease-out"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
