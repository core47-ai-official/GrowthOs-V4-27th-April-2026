import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Clock, CheckCircle, XCircle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRecordingUnlocks } from '@/hooks/useRecordingUnlocks';
import { EnhancedStudentSubmissionDialog } from './EnhancedStudentSubmissionDialog';
import { useSearchParams } from 'react-router-dom';
interface Assignment {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  submission_type: 'text' | 'links' | 'attachments';
  recording?: {
    id: string;
    recording_title: string;
    sequence_order: number;
  };
}
interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  notes?: string;
  created_at: string;
  version: number;
}
export function StudentAssignmentList({ filterMode = 'unlocked' }: { filterMode?: 'unlocked' | 'submitted' }) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const {
    isRecordingUnlocked,
    loading: unlocksLoading
  } = useRecordingUnlocks();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [watchedRecordingIds, setWatchedRecordingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchParams] = useSearchParams();
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  // Listen for real-time submission updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('assignment-submissions');
    
    channel
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'submissions',
        filter: `student_id=eq.${user.id}`
      }, (payload) => {
        console.log('Submission change detected:', payload);
        fetchData(); // Refetch all data when submission changes
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);
  useEffect(() => {
    // Handle deep-link to a specific assignmentId if present
    if (!loading && !unlocksLoading && assignments.length > 0) {
      const assignmentId = searchParams.get('assignmentId');
      if (!assignmentId) return;
      const target = assignments.find(a => a.id === assignmentId);
      if (!target) return;
      const submission = getSubmissionStatus(assignmentId);
      // Check if assignment is unlocked (recording watched or no recording required)
      const eligible = submission ? true : isAssignmentUnlocked(target);
      if (eligible) {
        setSelectedAssignment(target);
        setIsDialogOpen(true);
      } else {
        toast({
          title: 'Assignment Locked',
          description: 'Watch the prerequisite recording to unlock this assignment.',
          variant: 'destructive'
        });
      }
    }
  }, [loading, unlocksLoading, assignments, submissions, watchedRecordingIds, searchParams]);
  const fetchData = async () => {
    if (!user) return;
    try {
      // Fetch assignments
      const {
        data: assignmentsData,
        error: assignmentsError
      } = await supabase.from('assignments').select('*, submission_type').order('created_at', {
        ascending: false
      });
      if (assignmentsError) throw assignmentsError;

      // Fetch recordings separately to get assignment linked recordings
      const {
        data: recordingsData,
        error: recordingsError
      } = await supabase.from('available_lessons').select('id, recording_title, sequence_order, assignment_id');
      if (recordingsError) throw recordingsError;

      // Fetch user's submissions with proper ordering
      const {
        data: submissionsData,
        error: submissionsError
      } = await supabase
        .from('submissions')
        .select('*')
        .eq('student_id', user.id)
        .order('version', { ascending: false })
        .order('created_at', { ascending: false });
      if (submissionsError) throw submissionsError;

      // Fetch recording views (watched status)
      const {
        data: viewsData,
        error: viewsError
      } = await supabase.from('recording_views').select('recording_id, watched').eq('user_id', user.id);
      if (viewsError) throw viewsError;
      const watchedIds = new Set<string>((viewsData || []).filter(v => v.watched).map(v => v.recording_id));
      // Combine assignments with their recordings
      const assignmentsWithRecordings = (assignmentsData || []).map(assignment => {
        const recording = recordingsData?.find(r => r.assignment_id === assignment.id);
        return {
          ...assignment,
          submission_type: assignment.submission_type as 'text' | 'links' | 'attachments',
          recording: recording ? {
            id: recording.id,
            recording_title: recording.recording_title,
            sequence_order: recording.sequence_order
          } : null
        };
      });
      
      setAssignments(assignmentsWithRecordings);
      setSubmissions(submissionsData || []);
      setWatchedRecordingIds(watchedIds);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch assignments',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const getSubmissionStatus = (assignmentId: string) => {
    // Get the latest submission for this assignment (highest version or most recent)
    const assignmentSubmissions = submissions.filter(s => s.assignment_id === assignmentId);
    if (assignmentSubmissions.length === 0) return undefined;
    
    // Sort by version descending, then by created_at descending
    return assignmentSubmissions.sort((a, b) => {
      if (a.version !== b.version) {
        return b.version - a.version;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })[0];
  };
  const getStatusBadge = (submission?: Submission) => {
    if (!submission) {
      return;
    }
    switch (submission.status) {
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>;
      case 'declined':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>;
      case 'pending':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            <Clock className="w-3 h-3 mr-1" />
            Under Review
          </Badge>;
      default:
        return null;
    }
  };
  const handleSubmissionComplete = () => {
    fetchData();
  };
  if (loading || unlocksLoading) {
    return <div className="flex justify-center items-center h-64">Loading assignments...</div>;
  }

  // Build filtered lists based on selected tab
  const isAssignmentUnlocked = (assignment: Assignment) => {
    // If assignment has no linked recording, it's always available
    if (!assignment.recording) return true;
    
    const linkedRecordingId = assignment.recording.id;
    
    // Assignment is available if the linked recording is UNLOCKED (not just watched)
    // This prevents a deadlock where the recording is locked waiting for assignment submission
    // but the assignment isn't visible because the recording hasn't been watched yet
    return isRecordingUnlocked(linkedRecordingId) || watchedRecordingIds.has(linkedRecordingId);
  };

  let availableAssignments: Assignment[] = [];
  if (filterMode === 'submitted') {
    availableAssignments = assignments.filter(a => !!getSubmissionStatus(a.id));
  } else {
    // Unlocked
    availableAssignments = assignments.filter(a => isAssignmentUnlocked(a));
  }
  return <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-3xl font-bold">My Assignments</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Complete and submit your course assignments</p>
      </div>

      {availableAssignments.length === 0 ? <Card>
          <CardContent className="text-center py-8">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No assignments available</h3>
            <p className="text-muted-foreground">
              Watch the prerequisite recordings to unlock assignments.
            </p>
          </CardContent>
        </Card> : <div className="grid gap-6">
          {availableAssignments.map(assignment => {
        const submission = getSubmissionStatus(assignment.id);
        const hasSubmitted = !!submission;
        return <Card key={assignment.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">{assignment.name}</CardTitle>
                      {assignment.description && <p className="text-muted-foreground mt-1">{assignment.description}</p>}
                      <p className="text-sm text-muted-foreground mt-2">
                        Assigned: {new Date(assignment.created_at).toLocaleDateString()}
                      </p>
                      {assignment.recording && <p className="text-sm text-muted-foreground">
                          <Lock className="w-3 h-3 inline mr-1" />
                          Unlocked after: {assignment.recording.recording_title}
                        </p>}
                    </div>
                    {getStatusBadge(submission)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-center">
                    <div>
                      {submission?.notes && <div className="text-sm">
                          <p className="font-medium">Instructor Notes:</p>
                          <p className="text-muted-foreground">{submission.notes}</p>
                        </div>}
                    </div>
                    <Button onClick={() => {
                setSelectedAssignment(assignment);
                setIsDialogOpen(true);
              }} variant={hasSubmitted ? "outline" : "default"} disabled={submission?.status === 'approved'}>
                      {submission?.status === 'approved' ? 'Completed' : submission?.status === 'declined' ? 'Resubmit' : hasSubmitted ? 'View Submission' : 'Submit Assignment'}
                    </Button>
                  </div>
                </CardContent>
              </Card>;
      })}
        </div>}

      {selectedAssignment && <EnhancedStudentSubmissionDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} assignment={selectedAssignment} userId={user?.id || ''} hasSubmitted={!!getSubmissionStatus(selectedAssignment.id) && getSubmissionStatus(selectedAssignment.id)?.status !== 'declined'} onSubmissionComplete={handleSubmissionComplete} />}
    </div>;
}