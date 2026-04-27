import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDreamGoalForDisplay } from "@/utils/dreamGoalUtils";
import { Edit } from "lucide-react";

interface DreamGoalCardProps {
  dreamGoalSummary: string | null;
  onEditGoal: () => void;
}

export function DreamGoalCard({ dreamGoalSummary, onEditGoal }: DreamGoalCardProps) {
  const displayText = formatDreamGoalForDisplay(dreamGoalSummary);
  const hasGoal = dreamGoalSummary && dreamGoalSummary.trim() !== '';

  return (
    <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg font-semibold text-primary flex items-center gap-2">
          <span>Your Dream Goal</span>
          <span className="text-2xl">🌟</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className={`text-sm ${hasGoal ? 'text-foreground' : 'text-muted-foreground italic'}`}>
          {displayText}
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onEditGoal}
          className="w-full sm:w-auto"
        >
          <Edit className="w-4 h-4 mr-2" />
          {hasGoal ? 'Edit Goal' : 'Set Your Goal'}
        </Button>
      </CardContent>
    </Card>
  );
}