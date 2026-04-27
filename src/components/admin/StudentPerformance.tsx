import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Award, Target } from 'lucide-react';

export const StudentPerformance = () => {
  // This would be populated with real data from the database
  const performanceData = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      moduleProgress: 75,
      assignmentsCompleted: 8,
      totalAssignments: 12,
      averageScore: 85,
      badges: ['Fast Learner', 'Assignment Master'],
      goals: { completed: 3, total: 5 }
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      moduleProgress: 90,
      assignmentsCompleted: 11,
      totalAssignments: 12,
      averageScore: 92,
      badges: ['Excellence', 'Top Performer', 'Module Champion'],
      goals: { completed: 4, total: 5 }
    },
    {
      id: 3,
      name: 'Mike Johnson',
      email: 'mike@example.com',
      moduleProgress: 45,
      assignmentsCompleted: 5,
      totalAssignments: 12,
      averageScore: 72,
      badges: ['Getting Started'],
      goals: { completed: 2, total: 5 }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Student Performance</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {performanceData.map((student) => (
          <Card key={student.id}>
            <CardHeader>
              <CardTitle className="text-lg">{student.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{student.email}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Module Progress */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Module Progress</span>
                  <span>{student.moduleProgress}%</span>
                </div>
                <Progress value={student.moduleProgress} className="h-2" />
              </div>

              {/* Assignment Completion */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Assignments</span>
                </div>
                <Badge variant="outline">
                  {student.assignmentsCompleted}/{student.totalAssignments}
                </Badge>
              </div>

              {/* Average Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Award className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm">Average Score</span>
                </div>
                <Badge className={student.averageScore >= 85 ? 'bg-green-500' : student.averageScore >= 70 ? 'bg-yellow-500' : 'bg-red-500'}>
                  {student.averageScore}%
                </Badge>
              </div>

              {/* Goals Progress */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  <span className="text-sm">Goals</span>
                </div>
                <Badge variant="outline">
                  {student.goals.completed}/{student.goals.total}
                </Badge>
              </div>

              {/* Badges */}
              <div>
                <p className="text-sm font-medium mb-2">Badges Earned</p>
                <div className="flex flex-wrap gap-1">
                  {student.badges.map((badge, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {badge}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Goal Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Goal Progress</span>
                  <span>{Math.round((student.goals.completed / student.goals.total) * 100)}%</span>
                </div>
                <Progress 
                  value={(student.goals.completed / student.goals.total) * 100} 
                  className="h-2" 
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Module Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">70%</div>
            <p className="text-sm text-muted-foreground">Across all students</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Assignment Completion Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">78%</div>
            <p className="text-sm text-muted-foreground">On-time submissions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Average Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">83%</div>
            <p className="text-sm text-muted-foreground">Class average</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};