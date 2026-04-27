import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeQuery, safeMaybeSingle } from '@/lib/database-safety';
import { safeLogger } from '@/lib/safe-logger';
import type { UserBasicResult, UserWithRoleResult } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, AlertCircle, Clock, CheckCircle, Reply, User, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudentEnrollment {
  course_title?: string;
  pathway_name?: string;
  batch_name?: string;
}

interface SupportTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category?: string | null;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  assigned_to?: string | null;
  users: {
    full_name: string;
    email: string;
    student_id?: string | null;
    batch_name?: string | null;
    enrollments: StudentEnrollment[];
  };
}

interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_internal: boolean;
  created_at: string;
  users: {
    full_name: string;
    role: string;
  };
}

export function SupportManagement() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketReplies, setTicketReplies] = useState<TicketReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [filterType, setFilterType] = useState<string>('all');
  const { toast } = useToast();

  // Priority order for sorting (higher number = higher priority)
  const priorityOrder: Record<string, number> = {
    urgent: 4,
    high: 3,
    medium: 2,
    low: 1
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      // First get all tickets
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      // Then get user data for each ticket
      const ticketsWithUsers = await Promise.all(
        (ticketsData || []).map(async (ticket) => {
          const userResult = await safeQuery<UserBasicResult>(
            supabase
              .from('users')
              .select('full_name, email')
              .eq('id', ticket.user_id)
              .single(),
            `fetch user data for ticket ${ticket.id}`
          );
          const userData = userResult.data;

          // Get student_id from students table if user is a student
          const studentResult = await safeMaybeSingle(
            supabase
            .from('students')
            .select('id, student_id')
            .eq('user_id', ticket.user_id)
            .maybeSingle(),
            `fetch student data for user ${ticket.user_id}`
          );
          const studentData = studentResult.data as { id: string; student_id: string } | null;

          // Get enrollments with batch, course, and pathway info
          let enrollments: StudentEnrollment[] = [];
          let batchName: string | null = null;
          
          if (studentData?.id) {
            const { data: enrollmentData } = await supabase
              .from('course_enrollments')
              .select(`
                course_id,
                pathway_id,
                batch_id,
                courses(title),
                learning_pathways(name),
                batches(name)
              `)
              .eq('student_id', studentData.id)
              .in('status', ['active', 'completed']);

            if (enrollmentData && enrollmentData.length > 0) {
              enrollments = enrollmentData.map((e: any) => ({
                course_title: e.courses?.title,
                pathway_name: e.learning_pathways?.name,
                batch_name: e.batches?.name
              }));
              // Get the first batch name found
              batchName = enrollmentData.find((e: any) => e.batches?.name)?.batches?.name || null;
            }
          }

          return {
            ...ticket,
            users: {
              full_name: userData?.full_name || 'Unknown User',
              email: userData?.email || 'No Email',
              student_id: studentData?.student_id || null,
              batch_name: batchName,
              enrollments
            }
          };
        })
      );

      setTickets(ticketsWithUsers as SupportTicket[]);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch support tickets',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketReplies = async (ticketId: string) => {
    try {
      // First get all replies
      const { data: repliesData, error: repliesError } = await supabase
        .from('support_ticket_replies')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (repliesError) throw repliesError;

      // Then get user data for each reply
      const repliesWithUsers = await Promise.all(
        (repliesData || []).map(async (reply) => {
          const userResult = await safeMaybeSingle<UserWithRoleResult>(
            supabase
              .from('users')
              .select('full_name, role')
              .eq('id', reply.user_id)
              .maybeSingle(),
            `fetch user data for reply ${reply.id}`
          );
          const userData = userResult.data;

          return {
            ...reply,
            users: {
              full_name: userData?.full_name || 'Deleted User',
              role: userData?.role || 'staff'
            }
          };
        })
      );

      setTicketReplies(repliesWithUsers);
    } catch (error) {
      console.error('Error fetching replies:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch ticket replies',
        variant: 'destructive'
      });
    }
  };

  const handleReplyToTicket = async (ticketId: string) => {
    if (!replyMessage.trim()) return;

    try {
      const currentUser = await supabase.auth.getUser();
      if (!currentUser.data.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('support_ticket_replies')
        .insert({
          ticket_id: ticketId,
          user_id: currentUser.data.user.id,
          message: replyMessage,
          is_internal: false // Changed from is_staff to is_internal based on schema
        });

      if (error) throw error;
      // Update ticket status to in_progress if it was open
      if (selectedTicket?.status === 'open') {
        await supabase
          .from('support_tickets')
          .update({ status: 'in_progress' })
          .eq('id', ticketId);
      }

      toast({
        title: 'Success',
        description: 'Reply sent successfully'
      });
      
      setReplyMessage('');
      fetchTicketReplies(ticketId);
      fetchTickets();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to send reply',
        variant: 'destructive'
      });
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      safeLogger.info('Updating ticket status:', { ticketId, status });
      
      const { data, error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      safeLogger.info('Update result:', { data });

      toast({
        title: 'Success',
        description: 'Ticket status updated successfully'
      });
      
      fetchTickets();
    } catch (error: any) {
      console.error('Update ticket status error:', error);
      toast({
        title: 'Error',
        description: `Failed to update ticket status: ${error.message}`,
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': 
      case 'in_progress': 
        return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'resolved': 
        return 'bg-green-100 text-green-800 hover:bg-green-100';
      case 'closed': 
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
      default: 
        return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-800 hover:bg-red-100';
      case 'high': return 'bg-orange-100 text-orange-800 hover:bg-orange-100';
      case 'medium': return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
      case 'low': return 'bg-green-100 text-green-800 hover:bg-green-100';
      default: return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
    }
  };
  const getTypeIcon = (type: string | null) => {
    switch (type) {
      case 'complaint': return <AlertCircle className="w-4 h-4" />;
      case 'feedback': return <MessageSquare className="w-4 h-4" />;
      case 'technical': return <Clock className="w-4 h-4" />;
      case 'billing': return <User className="w-4 h-4" />;
      default: return <MessageSquare className="w-4 h-4" />;
    }
  };

  const filteredTickets = tickets
    .filter(ticket => {
      // Combine open and in_progress as "active" tickets
      const statusMatch = filterStatus === 'all' 
        || (filterStatus === 'active' && (ticket.status === 'open' || ticket.status === 'in_progress'))
        || ticket.status === filterStatus;
      const typeMatch = filterType === 'all' || (ticket.category && ticket.category === filterType);
      return statusMatch && typeMatch;
    })
    .sort((a, b) => {
      // Sort by priority (urgent > high > medium > low)
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading support tickets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight header-accent">Support Management</h1>
          <p className="text-muted-foreground text-lg">Manage student support tickets and complaints</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active (Open/In Progress)</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="complaint">Complaint</SelectItem>
            <SelectItem value="feedback">Feedback</SelectItem>
            <SelectItem value="technical">Technical</SelectItem>
            <SelectItem value="billing">Billing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="section-surface overflow-hidden">
        <CardHeader className="section-header">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="icon-chip"><MessageSquare className="w-4 h-4" /></div>
              <CardTitle>All Tickets</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
                {filteredTickets.map((ticket) => (
                  <TableRow key={ticket.id} className="table-row-hover">
                  <TableCell>
                    <div>
                      <div className="font-medium">{ticket.users.full_name}</div>
                      <div className="text-sm text-blue-600 font-medium">{ticket.users.email}</div>
                      <div className="text-sm text-muted-foreground">{ticket.users.student_id}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{ticket.title}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-xs">
                      {ticket.description}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTypeIcon(ticket.category)}
                      <span className="capitalize">{ticket.category || 'General'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`badge-pill ${getPriorityColor(ticket.priority)}`}>
                      {ticket.priority.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={`badge-pill ${getStatusColor(ticket.status)}`}>
                      {ticket.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedTicket(ticket);
                            fetchTicketReplies(ticket.id);
                          }}
                        >
                          <Reply className="w-4 h-4 mr-2" />
                          View & Reply
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Support Ticket Details</DialogTitle>
                        </DialogHeader>
                        {selectedTicket && (
                          <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-3">
                                <h3 className="font-semibold">Student Information</h3>
                                <div className="space-y-1">
                                  <p className="font-medium">{selectedTicket.users.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{selectedTicket.users.email}</p>
                                  <p className="text-sm text-muted-foreground">{selectedTicket.users.student_id}</p>
                                </div>
                                {selectedTicket.users.batch_name && (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">Batch:</span>
                                    <Badge variant="outline">{selectedTicket.users.batch_name}</Badge>
                                  </div>
                                )}
                                {selectedTicket.users.enrollments.length > 0 && (
                                  <div className="space-y-1">
                                    <span className="text-sm font-medium">Enrolled In:</span>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {selectedTicket.users.enrollments.map((enrollment, idx) => (
                                        <Badge 
                                          key={idx} 
                                          variant="secondary" 
                                          className="text-xs"
                                        >
                                          {enrollment.pathway_name 
                                            ? `${enrollment.pathway_name} (Pathway)` 
                                            : enrollment.course_title || 'Unknown Course'}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Type:</span>
                                  <Badge variant="outline">{selectedTicket.category || 'General'}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Priority:</span>
                                  <Badge className={`badge-pill ${getPriorityColor(selectedTicket.priority)}`}>
                                    {selectedTicket.priority}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold">Status:</span>
                                  <Badge className={`px-3 py-1 font-medium ${
                                    selectedTicket.status === 'open' 
                                      ? 'bg-red-100 text-red-800 border-red-200' 
                                      : selectedTicket.status === 'in_progress'
                                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                                      : selectedTicket.status === 'resolved'
                                      ? 'bg-green-100 text-green-800 border-green-200'
                                      : 'bg-gray-100 text-gray-800 border-gray-200'
                                  }`}>
                                    {selectedTicket.status.replace('_', ' ').toUpperCase()}
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h3 className="font-semibold mb-2">Issue Description</h3>
                              <div className="p-4 bg-muted/50 rounded-lg">
                                <h4 className="font-medium mb-2">{selectedTicket.title}</h4>
                                <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                                <p className="text-xs text-muted-foreground mt-2">
                                  Created: {new Date(selectedTicket.created_at).toLocaleString()}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h3 className="font-semibold">Conversation History</h3>
                              <div className="max-h-60 overflow-y-auto space-y-3 p-4 bg-muted/30 rounded-lg">
                                {ticketReplies.length === 0 ? (
                                  <p className="text-muted-foreground text-sm">No replies yet</p>
                                ) : (
                                  ticketReplies.map((reply) => (
                                    <div
                                      key={reply.id}
                                      className={`p-3 rounded-lg max-w-[85%] ${
                                        reply.users.role !== 'student' 
                                          ? 'bg-primary/10 border border-primary/20 ml-auto text-right' 
                                          : 'bg-muted border border-border mr-auto'
                                      }`}
                                    >
                                      <div className={`flex items-start gap-2 mb-2 ${
                                        reply.users.role !== 'student' ? 'justify-end' : 'justify-start'
                                      }`}>
                                        {reply.users.role === 'student' && (
                                          <span className="font-medium text-sm">{reply.users.full_name}</span>
                                        )}
                                        <span className="text-xs text-muted-foreground">
                                          {new Date(reply.created_at).toLocaleString()}
                                        </span>
                                        {reply.users.role !== 'student' && (
                                          <>
                                            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                                              Staff
                                            </Badge>
                                            <span className="font-medium text-sm">{reply.users.full_name}</span>
                                          </>
                                        )}
                                      </div>
                                      <p className={`text-sm whitespace-pre-wrap ${
                                        reply.users.role !== 'student' ? 'text-right' : 'text-left'
                                      }`}>{reply.message}</p>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h3 className="font-semibold">Update Status</h3>
                              <div className="flex gap-2 flex-wrap">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateTicketStatus(selectedTicket.id, 'open')}
                                  disabled={selectedTicket.status === 'open'}
                                >
                                  Mark Open
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateTicketStatus(selectedTicket.id, 'in_progress')}
                                  disabled={selectedTicket.status === 'in_progress'}
                                >
                                  Mark In Progress
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateTicketStatus(selectedTicket.id, 'resolved')}
                                  disabled={selectedTicket.status === 'resolved'}
                                  className="bg-green-50 text-green-700 hover:bg-green-100"
                                >
                                  Mark Resolved
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => updateTicketStatus(selectedTicket.id, 'closed')}
                                  disabled={selectedTicket.status === 'closed'}
                                >
                                  Close Ticket
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <h3 className="font-semibold">Send Reply</h3>
                              <Textarea
                                value={replyMessage}
                                onChange={(e) => setReplyMessage(e.target.value)}
                                placeholder="Type your reply here..."
                                rows={4}
                              />
                              <Button
                                onClick={() => handleReplyToTicket(selectedTicket.id)}
                                disabled={!replyMessage.trim()}
                                className="w-full"
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Send Reply
                              </Button>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}