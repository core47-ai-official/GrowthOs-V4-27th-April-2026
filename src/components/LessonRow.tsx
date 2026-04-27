import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Play, CheckCircle, Lock, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LessonRowProps {
  lesson: {
    id: string;
    title: string;
    duration: string;
    completed: boolean;
    watched: boolean;
    locked: boolean;
    assignmentTitle: string;
    assignmentSubmitted: boolean;
    /** True if the latest submission was declined (resubmission required). */
    assignmentDeclined?: boolean;
    assignmentId?: string;
    recording_url?: string;
    sequence_order: number;
  };
  moduleId: string | number;
  moduleLocked: boolean;
  onWatchNow: (moduleId: number, lessonId: number) => void;
  onAssignmentClick: (lessonTitle: string, assignmentTitle: string, assignmentSubmitted: boolean, assignmentId?: string) => void;
}

export const LessonRow = React.memo(({ 
  lesson, 
  moduleId, 
  moduleLocked,
  onWatchNow, 
  onAssignmentClick 
}: LessonRowProps) => {
  const navigate = useNavigate();
  
  const handleWatchClick = () => {
    if (lesson.recording_url && !lesson.locked && !moduleLocked) {
      // Navigate only. The video player marks the recording as watched
      // ONLY after real playback time (30s OR 25% of duration). Marking on
      // click here would let students skip videos without watching them.
      navigate(`/video-player?url=${encodeURIComponent(lesson.recording_url)}&title=${encodeURIComponent(lesson.title)}&id=${lesson.id}`);
    }
  };

  const isLocked = lesson.locked || moduleLocked;

  const handleAssignmentClick = () => {
    if (!isLocked && lesson.assignmentTitle !== 'No Assignment') {
      onAssignmentClick(lesson.title, lesson.assignmentTitle, lesson.assignmentSubmitted, lesson.assignmentId);
    }
  };


  return (
    <div className={`flex items-center justify-between p-4 rounded-lg transition-colors ${
      isLocked ? 'bg-muted/10 opacity-60' : 'bg-muted/30 hover:bg-muted/50'
    }`}>
      <div className="flex items-center space-x-4 flex-1">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
          isLocked 
            ? 'bg-gray-200 text-gray-400'
            : lesson.completed 
              ? 'bg-green-100 text-green-600' 
              : lesson.watched
                ? 'bg-blue-100 text-blue-600'
                : 'bg-gray-100 text-gray-400'
        }`}>
          {isLocked ? (
            <Lock className="h-4 w-4" />
          ) : lesson.completed ? (
            <CheckCircle className="h-4 w-4" />
          ) : lesson.watched ? (
            <Eye className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className={`text-sm font-medium truncate ${
            isLocked ? 'text-muted-foreground' : 'text-foreground'
          }`}>
            {lesson.title}
            {isLocked && <span className="ml-2 text-xs">(Locked)</span>}
          </h4>
          <p className="text-xs text-muted-foreground">
            {lesson.duration}
            {lesson.watched && !lesson.completed && (
              <span className="ml-2 text-blue-600">• Watched</span>
            )}
            {lesson.completed && (
              <span className="ml-2 text-green-600">• Completed</span>
            )}
          </p>
        </div>
      </div>
      
      <div className="flex items-center space-x-3">
        {lesson.assignmentTitle !== 'No Assignment' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAssignmentClick}
            disabled={isLocked}
            className={`${
              lesson.assignmentDeclined
                ? 'bg-destructive/10 text-destructive border-destructive/30'
                : lesson.assignmentSubmitted
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : ''
            }`}
          >
            {isLocked
              ? 'Locked'
              : lesson.assignmentDeclined
                ? 'Resubmit Required'
                : lesson.assignmentSubmitted
                  ? 'View Submission'
                  : 'Submit Assignment'}
          </Button>
        )}
        
        <Button
          variant="default"
          size="sm"
          onClick={handleWatchClick}
          disabled={!lesson.recording_url || isLocked}
        >
          {isLocked ? 'Locked' : lesson.completed ? 'Watch Again' : 'Watch Now'}
        </Button>
      </div>
    </div>
  );
});

LessonRow.displayName = "LessonRow";