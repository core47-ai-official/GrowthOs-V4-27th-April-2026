import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, FileText } from "lucide-react";
import { safeQuery } from '@/lib/database-safety';
import { logger } from '@/lib/logger';
import type { UserStatusResult } from '@/types/database';

interface Assignment {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  isUnlocked?: boolean;
}

interface Submission {
  assignment_id: string;
  status: string;
}

interface NextAssignmentProps {
  userId?: string;
}

export const NextAssignment = ({ userId }: NextAssignmentProps) => {
  const [nextAssignment, setNextAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (userId) {
      fetchNextAssignment();
    }
  }, [userId]);

  const fetchNextAssignment = async () => {
    try {
      if (!userId) return;

      // Check user's status
      const userResult = await safeQuery<UserStatusResult>(
        supabase
          .from('users')
          .select('status')
          .eq('id', userId)
          .single(),
        `fetch user status for ${userId}`
      );
      
      if (!userResult.success) throw userResult.error;
      
      // If user is inactive, don't show any assignments
      if (userResult.data?.status !== 'active') {
        setNextAssignment(null);
        setLoading(false);
        return;
      }

      // Fetch all assignments
      const { data: assignments, error: assignmentsError } = await supabase
        .from('assignments')
        .select('*')
        .order('created_at');

      if (assignmentsError) throw assignmentsError;

      // Fetch user's submissions
      const { data: submissions, error: submissionsError } = await supabase
        .from('submissions')
        .select('assignment_id, status')
        .eq('student_id', userId);

      if (submissionsError) throw submissionsError;

      // Find the first assignment that's not completed
      const nextAssignment = assignments?.find(assignment => {
        const submission = submissions?.find(s => s.assignment_id === assignment.id);
        return !submission || submission.status !== 'approved';
      });

      setNextAssignment(nextAssignment || null);
    } catch (error) {
      logger.error('Error fetching next assignment:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssignment = () => {
    navigate('/assignments');
  };

  if (loading) {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5 text-orange-500" />
          Next Assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col flex-grow p-4">
        {nextAssignment ? (
          <>
            <div className="flex-grow space-y-2">
              <h3 className="font-medium text-sm leading-tight">{nextAssignment.name}</h3>
              <p className="text-xs text-muted-foreground">
                {nextAssignment.description || 'Complete this assignment to continue your progress.'}
              </p>
            </div>
            <div className="mt-auto pt-4">
              <Button 
                onClick={handleStartAssignment}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <FileText className="w-4 h-4 mr-2" />
                Start Assignment
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-grow">
              <p className="text-sm text-muted-foreground">
                No pending assignments
              </p>
            </div>
            <div className="mt-auto pt-4">
              <Button 
                onClick={handleStartAssignment}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="sm"
                disabled
              >
                <FileText className="w-4 h-4 mr-2" />
                Start Assignment
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};