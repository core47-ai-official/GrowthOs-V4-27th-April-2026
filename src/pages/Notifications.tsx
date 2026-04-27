import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Bell, Check, Clock, AlertCircle, Info, ExternalLink, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
interface Notification {
  id: string;
  type: string;
  status: string;
  payload: any;
  sent_at: string;
  channel: string;
  error_message?: string;
}
const Notifications = () => {
  const [notifications, setNotifications] = useState<(Notification & {
    displayTitle?: string;
    displayMessage?: string;
  })[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateKeys, setTemplateKeys] = useState<string[]>([]);
  const [mutes, setMutes] = useState<Record<string, boolean>>({});
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
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
  const unreadCount = useMemo(() => notifications.filter(n => n.status === 'sent').length, [notifications]);
  useEffect(() => {
    fetchNotifications();
    fetchSettingsAndTemplates();

    // Realtime: new notifications
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase.channel('realtime:notifications_page').on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        const n = payload.new as Notification;
        enrichNotifications([n]).then(enriched => {
          setNotifications(prev => [enriched[0], ...prev]);
        });
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
      const {
        data,
        error
      } = await supabase.from('notifications').select('*').eq('user_id', user.id).order('sent_at', {
        ascending: false
      });
      if (error) throw error;
      const enriched = await enrichNotifications(data || []);
      setNotifications(enriched);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const markAsRead = async (notificationId: string) => {
    try {
      const {
        error
      } = await supabase.from('notifications').update({
        status: 'read'
      }).eq('id', notificationId);
      if (error) throw error;
      setNotifications(prev => prev.map(notif => notif.id === notificationId ? {
        ...notif,
        status: 'read'
      } : notif));
      toast({
        title: "Marked as read",
        description: "Notification marked as read"
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive"
      });
    }
  };
  const getNotificationIcon = (type: string, status: string) => {
    if (status === 'error') return <AlertCircle className="h-5 w-5 text-red-500" />;
    switch (type) {
      case 'assignment':
        return <Clock className="h-5 w-5 text-blue-500" />;
      case 'achievement':
        return <Check className="h-5 w-5 text-green-500" />;
      default:
        return <Info className="h-5 w-5 text-gray-500" />;
    }
  };
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default">New</Badge>;
      case 'read':
        return <Badge variant="secondary">Read</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
  const markAllAsRead = async () => {
    try {
      const {
        error
      } = await supabase.rpc('mark_all_notifications_read');
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({
        ...n,
        status: 'read'
      })));
      toast({
        title: 'All caught up',
        description: 'All notifications marked as read'
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to mark all as read',
        variant: 'destructive'
      });
    }
  };
  const dismissNotification = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('notifications').update({
        status: 'read',
        dismissed_at: new Date().toISOString()
      }).eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to dismiss',
        variant: 'destructive'
      });
    }
  };
  const getNotificationLink = (n: Notification) => {
    const key = (n as any).template_key || n.type;
    const data = n.payload?.data || n.payload || {};
    switch (key) {
      case 'ticket_updated':
        return data.ticket_id ? `/support?ticketId=${data.ticket_id}` : '/support';
      case 'invoice_issued':
      case 'invoice_due':
        return data.invoice_id ? `/admin/financials?invoice=${data.invoice_id}` : '/admin/financials';
      case 'student_added':
        return data.student_id ? `/students?studentId=${data.student_id}` : '/students';
      case 'learning_item_changed':
        if (data.item_type === 'recording' && data.item_id) return `/videos?recordingId=${data.item_id}`;
        if (data.item_type === 'assignment' && data.item_id) return `/assignments?assignmentId=${data.item_id}`;
        if (data.item_type === 'success_session' && data.item_id) return `/live-sessions?sessionId=${data.item_id}`;
        return '/';
      default:
        return undefined;
    }
  };
  const openNotification = async (n: Notification) => {
    await markAsRead(n.id);
    const link = getNotificationLink(n);
    if (link) navigate(link);
  };
  const fetchSettingsAndTemplates = async () => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;

      // Try to load templates (admins); fallback to keys from notifications
      const {
        data: tplData,
        error: tplError
      } = await supabase.from('notification_templates').select('key');
      if (!tplError && tplData) {
        setTemplateKeys(tplData.map(t => t.key));
      } else {
        const keys = Array.from(new Set((notifications as any[]).map(n => (n as any).template_key || n.type).filter(Boolean)));
        setTemplateKeys(keys);
      }

      // Load or init user's settings
      const {
        data: settingsRow
      } = await supabase.from('notification_settings').select('*').eq('user_id', user.id).maybeSingle();
      if (settingsRow) {
        setMutes(settingsRow.mutes as any || {});
      } else {
        setMutes({});
      }
    } catch (e) {
      console.warn('Settings/templates load warning', e);
    }
  };
  const toggleMute = async (key: string) => {
    try {
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) return;
      const next = {
        ...mutes,
        [key]: !mutes[key]
      };
      setMutes(next);
      // Upsert row
      const {
        error
      } = await supabase.from('notification_settings').upsert({
        user_id: user.id,
        mutes: next
      }, {
        onConflict: 'user_id'
      });
      if (error) throw error;
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'Failed to update notification settings',
        variant: 'destructive'
      });
    }
  };
  if (loading) {
    return <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map(i => <Card key={i}>
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>)}
        </div>
      </div>;
  }
  return <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Bell className="h-8 w-8 text-blue-600" />
          Notifications
        </h1>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg px-3 py-1">
            {unreadCount} unread
          </Badge>
          <Button variant="outline" size="sm" onClick={markAllAsRead}>Mark all as read</Button>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="unread">Unread</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {notifications.length === 0 ? <Card>
              <CardContent className="p-12 text-center">
                <Bell className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications yet</h3>
                <p className="text-gray-500">You'll see important updates and announcements here.</p>
              </CardContent>
            </Card> : <div className="space-y-3">
              {notifications.map(n => <Card key={n.id} className={`transition-all hover:shadow-md ${n.status === 'sent' ? 'bg-blue-50 border-blue-200' : n.status === 'read' ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                  <CardHeader className="pb-3 bg-lime-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {getNotificationIcon(n.type, n.status)}
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {n.displayTitle || n.payload?.title || `${n.type} notification`}
                            <Badge variant="secondary" className="capitalize">{(n as any).template_key || n.type}</Badge>
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2 mt-1">
                            <span>{formatDate(n.sent_at)}</span>
                            <span>•</span>
                            <span className="capitalize">{n.channel}</span>
                          </CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(n.status)}
                        <Button size="sm" variant="outline" onClick={() => openNotification(n)} className="bg-blue-500 hover:bg-blue-400 text-white">
                          Open
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => dismissNotification(n.id)} title="Dismiss">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 bg-white rounded-xl">
                    <p className="text-gray-700">
                      {n.displayMessage || n.payload?.message || n.payload?.description || 'No message content'}
                    </p>
                  </CardContent>
                </Card>)}
            </div>}
        </TabsContent>

        <TabsContent value="unread">
          {notifications.filter(n => n.status === 'sent').length === 0 ? <Card><CardContent className="p-8 text-center">You're all caught up 🎉</CardContent></Card> : <div className="space-y-3">
              {notifications.filter(n => n.status === 'sent').map(n => <Card key={n.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{n.displayTitle || n.payload?.title || `${n.type} notification`}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">{(n as any).template_key || n.type}</Badge>
                        <Button size="sm" variant="outline" onClick={() => openNotification(n)}>
                          Open
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex items-center justify-between">
                    <p className="text-sm text-muted-foreground truncate">{n.displayMessage || n.payload?.message}</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => markAsRead(n.id)}><Check className="h-4 w-4 mr-1" />Read</Button>
                      <Button size="icon" variant="ghost" onClick={() => dismissNotification(n.id)} title="Dismiss"><X className="h-4 w-4" /></Button>
                    </div>
                  </CardContent>
                </Card>)}
            </div>}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Mute specific templates</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {templateKeys.length === 0 ? <div className="text-sm text-muted-foreground">No templates available.</div> : templateKeys.map(k => <div key={k} className="flex items-center justify-between rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{k}</Badge>
                      <span className="text-sm">Mute notifications from this template</span>
                    </div>
                    <Switch checked={!!mutes[k]} onCheckedChange={() => toggleMute(k)} />
                  </div>)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>;
};
export default Notifications;