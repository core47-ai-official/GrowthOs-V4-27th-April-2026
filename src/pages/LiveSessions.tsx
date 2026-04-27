import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { RoleGuard } from "@/components/RoleGuard";
import { safeLogger } from '@/lib/safe-logger';
import { VideoPreviewDialog } from '@/components/VideoPreviewDialog';
import { InactiveLMSBanner } from '@/components/InactiveLMSBanner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Video, 
  Play,
  Calendar, 
  Clock, 
  Users, 
  CheckCircle
} from "lucide-react";

interface LiveSession {
  id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
  mentor_name: string;
  schedule_date: string;
  created_at: string;
  created_by: string;
  course_id?: string;
  batch_id?: string | null;
}

interface SessionAttendance {
  id: string;
  user_id: string;
  session_id: string;
  attended_at: string;
  created_at: string;
}

interface SessionCardProps {
  session: LiveSession;
  isUpcoming?: boolean;
  userLMSStatus: string;
  hasAttended: boolean;
  onJoin: (sessionId: string, sessionLink: string) => void;
  onWatchRecording: (title: string, url: string) => void;
}

const getSessionStatus = (session: LiveSession) => {
  const now = new Date();
  const startTime = new Date(session.start_time);
  const endTime = new Date(session.end_time);
  
  if (now < startTime) return { status: 'upcoming', color: 'bg-blue-100 text-blue-800' };
  if (now >= startTime && now <= endTime) return { status: 'live', color: 'bg-red-100 text-red-800' };
  return { status: 'completed', color: 'bg-gray-100 text-gray-800' };
};

const SessionCard = ({ session, isUpcoming, userLMSStatus, hasAttended, onJoin, onWatchRecording }: SessionCardProps) => {
  const sessionStatus = getSessionStatus(session);
  const hasLink = !!session.link;

  // Compact card for recorded/completed sessions
  if (!isUpcoming) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow">
        <div className="shrink-0 w-9 h-9 rounded-full bg-muted flex items-center justify-center">
          <Video className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{session.title}</h4>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(session.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {session.mentor_name || 'TBA'}
            </span>
            {hasAttended && (
              <span className="text-green-600 font-medium">✓ Attended</span>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant={hasAttended ? "ghost" : "default"}
          onClick={() => onWatchRecording(session.title, session.link)}
          disabled={userLMSStatus !== 'active' || !hasLink}
          className="shrink-0 h-8 w-8"
        >
          <Play className="w-4 h-4" />
        </Button>
      </div>
    );
  }
  
  return (
    <Card className="hover:shadow-md transition-shadow duration-200 border-l-4 border-l-primary/20 hover:border-l-primary/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              {session.title}
            </CardTitle>
            {session.description && (
              <p className="text-muted-foreground text-sm leading-relaxed">{session.description}</p>
            )}
          </div>
          <Badge variant={
            sessionStatus.status === 'live' ? 'destructive' : 'default'
          } className="shrink-0">
            {sessionStatus.status}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            {new Date(session.start_time).toLocaleDateString('en-US', { 
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
            })}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4 text-primary" />
            {new Date(session.start_time).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', hour12: true 
            })}{session.end_time ? ` - ${new Date(session.end_time).toLocaleTimeString('en-US', { 
              hour: '2-digit', minute: '2-digit', hour12: true 
            })}` : ''}
          </span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <Users className="w-4 h-4 text-primary" />
            {session.mentor_name || "TBA"}
          </span>
        </div>
        
        <div className="flex items-center justify-between pt-3 border-t">
          <div>
            {hasAttended && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle className="w-4 h-4" />
                Attended
              </span>
            )}
          </div>
          
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={() => onJoin(session.id, session.link)}
                    disabled={userLMSStatus !== 'active' || !hasLink}
                    size="sm"
                  >
                    {userLMSStatus !== 'active' ? (
                      'Locked - Payment Required'
                    ) : (
                      <>
                        <Calendar className="w-4 h-4 mr-1.5" />
                        Join Now
                      </>
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!hasLink && userLMSStatus === 'active' && (
                <TooltipContent>Link not available yet</TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardContent>
    </Card>
  );
};

interface LiveSessionsProps {
  user?: any;
}

const LiveSessions = ({ user }: LiveSessionsProps = {}) => {
  const [upcomingSessions, setUpcomingSessions] = useState<LiveSession[]>([]);
  const [recordedSessions, setRecordedSessions] = useState<LiveSession[]>([]);
  const [attendance, setAttendance] = useState<SessionAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLMSStatus, setUserLMSStatus] = useState('active');
  const [videoPreview, setVideoPreview] = useState<{ title: string; url: string } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    safeLogger.info('LiveSessions useEffect triggered, user:', { user });
    if (user?.id) {
      fetchAttendance();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchSessions = async (enrolledAt?: string) => {
    safeLogger.info('fetchSessions called');
    try {
      const { data, error } = await supabase
        .from('success_sessions')
        .select('*')
        .in('status', ['upcoming', 'live', 'completed'])
        .not('link', 'is', null)
        .neq('link', '')
        .order('start_time', { ascending: true });

      safeLogger.info('Sessions fetched:', { count: data?.length });
      if (error) {
        safeLogger.error('Supabase error:', error);
        throw error;
      }
      
      const now = new Date();
      const enrolledDate = enrolledAt ? new Date(enrolledAt) : undefined;

      // Upcoming & live: session hasn't ended yet (use end_time or fallback start+1hr)
      const upcoming = (data || []).filter(session => {
        const start = new Date(session.start_time);
        const end = session.end_time ? new Date(session.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
        return end > now;
      });
      // Past: session has ended and is after enrollment date
      const pastSessions = (data || []).filter(session => {
        const start = new Date(session.start_time);
        const end = session.end_time ? new Date(session.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
        if (end >= now) return false;
        if (enrolledDate && start < enrolledDate) return false;
        return true;
      });
      
      setUpcomingSessions(upcoming);
      setRecordedSessions(pastSessions.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime()));
    } catch (error) {
      safeLogger.error('Error fetching sessions:', error);
      toast({ title: "Error", description: "Failed to load success sessions", variant: "destructive" });
    }
  };

  const fetchAttendance = async () => {
    safeLogger.info('fetchAttendance called, user:', { user });
    try {
      if (!user?.id) { setLoading(false); return; }

      const { data: userData, error: userError } = await supabase
        .from('users').select('lms_status').eq('id', user.id).maybeSingle();
      if (userError) throw userError;
      setUserLMSStatus(userData?.lms_status || 'active');

      const { data: studentData } = await supabase
        .from('students').select('id').eq('user_id', user.id).maybeSingle();

      let earliestCutoffDate: string | undefined;
      if (studentData?.id) {
        // Fetch enrollments with batch info to determine the correct cutoff
        const { data: enrollments } = await supabase
          .from('course_enrollments').select('enrolled_at, batch_id')
          .eq('student_id', studentData.id).eq('status', 'active')
          .order('enrolled_at', { ascending: true }).limit(1);
        
        const enrollment = enrollments?.[0];
        if (enrollment?.batch_id) {
          // If student is in a batch, use batch start_date so they see all sessions since batch started
          const { data: batchData } = await supabase
            .from('batches').select('start_date').eq('id', enrollment.batch_id).single();
          earliestCutoffDate = batchData?.start_date || enrollment.enrolled_at;
        } else {
          earliestCutoffDate = enrollment?.enrolled_at;
        }
      }

      const { data: attendanceData, error: attendanceError } = await supabase
        .from('session_attendance').select('*').eq('user_id', user.id);
      
      if (attendanceError) {
        safeLogger.error('Error fetching attendance:', attendanceError);
        setAttendance([]);
      } else {
        setAttendance(attendanceData || []);
      }
      
      await fetchSessions(earliestCutoffDate);
    } catch (error) {
      safeLogger.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinSession = async (sessionId: string, sessionLink: string) => {
    try {
      if (!user?.id) throw new Error('No authenticated user');
      const { error } = await supabase
        .from('session_attendance').insert({ user_id: user.id, session_id: sessionId });
      if (error && error.code !== '23505') throw error;
      window.open(sessionLink, '_blank');
      await fetchAttendance();
      toast({ title: "Joined Session", description: "Attendance recorded successfully" });
    } catch (error) {
      safeLogger.error('Error joining session:', error);
      toast({ title: "Error", description: "Failed to join session", variant: "destructive" });
    }
  };

  const hasAttended = (sessionId: string) => attendance.some(a => a.session_id === sessionId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <RoleGuard allowedRoles={['student', 'admin', 'mentor', 'superadmin']}>
      <div className="space-y-8 animate-fade-in">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Success Sessions</h1>
          <p className="text-muted-foreground text-lg">
            Connect with mentors and fellow students in our success sessions
          </p>
        </div>

        <InactiveLMSBanner show={userLMSStatus !== 'active'} />

        {/* Upcoming Sessions */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-nowrap">
            <div className="w-1 h-6 bg-primary rounded-full shrink-0"></div>
            <h2 className="text-lg sm:text-xl font-semibold whitespace-nowrap">Upcoming Sessions</h2>
            {upcomingSessions.length > 0 && (
              <Badge variant="default" className="ml-auto shrink-0 whitespace-nowrap">
                {upcomingSessions.length} session{upcomingSessions.length !== 1 ? 's' : ''} scheduled
              </Badge>
            )}
          </div>
          {upcomingSessions.length > 0 ? (
            <div className="grid gap-6">
              {upcomingSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isUpcoming={true}
                  userLMSStatus={userLMSStatus}
                  hasAttended={hasAttended(session.id)}
                  onJoin={joinSession}
                  onWatchRecording={(title, url) => setVideoPreview({ title, url })}
                />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                <h3 className="text-lg font-medium mb-2">No Upcoming Sessions</h3>
                <p className="text-muted-foreground">
                  Check back soon for newly scheduled success sessions
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recorded Sessions */}
        {recordedSessions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-nowrap">
              <div className="w-1 h-6 bg-secondary rounded-full shrink-0"></div>
              <h2 className="text-lg sm:text-xl font-semibold whitespace-nowrap">Recorded Sessions</h2>
              <Badge variant="secondary" className="ml-auto shrink-0 whitespace-nowrap">
                {recordedSessions.length} recording{recordedSessions.length !== 1 ? 's' : ''} available
              </Badge>
            </div>
            <div className="grid gap-6">
              {recordedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  isUpcoming={false}
                  userLMSStatus={userLMSStatus}
                  hasAttended={hasAttended(session.id)}
                  onJoin={joinSession}
                  onWatchRecording={(title, url) => setVideoPreview({ title, url })}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <VideoPreviewDialog
        open={!!videoPreview}
        onOpenChange={(open) => { if (!open) setVideoPreview(null); }}
        recordingTitle={videoPreview?.title || ''}
        recordingUrl={videoPreview?.url || ''}
      />
    </RoleGuard>
  );
};

export default LiveSessions;
