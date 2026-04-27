import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, Clock, CheckCircle } from "lucide-react";

interface NextAssignmentCardProps {
  nextAssignment: { id: string; name: string } | null;
  assignmentDueStatus: 'future' | 'overdue';
}

export const NextAssignmentCard: React.FC<NextAssignmentCardProps> = ({
  nextAssignment,
  assignmentDueStatus,
}) => {
  const navigate = useNavigate();

  return (
    <Card
      className={`hover:shadow-md transition-shadow duration-200 border-l-2 animate-fade-in cursor-pointer ${
        assignmentDueStatus === 'overdue' ? 'border-l-red-400' : 'border-l-orange-400'
      }`}
      style={{ animationDelay: '150ms' }}
    >
      <CardHeader className="pb-3">
        <CardTitle className={`flex items-center gap-2 text-base font-medium ${
          assignmentDueStatus === 'overdue' ? 'text-red-600' : 'text-orange-600'
        }`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            assignmentDueStatus === 'overdue' ? 'bg-red-500/10' : 'bg-orange-500/10'
          }`}>
            <Upload className="w-4 h-4" />
          </div>
          Next Assignment
        </CardTitle>
      </CardHeader>
      <CardContent>
        {nextAssignment ? (
          <div className="space-y-3">
            <div>
              <h3 className="font-normal text-foreground mb-2 line-clamp-2">
                {nextAssignment.name}
              </h3>
              <div className="flex items-center gap-2 text-xs">
                {assignmentDueStatus === 'overdue' ? (
                  <AlertCircle className="w-3 h-3 text-red-500" />
                ) : (
                  <Clock className="w-3 h-3 text-orange-500" />
                )}
                <span className={assignmentDueStatus === 'overdue' ? 'text-red-500' : 'text-orange-500'}>
                  {assignmentDueStatus === 'overdue' ? 'Past Due' : 'Due Soon'}
                </span>
              </div>
            </div>
            <Button
              onClick={() => navigate('/assignments')}
              className="w-full text-sm font-normal"
              variant={assignmentDueStatus === 'overdue' ? 'destructive' : 'default'}
              size="sm"
            >
              Submit Now
            </Button>
          </div>
        ) : (
          <div className="text-center py-6">
            <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">All assignments completed!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
