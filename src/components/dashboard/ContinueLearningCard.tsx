import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Lock, BookOpen, Upload, Clock, Calendar, AlertCircle, ArrowRight, CheckCircle } from "lucide-react";
import { format } from "date-fns";

interface ContinueLearningCardProps {
  isInPathwayMode: boolean;
  pathwayState: { currentCourseTitle: string } | null;
  activeCourseTitle: string;
  currentLockReason: {
    reason: string;
    unlockDate?: string;
    nextLesson?: string;
  } | null;
}

export const ContinueLearningCard: React.FC<ContinueLearningCardProps> = ({
  isInPathwayMode,
  pathwayState,
  activeCourseTitle,
  currentLockReason,
}) => {
  const navigate = useNavigate();
  const isFeesBlocked = currentLockReason?.reason === 'fees_not_cleared';

  const lockIcon = (() => {
    if (!currentLockReason) return null;
    switch (currentLockReason.reason) {
      case 'previous_lesson_not_watched': return <BookOpen className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      case 'previous_assignment_not_submitted': return <Upload className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      case 'previous_assignment_not_approved': return <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      case 'drip_locked': return <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />;
      case 'fees_not_cleared': return <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />;
      default: return <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />;
    }
  })();

  const lockMessage = (() => {
    if (!currentLockReason) return '';
    switch (currentLockReason.reason) {
      case 'previous_lesson_not_watched': return 'Watch the previous lesson first';
      case 'previous_assignment_not_submitted': return 'Submit your assignment to continue';
      case 'previous_assignment_not_approved': return 'Waiting for your assignment to be reviewed';
      case 'drip_locked':
        return currentLockReason.unlockDate
          ? `Unlocks on ${format(new Date(currentLockReason.unlockDate), 'MMM d')}`
          : 'Content not yet available';
      case 'fees_not_cleared': return 'Clear your fees to unlock';
      default: return 'Content locked';
    }
  })();

  return (
    <Card
      className={`hover:shadow-md transition-shadow duration-200 border-l-2 animate-fade-in cursor-pointer ${
        currentLockReason ? 'border-l-amber-400' : 'border-l-green-400'
      }`}
      onClick={() => navigate('/videos')}
    >
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base font-medium ${
          currentLockReason ? 'text-amber-600' : 'text-green-600'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            currentLockReason ? 'bg-amber-500/10' : 'bg-green-500/10'
          }`}>
            {currentLockReason ? <Lock className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </div>
          Continue Learning
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-foreground line-clamp-1">
              {isInPathwayMode && pathwayState
                ? pathwayState.currentCourseTitle
                : activeCourseTitle || 'Your Course'}
            </p>
            {currentLockReason?.nextLesson && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                Next: {currentLockReason.nextLesson}
              </p>
            )}
          </div>

          {currentLockReason ? (
            <div className={`flex items-center gap-2 p-2 rounded-md ${
              isFeesBlocked ? 'bg-red-500/10' : 'bg-amber-500/10'
            }`}>
              {lockIcon}
              <span className={`text-xs font-medium ${
                isFeesBlocked ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
              }`}>
                {lockMessage}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                All content unlocked!
              </span>
            </div>
          )}

          <Button
            size="sm"
            className="w-full text-sm font-normal"
            variant={isFeesBlocked ? 'destructive' : 'default'}
          >
            {isFeesBlocked ? 'View Payment' : 'Go to Videos'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
