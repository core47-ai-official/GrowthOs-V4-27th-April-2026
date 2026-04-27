import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useRecoveryRate, useInactiveStudents, useRecoveryMessages, useTrackedStudents, useDailyCheckHistory, useTriggerDailyCheck } from '@/hooks/useRecoveryRate';
import { format } from 'date-fns';
import { AlertTriangle, MessageCircle, TrendingUp, Users, Play, History, RefreshCw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const RecoveryManagement = () => {
  const { toast } = useToast();
  const { data: recoveryStats, isLoading: statsLoading } = useRecoveryRate();
  const { data: inactiveStudents, isLoading: inactiveLoading } = useInactiveStudents();
  const { data: recoveryMessages, isLoading: messagesLoading } = useRecoveryMessages();
  const { data: trackedStudents, isLoading: trackedLoading } = useTrackedStudents();
  const { data: checkHistory, isLoading: historyLoading } = useDailyCheckHistory();
  const triggerCheck = useTriggerDailyCheck();

  const getStatusBadge = (message_status?: string, recovery_successful?: boolean | null) => {
    // Prioritize new message_status field if available
    if (message_status) {
      switch (message_status) {
        case 'recovered':
          return <Badge variant="default" className="bg-success text-success-foreground">Recovered</Badge>;
        case 'sent':
          return <Badge variant="default" className="bg-blue-500 text-white">Sent</Badge>;
        case 'failed':
          return <Badge variant="destructive">Failed</Badge>;
        case 'pending':
        default:
          return <Badge variant="secondary">Pending</Badge>;
      }
    }
    
    // Fallback to old recovery_successful field
    if (recovery_successful === true) {
      return <Badge variant="default" className="bg-success text-success-foreground">Recovered</Badge>;
    } else if (recovery_successful === false) {
      return <Badge variant="destructive">Failed</Badge>;
    } else {
      return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const handleTriggerCheck = async () => {
    try {
      await triggerCheck.mutateAsync();
      toast({
        title: "Daily check triggered",
        description: "Recovery check is running. Results will appear shortly.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to trigger daily check. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Student Recovery Management</h2>
        </div>
        <Button 
          onClick={handleTriggerCheck} 
          disabled={triggerCheck.isPending}
          size="sm"
        >
          {triggerCheck.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Run Check Now
            </>
          )}
        </Button>
      </div>

      {/* Recovery Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recovery Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{recoveryStats?.recovery_rate || 0}%</div>
                <p className="text-xs text-muted-foreground">
                  {recoveryStats?.successful_recoveries || 0} of {recoveryStats?.total_messages_sent || 0} messages
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{recoveryStats?.total_messages_sent || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful Recoveries</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-success">{recoveryStats?.successful_recoveries || 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">At Risk Students</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {inactiveLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold text-destructive">{inactiveStudents?.length || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="inactive" className="w-full">
        <TabsList>
          <TabsTrigger value="inactive">Inactive Students</TabsTrigger>
          <TabsTrigger value="tracked">
            <Users className="mr-2 h-4 w-4" />
            Tracked ({trackedStudents?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="messages">Recovery Messages</TabsTrigger>
          <TabsTrigger value="history">
            <History className="mr-2 h-4 w-4" />
            Daily Check History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="inactive" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Students at Risk (3+ Days Inactive)</CardTitle>
              <CardDescription>
                Students who haven't been active for 3 or more days and are eligible for recovery messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inactiveLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {inactiveStudents?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No inactive students found. Great job on student engagement!
                    </p>
                  ) : (
                    inactiveStudents?.map((student) => (
                      <div key={student.user_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <h4 className="font-medium">{student.full_name}</h4>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                          {student.phone && (
                            <p className="text-sm text-muted-foreground">📱 {student.phone}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="outline" className="mb-1">
                            {student.days_inactive} days inactive
                          </Badge>
                          <p className="text-xs text-muted-foreground">
                            Last active: {format(new Date(student.last_active_at), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tracked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Currently Tracked Students</CardTitle>
              <CardDescription>
                Students in active recovery with pending or sent messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trackedLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {trackedStudents?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No students currently being tracked.
                    </p>
                  ) : (
                    trackedStudents?.map((student: any) => (
                      <div key={student.recovery_message_id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{student.full_name}</h4>
                            {student.recovery_cycle > 1 && (
                              <Badge variant="outline" className="text-xs">
                                Cycle {student.recovery_cycle}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{student.email}</p>
                          {student.phone && (
                            <p className="text-sm text-muted-foreground">📱 {student.phone}</p>
                          )}
                        </div>
                        <div className="text-right space-y-1">
                          {getStatusBadge(student.message_status)}
                          <p className="text-xs text-muted-foreground">
                            {student.days_inactive} days inactive
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Last checked: {student.last_check_date ? format(new Date(student.last_check_date), 'MMM dd') : 'Never'}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Recovery Messages</CardTitle>
              <CardDescription>
                Track recovery message attempts and their success rates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {messagesLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {recoveryMessages?.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No recovery messages sent yet.
                    </p>
                  ) : (
                    recoveryMessages?.map((message: any) => (
                      <div key={message.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{message.user?.full_name || 'Unknown User'}</h4>
                            {message.recovery_cycle && message.recovery_cycle > 1 && (
                              <Badge variant="outline" className="text-xs">
                                Cycle {message.recovery_cycle}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{message.user?.email || 'No email'}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {message.days_inactive} days inactive when messaged
                          </p>
                        </div>
                        <div className="text-right space-y-1">
                          {getStatusBadge(message.message_status, message.recovery_successful)}
                          <p className="text-xs text-muted-foreground">
                            Sent: {format(new Date(message.message_sent_at), 'MMM dd, yyyy HH:mm')}
                          </p>
                          {message.recovered_at && (
                            <p className="text-xs text-success">
                              Recovered: {format(new Date(message.recovered_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Check History</CardTitle>
              <CardDescription>
                Track daily recovery check runs and their results (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <Skeleton className="h-64 w-full" />
              ) : checkHistory?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No check history yet. Run your first check!
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Checked</TableHead>
                      <TableHead className="text-center">New Inactive</TableHead>
                      <TableHead className="text-center">Recovered</TableHead>
                      <TableHead className="text-center">Still Inactive</TableHead>
                      <TableHead>Completed At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {checkHistory?.map((check: any) => (
                      <TableRow key={check.id}>
                        <TableCell className="font-medium">
                          {format(new Date(check.check_date), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-center">{check.students_checked}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{check.newly_inactive}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="default" className="bg-success text-success-foreground">
                            {check.recovered}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{check.still_inactive}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {check.check_completed_at 
                            ? format(new Date(check.check_completed_at), 'HH:mm:ss')
                            : 'In progress'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};