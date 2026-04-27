import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Award, Trophy, CheckCircle, Target, Star } from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  completed: boolean;
  icon: string;
}

interface LeaderboardPosition {
  rank: number;
  total: number;
}

interface ProgressSummaryCardProps {
  milestones: Milestone[];
  leaderboardPosition: LeaderboardPosition | null;
}

export const ProgressSummaryCard: React.FC<ProgressSummaryCardProps> = ({
  milestones,
  leaderboardPosition,
}) => {
  const navigate = useNavigate();
  const completedMilestones = milestones.filter(m => m.completed).length;

  return (
    <Card className="hover:shadow-md transition-shadow duration-200 animate-fade-in" style={{ animationDelay: '300ms' }}>
      <Tabs defaultValue="milestones">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Your Progress</CardTitle>
            <TabsList className="h-8">
              <TabsTrigger value="milestones" className="text-xs px-3 h-7">
                <Award className="w-3 h-3 mr-1" />
                Milestones
              </TabsTrigger>
              <TabsTrigger value="rank" className="text-xs px-3 h-7">
                <Trophy className="w-3 h-3 mr-1" />
                Rank
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>

        <CardContent>
          <TabsContent value="milestones" className="mt-0">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-xs font-medium text-orange-600">
                  {completedMilestones} of {milestones.length} completed
                </span>
              </div>
              <Progress
                value={milestones.length > 0 ? (completedMilestones / milestones.length) * 100 : 0}
                className="h-1.5"
              />
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.id}
                    className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                      milestone.completed
                        ? 'bg-green-500/10 border border-green-500/20'
                        : 'bg-muted/20'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      milestone.completed ? 'bg-green-500' : 'bg-muted border border-muted-foreground/20'
                    }`}>
                      {milestone.completed ? (
                        <CheckCircle className="w-3 h-3 text-white" />
                      ) : (
                        <span className="text-sm">{milestone.icon}</span>
                      )}
                    </div>
                    <span className={`font-normal text-sm ${
                      milestone.completed ? 'text-green-700 dark:text-green-400' : 'text-foreground'
                    }`}>
                      {milestone.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="rank" className="mt-0">
            {leaderboardPosition ? (
              <div className="text-center space-y-3">
                <div className="text-4xl font-medium text-purple-600">
                  #{leaderboardPosition.rank}
                </div>
                <div className="space-y-1">
                  <p className="text-base font-medium text-foreground">Great progress!</p>
                  <p className="text-xs text-muted-foreground">
                    {leaderboardPosition.rank === 1
                      ? "You're leading the pack"
                      : `${leaderboardPosition.rank} of ${leaderboardPosition.total}`}
                  </p>
                </div>
                <div className="flex items-center justify-center space-x-1">
                  {[1, 2, 3].map(pos => (
                    <Star
                      key={pos}
                      className={`w-4 h-4 ${
                        pos <= 3 && leaderboardPosition.rank <= 3
                          ? 'text-yellow-500 fill-current'
                          : 'text-muted'
                      }`}
                    />
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/leaderboard')}
                  className="w-full text-xs"
                >
                  View Full Leaderboard
                </Button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="w-12 h-12 bg-purple-500/10 rounded-full mx-auto flex items-center justify-center">
                  <Target className="w-6 h-6 text-purple-500" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Start Your Journey</p>
                  <p className="text-xs text-muted-foreground">
                    Complete activities to see your ranking
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
};
