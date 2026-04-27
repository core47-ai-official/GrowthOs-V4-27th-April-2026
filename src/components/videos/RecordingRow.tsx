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
      className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-4 rounded-lg border transition-all ${
        isActive
          ? 'bg-card border-border hover:border-primary/30 hover:shadow-sm'
          : 'bg-muted/30 border-muted'
      }`}
    >
      {/* Number */}
      <div className="flex items-center justify-center w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-muted text-xs sm:text-sm font-medium shrink-0">
        {index + 1}
      </div>

      {/* Status icon */}
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

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className={`font-medium text-sm sm:text-base truncate ${!isActive ? 'text-muted-foreground' : ''}`}>
          {recording.recording_title}
        </h4>
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 text-xs text-muted-foreground mt-0.5">
          {recording.duration_min && (
            <span className="flex items-center gap-1 shrink-0">
              <Clock className="w-3 h-3" />
              {recording.duration_min} min
            </span>
          )}
          {recording.isWatched && (
            <span className="text-green-600 font-medium">✓ Done</span>
          )}
          {recording.hasAssignment && recording.assignmentSubmitted && (
            <span className="text-blue-600 font-medium">✓ Submitted</span>
          )}
        </div>
        {userLMSStatus !== 'active' && (
          <span className="text-orange-600 font-medium text-xs mt-0.5 block">
            Clear your fees to access
          </span>
        )}
        {userLMSStatus === 'active' && !recording.isUnlocked && (
          <span className="text-orange-600 font-medium text-xs mt-0.5 block">
            {recording.lockReason === 'previous_lesson_not_watched' && 'Watch the previous lesson first'}
            {recording.lockReason === 'previous_assignment_not_submitted' && 'Submit your assignment to continue'}
            {recording.lockReason === 'previous_assignment_not_approved' && 'Waiting for review'}
            {recording.lockReason === 'drip_locked' && recording.dripUnlockDate &&
              `Unlocks ${new Date(recording.dripUnlockDate).toLocaleDateString()}`
            }
            {recording.lockReason === 'fees_not_cleared' && 'Clear fees to unlock'}
            {!recording.lockReason && 'Complete previous lessons'}
          </span>
        )}
      </div>

      {/* Action button - compact */}
      <div className="shrink-0 flex items-center gap-1.5">
        {recording.hasAssignment && recording.isUnlocked && userLMSStatus === 'active' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/assignments?assignmentId=${recording.assignmentId}`)}
            className="h-8 w-8"
          >
            <BookOpen className="w-4 h-4" />
          </Button>
        )}

        <Button
          variant={recording.isWatched ? "ghost" : "default"}
          size="icon"
          disabled={userLMSStatus !== 'active' || !recording.isUnlocked || !recording.recording_url}
          onClick={() => onWatch(recording)}
          className={`h-8 w-8 ${!isActive ? 'opacity-50' : ''}`}
        >
          <Play className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
