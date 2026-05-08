import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Lock, CheckCircle, Clock, BookOpen } from "lucide-react";
import type { CourseRecording } from "@/hooks/useCourseRecordings";

interface RecordingRowProps {
  recording: CourseRecording;
  index: number;
  userLMSStatus: string;
  onWatch: (recording: CourseRecording) => void;
}

export const RecordingRow: React.FC<RecordingRowProps> = ({
  recording,
  index,
  userLMSStatus,
  onWatch,
}) => {
  const navigate = useNavigate();
  const isActive = recording.isUnlocked && userLMSStatus === 'active';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 rounded-lg border transition-all gap-3 ${
        isActive
          ? 'bg-card border-border hover:border-primary/30 hover:shadow-sm'
          : 'bg-muted/30 border-muted'
      }`}
    >
      <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 min-w-0">
        <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted text-xs sm:text-sm font-medium shrink-0">
          {index + 1}
        </div>

        <div className="shrink-0">
          {isActive ? (
            recording.isWatched ? (
              <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
            ) : (
              <Play className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
            )
          ) : (
            <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className={`font-medium text-sm sm:text-base truncate ${!isActive ? 'text-muted-foreground' : ''}`}>
            {recording.recording_title}
          </h4>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs sm:text-sm text-muted-foreground mt-1">
            {recording.duration_min && (
              <span className="flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" />
                {recording.duration_min} min
              </span>
            )}
            {recording.hasAssignment && (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300 text-xs shrink-0">
                <BookOpen className="w-3 h-3 mr-1" />
                Assignment
              </Badge>
            )}
          </div>
          {userLMSStatus !== 'active' && (
            <span className="text-orange-600 font-medium text-xs mt-1 block">
              Please clear your fees to access content
            </span>
          )}
          {userLMSStatus === 'active' && !recording.isUnlocked && (
            <span className="text-orange-600 font-medium text-xs mt-1 block">
              {recording.lockReason === 'previous_lesson_not_watched' && 'Complete previous lesson to unlock'}
              {recording.lockReason === 'previous_assignment_not_submitted' && 'Submit previous assignment to unlock'}
              {recording.lockReason === 'previous_assignment_not_approved' && 'Previous assignment pending approval'}
              {recording.lockReason === 'drip_locked' && recording.dripUnlockDate &&
                `Unlocks on ${new Date(recording.dripUnlockDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`
              }
              {recording.lockReason === 'fees_not_cleared' && 'Not started yet'}
              {recording.lockReason === 'not_started_yet' && 'Not started yet'}
              {!recording.lockReason && 'Complete previous lessons to unlock'}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap justify-end sm:justify-start shrink-0 ml-10 sm:ml-0">
        {recording.isWatched && (
          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        )}

        {recording.hasAssignment && recording.assignmentSubmitted && (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Submitted
          </Badge>
        )}

        {recording.hasAssignment && recording.isUnlocked && userLMSStatus === 'active' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/assignments?assignmentId=${recording.assignmentId}`)}
            className="text-xs h-8"
          >
            <BookOpen className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
            <span className="hidden sm:inline">Assignment</span>
          </Button>
        )}

        <Button
          variant={recording.isWatched ? "outline" : "default"}
          size="sm"
          disabled={userLMSStatus !== 'active' || !recording.isUnlocked || !recording.recording_url}
          onClick={() => onWatch(recording)}
          className={`text-xs h-8 ${!isActive ? 'opacity-50' : ''}`}
        >
          <Play className="w-3 h-3 sm:w-4 sm:h-4 sm:mr-1" />
          <span className="hidden sm:inline">
            {userLMSStatus !== 'active'
              ? 'Clear Fees'
              : recording.isUnlocked
                ? (recording.isWatched ? 'Rewatch' : 'Watch Now')
                : 'Locked'
            }
          </span>
        </Button>
      </div>
    </div>
  );
};
