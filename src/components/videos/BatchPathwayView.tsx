import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookOpen, ChevronDown, ChevronRight, Lock, GraduationCap } from "lucide-react";
import { RecordingRow } from "./RecordingRow";
import type { CourseGroup } from "@/hooks/usePathwayGroupedRecordings";
import type { CourseRecording } from "@/hooks/useCourseRecordings";

interface BatchPathwayViewProps {
  courseGroups: CourseGroup[];
  totalRecordings: number;
  totalWatched: number;
  totalProgress: number;
  userLMSStatus: string;
  onWatch: (recording: CourseRecording) => void;
}

export const BatchPathwayView: React.FC<BatchPathwayViewProps> = ({
  courseGroups,
  totalRecordings,
  totalWatched,
  totalProgress,
  userLMSStatus,
  onWatch,
}) => {
  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(() => {
    // Auto-expand the first course that has unwatched unlocked content
    const first = courseGroups.find(cg =>
      cg.modules.some(m => m.recordings.some(r => r.isUnlocked && !r.isWatched))
    );
    return new Set(first ? [first.courseId] : courseGroups.length > 0 ? [courseGroups[0].courseId] : []);
  });
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const toggleCourse = (courseId: string) => {
    setExpandedCourses(prev => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Overall pathway progress */}
      <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-background border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="font-medium">Pathway Progress</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {totalWatched} / {totalRecordings} lessons completed
            </span>
          </div>
          <Progress value={totalProgress} className="h-2" />
        </CardContent>
      </Card>

      {/* Course groups */}
      {courseGroups.map(group => {
        const courseComplete = group.totalLessons > 0 && group.watchedLessons === group.totalLessons;
        const courseProgress = group.totalLessons > 0 ? Math.round((group.watchedLessons / group.totalLessons) * 100) : 0;
        const allLocked = group.modules.every(m => m.isLocked);

        return (
          <Card key={group.courseId} className="shadow-lg border-0 bg-gradient-to-br from-card to-muted/20">
            <Collapsible open={expandedCourses.has(group.courseId)} onOpenChange={() => toggleCourse(group.courseId)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {group.stepNumber}
                        </div>
                        <span className="truncate">{group.courseTitle}</span>
                        {courseComplete && (
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs shrink-0">
                            Complete
                          </Badge>
                        )}
                        {allLocked && !courseComplete && (
                          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-3 mt-2 ml-11">
                        <Progress value={courseProgress} className="h-1.5 flex-1 max-w-[200px]" />
                        <span className="text-xs text-muted-foreground shrink-0">
                          {group.watchedLessons}/{group.totalLessons}
                        </span>
                      </div>
                    </div>
                    {expandedCourses.has(group.courseId) ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="p-2 sm:p-4 space-y-2">
                  {group.modules.map(module => (
                    <Collapsible
                      key={module.id}
                      open={expandedModules.has(module.id)}
                      onOpenChange={() => toggleModule(module.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between p-2 sm:p-3 rounded-md hover:bg-muted/40 cursor-pointer transition-colors">
                          <div className="flex items-center gap-2">
                            {expandedModules.has(module.id) ? (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )}
                            <BookOpen className="w-4 h-4 text-primary/70" />
                            <span className="font-medium text-sm">{module.title}</span>
                            {module.isLocked && <Lock className="w-3 h-3 text-muted-foreground" />}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {module.watchedLessons}/{module.totalLessons}
                          </span>
                        </div>
                      </CollapsibleTrigger>

                      <CollapsibleContent>
                        <div className="space-y-2 pl-4 sm:pl-6 pt-1 pb-2">
                          {module.recordings.map((recording, idx) => (
                            <RecordingRow
                              key={recording.id}
                              recording={recording}
                              index={idx}
                              userLMSStatus={userLMSStatus}
                              onWatch={onWatch}
                            />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};
