import { Play } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ModuleExpansionIcon } from "./ModuleExpansionIcon";
import { LessonRow } from "./LessonRow";

interface ModuleCardProps {
  module: {
    id: string | number;
    title: string;
    totalLessons: number;
    completedLessons: number;
    locked: boolean;
    lessons: any[];
  };
  index: number;
  isExpanded: boolean;
  onToggle: (moduleId: string | number) => void;
  onWatchNow: (moduleId: number, lessonId: number) => void;
  onAssignmentClick: (lessonTitle: string, assignmentTitle: string, assignmentSubmitted: boolean, assignmentId?: string) => void;
}

const getModuleColorScheme = (moduleIndex: number) => {
  const schemes = [
    { bg: "bg-blue-500/10", border: "border-blue-500/20", accent: "text-blue-700 dark:text-blue-400" },
    { bg: "bg-green-500/10", border: "border-green-500/20", accent: "text-green-700 dark:text-green-400" },
    { bg: "bg-purple-500/10", border: "border-purple-500/20", accent: "text-purple-700 dark:text-purple-400" },
    { bg: "bg-orange-500/10", border: "border-orange-500/20", accent: "text-orange-700 dark:text-orange-400" },
    { bg: "bg-red-500/10", border: "border-red-500/20", accent: "text-red-700 dark:text-red-400" }
  ];
  return schemes[moduleIndex % schemes.length];
};

export const ModuleCard = ({ 
  module, 
  index, 
  isExpanded, 
  onToggle, 
  onWatchNow, 
  onAssignmentClick 
}: ModuleCardProps) => {
  const colorScheme = getModuleColorScheme(index);
  const totalDuration = module.lessons.reduce((acc, lesson) => 
    acc + (parseInt(lesson.duration) || 0), 0
  );

  return (
    <div className={`bg-card rounded-lg shadow-sm border transition-shadow duration-200 ${
      module.locked 
        ? 'border-muted opacity-60' 
        : `${colorScheme.border} hover:shadow-md`
    }`}>
      <Collapsible open={isExpanded} onOpenChange={() => onToggle(module.id)}>
        <CollapsibleTrigger 
          className={`w-full p-6 flex items-center justify-between transition-colors duration-200 rounded-t-lg ${
            module.locked ? 'cursor-not-allowed' : 'hover:bg-muted/50'
          }`}
          disabled={module.locked}
        >
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
              module.locked 
                ? 'bg-muted text-muted-foreground'
                : `${colorScheme.bg} ${colorScheme.accent}`
            }`}>
              <Play className="h-5 w-5" />
            </div>
            <div className="text-left">
              <h3 className={`text-lg font-semibold ${
                module.locked ? 'text-muted-foreground' : 'text-foreground'
              }`}>
                {module.title}
                {module.locked && <span className="ml-2 text-sm font-normal">(Locked)</span>}
              </h3>
              <p className="text-sm text-muted-foreground">
                {module.completedLessons}/{module.totalLessons} completed • {totalDuration} min
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-foreground">
                {module.totalLessons} lessons
              </div>
              <div className="text-xs text-muted-foreground">
                {module.totalLessons > 0 ? 'Track progress' : 'No lessons'}
              </div>
            </div>
            <div className="p-2 rounded-full">
              <ModuleExpansionIcon moduleIndex={index} isExpanded={isExpanded} />
            </div>
          </div>
        </CollapsibleTrigger>
      
        <CollapsibleContent>
          <div className="border-t border-border">
            <div className="p-6 space-y-4">
              {module.lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  moduleId={module.id}
                  moduleLocked={module.locked}
                  onWatchNow={onWatchNow}
                  onAssignmentClick={onAssignmentClick}
                />
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
