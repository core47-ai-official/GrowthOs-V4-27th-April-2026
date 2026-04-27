import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Play } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useVideosData } from "@/hooks/useVideosData";

interface CurrentModuleCardProps {
  currentVideoId?: string | null;
}

const CurrentModuleCard: React.FC<CurrentModuleCardProps> = ({ currentVideoId }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { modules, loading } = useVideosData(user || undefined);

  const currentModule = React.useMemo(() => {
    if (!modules || modules.length === 0) return undefined;
    if (currentVideoId) {
      const byLesson = modules.find((m: any) =>
        m.lessons?.some((l: any) => String(l.id) === String(currentVideoId))
      );
      if (byLesson) return byLesson;
    }
    return modules[0];
  }, [modules, currentVideoId]);

  if (loading || !currentModule) return null;

  const lessons: any[] = Array.isArray(currentModule.lessons) ? currentModule.lessons : [];
  const watchedCount = lessons.filter((l: any) => l?.watched || l?.completed).length;
  const total = lessons.length || 1;
  const progress = Math.round((watchedCount / total) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{currentModule.title || "Current Module"}</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {watchedCount}/{total} lessons completed
        </p>
        <Progress value={progress} className="h-2 mt-2" />
      </CardHeader>
      <CardContent>
        <Button
          className="w-full"
          onClick={() => navigate('/videos')}
        >
          <Play className="w-4 h-4 mr-2" />
          Continue Learning
        </Button>
      </CardContent>
    </Card>
  );
};

export default CurrentModuleCard;
