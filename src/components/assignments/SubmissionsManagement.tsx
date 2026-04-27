import { useState, useEffect } from 'react';
import { notifyContentUnlocked } from '@/utils/notifyContentUnlocked';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Eye, MessageSquare, Clock, FileText, BookOpen, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCourses } from '@/hooks/useCourses';
import { logUserActivity, logAdminAction, ACTIVITY_TYPES } from '@/lib/activity-logger';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  content: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  assignment: {
    name: string;
    description?: string;
    mentor_id?: string;
    course_id?: string;
  };
  student: {
    full_name: string;
    email: string;
    student_id?: string;
    phone?: string;
  } | null;
}

interface SubmissionsManagementProps {
  userRole?: 'mentor' | 'admin' | 'superadmin' | 'support_member';
}

export function SubmissionsManagement({
  userRole
}: SubmissionsManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { enrolledCourses, isMultiCourseEnabled, loading: coursesLoading } = useCourses();
  
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCourse, setFilterCourse] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filteredSubmissions = submissions.filter(s => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return (
      s.student?.full_name?.toLowerCase().includes(q) ||
      s.student?.email?.toLowerCase().includes(q) ||
      s.student?.student_id?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    fetchSubmissions();
  }, [user, filterStatus, filterCourse]);
  const fetchSubmissions = async () => {
    if (!user) return;
    try {
      // MENTOR FILTERING: Get assignments assigned to mentor or unassigned
      if (userRole === 'mentor') {
        const { data: mentorAssignments, error: assignmentsError } = await supabase
          .from('assignments')
          .select('id')
          .or(`mentor_id.eq.${user.id},mentor_id.is.null`);
        
        if (assignmentsError) {
          console.error('Error fetching mentor assignments:', assignmentsError);
          throw assignmentsError;
        }
        
        if (!mentorAssignments || mentorAssignments.length === 0) {
          setSubmissions([]);
          setLoading(false);
          return;
        }
        
        const assignmentIds = mentorAssignments.map(a => a.id);
        
        // Fetch submissions for these assignments
        let query = supabase
          .from('submissions')
          .select('*')
          .in('assignment_id', assignmentIds)
          .order('created_at', { ascending: false });

        // Apply status filter if not 'all'
        if (filterStatus !== 'all') {
          query = query.eq('status', filterStatus);
        }

        const { data: submissionsData, error: submissionsError } = await query;
        if (submissionsError) {
          console.error('Error fetching submissions:', submissionsError);
          throw submissionsError;
        }
        
        if (!submissionsData || submissionsData.length === 0) {
          setSubmissions([]);
          setLoading(false);
          return;
        }

        // Get assignment and user data separately
        const studentIds = [...new Set(submissionsData.map(s => s.student_id))];
        const [assignmentsData, usersData, studentsData] = await Promise.all([
          supabase.from('assignments').select('id, name, description, mentor_id').in('id', assignmentIds),
          supabase.from('users').select('id, full_name, email, phone').in('id', studentIds),
          supabase.from('students').select('user_id, student_id').in('user_id', studentIds)
        ]);

        // Map the data to match the expected format
        const mappedSubmissions = submissionsData.map(submission => {
          const assignment = assignmentsData.data?.find(a => a.id === submission.assignment_id) || {
            name: 'Unknown Assignment',
            description: ''
          };
          const user = usersData.data?.find(u => u.id === submission.student_id);
          const studentRecord = studentsData.data?.find(s => s.user_id === submission.student_id);
          return {
            ...submission,
            assignment,
            student: user ? {
              full_name: user.full_name || 'Unknown Student',
              email: user.email || '',
              student_id: studentRecord?.student_id || undefined,
              phone: user.phone || undefined
            } : {
              full_name: 'Unknown Student',
              email: '',
              student_id: undefined,
              phone: undefined
            }
          };
        });
        setSubmissions(mappedSubmissions);
        setLoading(false);
        return;
      }

      // ADMIN/SUPERADMIN: Get all submissions
      let query = supabase.from('submissions').select('*').order('created_at', {
        ascending: false
      });

      // Apply status filter if not 'all'
      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }
      const {
        data: submissionsData,
        error: submissionsError
      } = await query;
      if (submissionsError) {
        console.error('Error fetching submissions:', submissionsError);
        throw submissionsError;
      }
      if (!submissionsData || submissionsData.length === 0) {
        setSubmissions([]);
        setLoading(false);
        return;
      }

      // Get assignment and user data separately
      const assignmentIds = [...new Set(submissionsData.map(s => s.assignment_id))];
      const studentIds = [...new Set(submissionsData.map(s => s.student_id))];
      const [assignmentsData, usersData, studentsData] = await Promise.all([
        supabase.from('assignments').select('id, name, description, mentor_id').in('id', assignmentIds),
        supabase.from('users').select('id, full_name, email, phone').in('id', studentIds),
        supabase.from('students').select('user_id, student_id').in('user_id', studentIds)
      ]);

      // Map the data to match the expected format
      const mappedSubmissions = submissionsData.map(submission => {
        const assignment = assignmentsData.data?.find(a => a.id === submission.assignment_id) || {
          name: 'Unknown Assignment',
          description: ''
        };
        const user = usersData.data?.find(u => u.id === submission.student_id);
        const studentRecord = studentsData.data?.find(s => s.user_id === submission.student_id);
        return {
          ...submission,
          assignment,
          student: user ? {
            full_name: user.full_name || 'Unknown Student',
            email: user.email || '',
            student_id: studentRecord?.student_id || undefined,
            phone: user.phone || undefined
          } : {
            full_name: 'Unknown Student',
            email: '',
            student_id: undefined,
            phone: undefined
          }
        };
      });
      setSubmissions(mappedSubmissions);
    } catch (error) {
      console.error('Fetch submissions error:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch submissions',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };
  const handleReviewSubmission = async (submissionId: string, status: 'approved' | 'declined') => {
    try {
      const {
        error
      } = await supabase.from('submissions').update({
        status,
        notes: reviewNotes.trim() || null,
        updated_at: new Date().toISOString()
      }).eq('id', submissionId);
      if (error) throw error;
      
      // Log approval/decline activity to the student's activity feed
      const reviewedSubmission = submissions.find(s => s.id === submissionId);
      if (reviewedSubmission) {
        logUserActivity({
          user_id: reviewedSubmission.student_id,
          activity_type: status === 'approved' ? ACTIVITY_TYPES.ASSIGNMENT_APPROVED : ACTIVITY_TYPES.ASSIGNMENT_DECLINED,
          reference_id: reviewedSubmission.assignment_id,
          metadata: {
            assignment_name: reviewedSubmission.assignment.name,
            reviewed_by: user?.full_name || user?.email || 'Admin',
            notes: reviewNotes.trim() || undefined,
            timestamp: new Date().toISOString()
          }
        });

        // Log to admin_logs with target_user_id
        logAdminAction({
          performedBy: user?.id || null,
          targetUserId: reviewedSubmission.student_id,
          entityType: 'assignment',
          entityId: reviewedSubmission.assignment_id,
          action: status === 'approved' ? ACTIVITY_TYPES.ASSIGNMENT_APPROVED : ACTIVITY_TYPES.ASSIGNMENT_DECLINED,
          description: `Assignment "${reviewedSubmission.assignment.name}" ${status} for ${reviewedSubmission.student?.full_name || 'student'}`,
          data: {
            assignment_name: reviewedSubmission.assignment.name,
            student_name: reviewedSubmission.student?.full_name,
            notes: reviewNotes.trim() || null,
          }
        });

        // Send email notification to the student
        const studentEmail = reviewedSubmission.student?.email;
        const studentName = reviewedSubmission.student?.full_name || 'Student';
        const assignmentName = reviewedSubmission.assignment.name;
        const reviewerName = user?.full_name || user?.email || 'Your instructor';
        
        if (studentEmail) {
          const emailSubject = status === 'approved'
            ? `✅ Assignment Approved: ${assignmentName}`
            : `❌ Assignment Declined: ${assignmentName}`;
          const emailBody = status === 'approved'
            ? `Hi ${studentName},\n\nGreat news! Your assignment "${assignmentName}" has been approved by ${reviewerName}.${reviewNotes.trim() ? `\n\nFeedback: ${reviewNotes.trim()}` : ''}\n\nKeep up the great work!`
            : `Hi ${studentName},\n\nYour assignment "${assignmentName}" has been reviewed by ${reviewerName} and needs revision.${reviewNotes.trim() ? `\n\nFeedback: ${reviewNotes.trim()}` : ''}\n\nPlease review the feedback and resubmit.`;

          supabase.from('email_queue').insert({
            user_id: reviewedSubmission.student_id,
            recipient_email: studentEmail,
            recipient_name: studentName,
            email_type: 'assignment_review',
            status: 'pending',
            credentials: {
              subject: emailSubject,
              body: emailBody,
              assignment_name: assignmentName,
              review_status: status,
              reviewer_name: reviewerName,
              notes: reviewNotes.trim() || null,
            }
          }).then(({ error: emailErr }) => {
            if (emailErr) console.warn('Failed to queue review email:', emailErr);
          });
        }
      }

      toast({
        title: 'Success',
        description: `Submission ${status} successfully`
      });
      
      // If approved, trigger a real-time update to refresh unlock status for all students
      if (status === 'approved') {
        // Notify all connected clients about the approval
        await supabase.channel('submission-approvals').send({
          type: 'broadcast',
          event: 'submission_approved',
          payload: { submissionId, timestamp: Date.now() }
        });

        // Find the submission to get student and assignment info
        const approvedSubmission = submissions.find(s => s.id === submissionId);
        if (approvedSubmission) {
          // Find the recording linked to this assignment, then find the NEXT recording that just got unlocked
          const { data: assignmentRecording } = await supabase
            .from('available_lessons')
            .select('id, sequence_order')
            .eq('assignment_id', approvedSubmission.assignment_id)
            .single();

          if (assignmentRecording) {
            // Get the next recording in sequence (the one that just got unlocked)
            const { data: nextRecording } = await supabase
              .from('available_lessons')
              .select('id')
              .gt('sequence_order', assignmentRecording.sequence_order)
              .order('sequence_order', { ascending: true })
              .limit(1)
              .single();

            if (nextRecording) {
              notifyContentUnlocked(approvedSubmission.student_id, nextRecording.id);
            }
          }
        }
      }
      
      setSelectedSubmission(null);
      setReviewNotes('');
      fetchSubmissions();
    } catch (error: any) {
      console.error('Error reviewing submission:', error);
      const isHttpPostError = error?.message?.includes('http_post') || error?.code === '42883';
      toast({
        title: 'Error',
        description: isHttpPostError
          ? 'A database webhook trigger is blocking approvals. Please ask your admin to check Supabase Database Webhooks on the submissions table, or run: CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;'
          : 'Failed to review submission',
        variant: 'destructive',
        duration: isHttpPostError ? 15000 : 5000,
      });
    }
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800';
      case 'declined':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800';
      case 'pending':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };
  const getTitle = () => {
    switch (userRole) {
      case 'mentor':
        return 'My Students\' Submissions';
      case 'admin':
        return 'Assignment Submissions';
      case 'superadmin':
        return 'Assignment Submissions';
      default:
        return 'Assignment Submissions';
    }
  };
  const getDescription = () => {
    switch (userRole) {
      case 'mentor':
        return 'Review and approve submissions from your assigned students';
      case 'admin':
        return 'Review and approve all student submissions';
      case 'superadmin':
        return 'Review and approve all student submissions';
      default:
        return 'Review and approve student submissions';
    }
  };
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading submissions...</div>;
  }
  return <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold header-accent">Submissions Management</h1>
          <p className="text-muted-foreground mt-1">Manage assignment submissions and their assignments</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {/* Search input */}
          <div className="relative w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Course filter for multi-course mode */}
          {isMultiCourseEnabled && enrolledCourses.length > 1 && (
            <Select value={filterCourse} onValueChange={setFilterCourse}>
              <SelectTrigger className="w-[180px]">
                <BookOpen className="w-4 h-4 mr-2" />
                <SelectValue placeholder="All Courses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {enrolledCourses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          <Button variant={filterStatus === 'all' ? 'default' : 'outline'} onClick={() => setFilterStatus('all')} className={filterStatus === 'all' ? 'bg-primary text-primary-foreground shadow-medium' : ''}>
            All
          </Button>
          <Button variant={filterStatus === 'pending' ? 'default' : 'outline'} onClick={() => setFilterStatus('pending')} className={filterStatus === 'pending' ? 'bg-primary text-primary-foreground shadow-medium' : ''}>
            Pending
          </Button>
          <Button variant={filterStatus === 'approved' ? 'default' : 'outline'} onClick={() => setFilterStatus('approved')} className={filterStatus === 'approved' ? 'bg-primary text-primary-foreground shadow-medium' : ''}>
            Approved
          </Button>
          <Button variant={filterStatus === 'declined' ? 'default' : 'outline'} onClick={() => setFilterStatus('declined')} className={filterStatus === 'declined' ? 'bg-primary text-primary-foreground shadow-medium' : ''}>
            Declined
          </Button>
        </div>
      </div>

      {/* All Submissions Section */}
      <div className="section-surface">
        <div className="p-6 section-header rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="icon-chip">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">All Submissions</h2>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          {filteredSubmissions.length === 0 ? <div className="text-center py-12">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageSquare className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No submissions found</h3>
              <p className="text-muted-foreground">
                {userRole === 'mentor' ? "No submissions from your assigned students yet." : "No submissions available to review at the moment."}
              </p>
            </div> : <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-semibold">Student</TableHead>
                  <TableHead className="font-semibold">Assignment</TableHead>
                  <TableHead className="font-semibold">Submitted</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map(submission => <TableRow key={submission.id} className="table-row-hover">
                    <TableCell className="bg-white">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                          <span className="text-xs font-semibold text-foreground/80">
                            {submission.student.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{submission.student.full_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {submission.student.student_id || submission.student.email}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="bg-white">
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                        {submission.assignment.name}
                      </Badge>
                    </TableCell>
                    <TableCell className="bg-white">{new Date(submission.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="bg-white">
                      <Badge className={`${getStatusColor(submission.status)} font-medium`}>
                        {submission.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="bg-white">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" onClick={() => {
                      setSelectedSubmission(submission);
                      setReviewNotes(submission.notes || '');
                    }} className="hover:bg-gray-50">
                            <Eye className="w-4 h-4 mr-2" />
                            Review
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader className="pb-4">
                            <DialogTitle className="text-2xl font-bold flex items-center space-x-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                <Eye className="w-4 h-4 text-primary" />
                              </div>
                              <span>Review Submission</span>
                            </DialogTitle>
                          </DialogHeader>
                          {selectedSubmission && <div className="space-y-8">
                              <div className="grid grid-cols-2 gap-6">
                                <div className="bg-muted/30 rounded-xl p-5">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <span className="text-xs font-semibold text-primary">
                                        {selectedSubmission.student.full_name.charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <h3 className="font-semibold text-lg">Student Information</h3>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="font-medium">{selectedSubmission.student.full_name}</p>
                                    <p className="text-sm text-muted-foreground">{selectedSubmission.student.email}</p>
                                    {selectedSubmission.student.student_id && (
                                      <p className="text-sm text-muted-foreground">ID: {selectedSubmission.student.student_id}</p>
                                    )}
                                    {selectedSubmission.student.phone && (
                                      <p className="text-sm text-muted-foreground">Phone: {selectedSubmission.student.phone}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="bg-muted/30 rounded-xl p-5">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <FileText className="w-4 h-4 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-lg">Assignment Details</h3>
                                  </div>
                                  <div className="space-y-2">
                                    <p className="font-medium">{selectedSubmission.assignment.name}</p>
                                    <div className="flex items-center space-x-2">
                                      <Clock className="w-4 h-4 text-muted-foreground" />
                                      <p className="text-sm text-muted-foreground">
                                        Submitted: {new Date(selectedSubmission.created_at).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-card/50 rounded-xl p-6 border-2 border-border/60">
                                <div className="flex items-center space-x-2 mb-4">
                                  <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                    <MessageSquare className="w-4 h-4 text-primary" />
                                  </div>
                                  <h3 className="font-semibold text-lg">Submission Content</h3>
                                </div>
                                <div className="bg-muted/50 rounded-lg p-5">
                                  <p className="whitespace-pre-wrap leading-relaxed text-foreground">{selectedSubmission.content}</p>
                                </div>
                              </div>

                              {selectedSubmission.status === 'pending' && <div className="space-y-6">
                                  <div className="bg-muted/30 rounded-xl p-5">
                                    <label className="block text-sm font-semibold mb-3 flex items-center space-x-2">
                                      <MessageSquare className="w-4 h-4 text-primary" />
                                      <span>Review Notes</span>
                                    </label>
                                    <Textarea value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} placeholder="Add feedback and notes for the student..." rows={4} className="border-2 bg-background/50 focus:bg-background transition-colors" />
                                  </div>
                                  <div className="flex gap-4">
                        <Button onClick={() => handleReviewSubmission(selectedSubmission.id, 'approved')} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-soft">
                                      <CheckCircle className="w-4 h-4 mr-2" />
                                      Approve
                                    </Button>
                                    <Button onClick={() => handleReviewSubmission(selectedSubmission.id, 'declined')} variant="outline" className="flex-1 border-red-200 hover:border-red-300 text-red-700 hover:bg-red-50">
                                      <XCircle className="w-4 h-4 mr-2" />
                                      Decline
                                    </Button>
                                  </div>
                                </div>}

                              {selectedSubmission.status !== 'pending' && <div className="bg-muted/30 rounded-xl p-6">
                                  <div className="flex items-center space-x-2 mb-4">
                                    <div className="w-6 h-6 bg-primary/10 rounded-lg flex items-center justify-center">
                                      <CheckCircle className="w-4 h-4 text-primary" />
                                    </div>
                                    <h3 className="font-semibold text-lg">Review Status</h3>
                                  </div>
                                  <Badge className={`${getStatusColor(selectedSubmission.status)} font-medium text-base px-4 py-2`}>
                                    {selectedSubmission.status.toUpperCase()}
                                  </Badge>
                                  {selectedSubmission.notes && <div className="mt-4 p-4 bg-background/50 rounded-lg border">
                                      <p className="font-medium mb-2 flex items-center space-x-2">
                                        <MessageSquare className="w-4 h-4" />
                                        <span>Feedback Notes:</span>
                                      </p>
                                      <p className="text-muted-foreground leading-relaxed">{selectedSubmission.notes}</p>
                                    </div>}
                                </div>}
                            </div>}
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>)}
              </TableBody>
            </Table>}
        </div>
      </div>
    </div>;
}