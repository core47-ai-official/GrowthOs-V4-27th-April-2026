import { Button } from '@/components/ui/button';
import { Activity } from 'lucide-react';
import { ActivityLogsDialog } from './ActivityLogsDialog';
import { useAuth } from '@/hooks/useAuth';
export function FloatingActivityButton() {
  const {
    user
  } = useAuth();

  // Only show for admin and superadmin roles
  if (!user || !['admin', 'superadmin'].includes(user.role || '')) {
    return null;
  }
  return <div className="fixed bottom-14 right-6 z-50">
      <ActivityLogsDialog>
        <Button size="icon" className="rounded-full shadow-lg">
          <Activity className="h-5 w-5" />
        </Button>
      </ActivityLogsDialog>
    </div>;
}