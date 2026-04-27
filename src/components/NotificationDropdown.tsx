import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Bell, Check, Eye, EyeOff, AlertCircle, Info, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
interface Notification {
  id: string;
  type: string;
  status: string;
  payload: any;
  sent_at: string;
  channel: string;
  error_message?: string;
}
const NotificationDropdown = () => {
  const [notifications, setNotifications] = useState<(Notification & {
    displayTitle?: string;
    displayMessage?: string;
  })[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const {
    toast
  } = useToast();
  const getKeyAndData = (n: Notification) => {
    const key = (n as any).template_key || n.type;
    const data = n.payload?.data || n.payload?.metadata || n.payload || {};
    return {
      key,
      data
    } as {
      key: string;
      data: any;
    };
  };
  const enrichNotifications = async (items: Notification[]) => {
    const ticketIds = new Set<string>();
    const recordingIds = new Set<string>();
    const assignmentIds = new Set<string>();
    const sessionIds = new Set<string>();

    // Collect IDs
    items.forEach(n => {
      const {
        key,
        data
      } = getKeyAndData(n);
      if (key === 'ticket_updated' && data.ticket_id) ticketIds.add(data.ticket_id);
      if ((key === 'recording' || key === 'learning_item_changed' && data.item_type === 'recording') && (data.recording_id || data.item_id)) {
        recordingIds.add(data.recording_id || data.item_id);
      }
      if ((key === 'assignment' || key === 'learning_item_changed' && data.item_type === 'assignment') && (data.assignment_id || data.item_id)) {
        assignmentIds.add(data.assignment_id || data.item_id);
      }
      if ((key === 'success_session' || key === 'learning_item_changed' && data.item_type === 'success_session') && (data.session_id || data.item_id)) {
        sessionIds.add(data.session_id || data.item_id);
      }
    });

    // Batch fetch titles
    const [ticketsRes, recsRes, assignsRes, sessRes] = await Promise.all([ticketIds.size ? supabase.from('support_tickets').select('id, title').in('id', Array.from(ticketIds)) : Promise.resolve({
      data: [] as any[]
    }), recordingIds.size ? supabase.from('available_lessons').select('id, recording_title').in('id', Array.from(recordingIds)) : Promise.resolve({
      data: [] as any[]
    }), assignmentIds.size ? supabase.from('assignments').select('id, name').in('id', Array.from(assignmentIds)) : Promise.resolve({
      data: [] as any[]
    }), sessionIds.size ? supabase.from('success_sessions').select('id, title').in('id', Array.from(sessionIds)) : Promise.resolve({
      data: [] as any[]
    })]);
    const ticketMap = Object.fromEntries((ticketsRes as any).data?.map((r: any) => [r.id, r.title]) || []);
    const recMap = Object.fromEntries((recsRes as any).data?.map((r: any) => [r.id, r.recording_title]) || []);
    const assignMap = Object.fromEntries((assignsRes as any).data?.map((r: any) => [r.id, r.name]) || []);
    const sessMap = Object.fromEntries((sessRes as any).data?.map((r: any) => [r.id, r.title]) || []);
    return items.map(n => {
      const {
        key,
        data
      } = getKeyAndData(n);
      let displayTitle = n.payload?.title as string | undefined;
      let displayMessage = n.payload?.message as string | undefined || n.payload?.description;
      if (key === 'ticket_updated' && data.ticket_id && ticketMap[data.ticket_id]) {
        displayTitle = `Support Ticket: ${ticketMap[data.ticket_id]}`;
      }
      if (key === 'recording' || key === 'learning_item_changed' && data.item_type === 'recording') {
        const rid = data.recording_id || data.item_id;
        if (rid && recMap[rid]) displayTitle = `Recording: ${recMap[rid]}`;
      }
      if (key === 'assignment' || key === 'learning_item_changed' && data.item_type === 'assignment') {
        const aid = data.assignment_id || data.item_id;
        if (aid && assignMap[aid]) displayTitle = `Assignment: ${assignMap[aid]}`;
      }
      if (key === 'success_session' || key === 'learning_item_changed' && data.item_type === 'success_session') {
        const sid = data.session_id || data.item_id;
        if (sid && sessMap[sid]) displayTitle = `Success Session: ${sessMap[sid]}`;
      }
      return {
        ...n,
        displayTitle,
        displayMessage
      };
    });
  };
  useEffect(() => {
    fetchNotifications();

    // Realtime: subscribe to new notifications for current user
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase.channel('realtime:notifications_dropdown').on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        const newNotif = payload.new as Notification;
        // Only count unread (status 'sent')
        if (newNotif.status === 'sent') {
          setUnreadCount(prev => prev >= 9 ? prev : prev + 1);
          enrichNotifications([newNotif]).then(enriched => {
            setNotifications(prev => [enriched[0], ...prev].slice(0, 5));
          });
        }
      }).subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);
  const fetchNotifications = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch last 5 unread notifications
      const {
        data,
        error
      } = await supabase.from('notifications').select('*').eq('user_id', user.id).eq('status', 'sent').order('sent_at', {
        ascending: false
      }).limit(5);
      if (error) throw error;
      const enriched = await enrichNotifications(data || []);
      setNotifications(enriched);
      setUnreadCount(enriched?.length || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };
  const toggleNotificationStatus = async (notificationId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'sent' ? 'read' : 'sent';
      const {
        error
      } = await supabase.from('notifications').update({
        status: newStatus
      }).eq('id', notificationId);
      if (error) throw error;

      // Update local state
      setNotifications(prev => prev.map(notif => notif.id === notificationId ? {
        ...notif,
        status: newStatus
      } : notif).filter(notif => notif.status === 'sent') // Keep only unread in dropdown
      );

      // Update unread count
      if (newStatus === 'read') {
        setUnreadCount(prev => Math.max(0, prev - 1));
      } else {
        setUnreadCount(prev => prev + 1);
      }
      toast({
        title: newStatus === 'read' ? "Marked as read" : "Marked as unread",
        description: `Notification ${newStatus === 'read' ? 'marked as read' : 'marked as unread'}`
      });
    } catch (error) {
      console.error('Error updating notification status:', error);
      toast({
        title: "Error",
        description: "Failed to update notification status",
        variant: "destructive"
      });
    }
  };
  const markAllAsRead = async () => {
    try {
      const {
        error
      } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
      setNotifications([]);
      setUnreadCount(0);
      toast({
        title: 'All caught up',
        description: 'All notifications marked as read'
      });
    } catch (e) {
      console.error('Error marking all as read', e);
      toast({
        title: 'Error',
        description: 'Failed to mark all as read',
        variant: 'destructive'
      });
    }
  };
  const getNotificationIcon = (type: string, status: string) => {
    if (status === 'error') return <AlertCircle className="h-4 w-4 text-[hsl(var(--destructive))]" />;
    switch (type) {
      case 'assignment_submission':
        return <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />;
      case 'success_session':
        return <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />;
      case 'student_progress':
        return <Check className="h-4 w-4 text-[hsl(var(--success))]" />;
      case 'assignment':
        return <Clock className="h-4 w-4 text-[hsl(var(--primary))]" />;
      case 'achievement':
        return <Check className="h-4 w-4 text-[hsl(var(--success))]" />;
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };
  return <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] max-w-[28rem] p-0" align="end" sideOffset={8}>
        <div className="section-surface overflow-hidden rounded-lg border border-border shadow-lg bg-background">
          <div className="section-header p-3 sm:p-4 bg-muted/30">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-foreground text-sm sm:text-base">Notifications</h4>
              <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-muted-foreground hover:text-foreground text-xs sm:text-sm px-2 sm:px-3 h-8">
                  Mark all read
                </Button>
                <Link to="/notifications">
                  <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 transition-colors text-xs sm:text-sm px-2 sm:px-3 h-8">
                    View all
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          
          <ScrollArea className="max-h-[60vh] sm:max-h-[26rem]">
            {loading ? <div className="p-3 sm:p-4 space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>)}
              </div> : notifications.length === 0 ? <div className="p-6 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm">No unread notifications</p>
              </div> : <div className="p-1.5 sm:p-2">
                {notifications.map((notification, index) => <div key={notification.id}>
                    <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 hover:bg-muted/40 rounded-lg group transition-colors">
                      <div className="flex-shrink-0 mt-0.5 icon-chip">
                        {getNotificationIcon(notification.type, notification.status)}
                      </div>
                      
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-2">
                          {notification.displayTitle || notification.payload?.title || `${notification.type} notification`}
                        </p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 sm:mt-1">
                          {notification.displayMessage || notification.payload?.message || notification.payload?.description || 'No message content'}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-0.5 sm:mt-1">
                          {formatDate(notification.sent_at)}
                        </p>
                      </div>
                      
                      <div className="flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <Button size="sm" variant="ghost" onClick={() => toggleNotificationStatus(notification.id, notification.status)} className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                          {notification.status === 'sent' ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    
                    {index < notifications.length - 1 && <Separator className="my-0.5 sm:my-1" />}
                  </div>)}
              </div>}
          </ScrollArea>
          
          {notifications.length > 0 && <>
              <Separator />
              <div className="p-2 sm:p-3 bg-muted/30">
                <Link to="/notifications">
                  <Button variant="ghost" className="w-full text-xs sm:text-sm h-8 sm:h-9">
                    View all notifications
                  </Button>
                </Link>
              </div>
            </>}
        </div>
      </PopoverContent>
    </Popover>;
};
export default NotificationDropdown;