import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface MotivationalNotification {
  id: string;
  type: string;
  channel: string;
  status: string;
  sent_at: string;
  payload: {
    title: string;
    message: string;
    metadata?: {
      type: string;
      action?: string;
      generated_at: string;
    };
  };
}

export const MotivationalNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<MotivationalNotification[]>([]);
  const [dismissedNotifications, setDismissedNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user?.id || user.role !== 'student') return;

    // Fetch existing motivational notifications from the last hour
    const fetchRecentNotifications = async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'motivation')
        .gte('sent_at', oneHourAgo)
        .order('sent_at', { ascending: false })
        .limit(5);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      if (data) {
        setNotifications(data.map(item => ({
          ...item,
          payload: item.payload as any
        })) as MotivationalNotification[]);
      }
    };

    fetchRecentNotifications();

    // Set up real-time subscription for new motivational notifications
    const channel = supabase
      .channel('motivational-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newNotification = payload.new as MotivationalNotification;
          if (newNotification.type === 'motivation') {
            setNotifications(prev => [newNotification, ...prev].slice(0, 5));
            
            // Show a brief flash effect for new notifications
            const element = document.getElementById(`notification-${newNotification.id}`);
            if (element) {
              element.classList.add('animate-pulse');
              setTimeout(() => {
                element.classList.remove('animate-pulse');
              }, 2000);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.role]);

  const handleAction = (action?: string) => {
    switch (action) {
      case 'view_assignments':
        navigate('/assignments');
        break;
      default:
        // No specific action, just dismiss
        break;
    }
  };

  const dismissNotification = (notificationId: string) => {
    setDismissedNotifications(prev => new Set([...prev, notificationId]));
  };

  const visibleNotifications = notifications.filter(
    notification => !dismissedNotifications.has(notification.id)
  );

  if (visibleNotifications.length === 0) return null;

  return (
    <>
      <style>
        {`
          @keyframes slideInRight {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}
      </style>
      <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
        {visibleNotifications.map((notification, index) => (
          <Card
            key={notification.id}
            id={`notification-${notification.id}`}
            className={`p-4 shadow-lg border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-50 to-indigo-50 transition-all duration-300 transform ${
              index === 0 ? 'scale-100' : 'scale-95 opacity-80'
            }`}
            style={{
              animation: index === 0 ? 'slideInRight 0.3s ease-out' : 'none'
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 pr-2">
                <h4 className="font-medium text-sm text-gray-900 mb-1">
                  {notification.payload.title}
                </h4>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {notification.payload.message}
                </p>
                {notification.payload.metadata?.action && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 text-xs"
                    onClick={() => handleAction(notification.payload.metadata?.action)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    Take Action
                  </Button>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-gray-200"
                onClick={() => dismissNotification(notification.id)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              {new Date(notification.sent_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
};