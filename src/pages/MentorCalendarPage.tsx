import { RoleGuard } from '@/components/RoleGuard';
import { ContentScheduleCalendar } from '@/components/admin/ContentScheduleCalendar';

export default function MentorCalendarPage() {
  return (
    <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">📅 Content Calendar</h1>
          <p className="text-muted-foreground">View the schedule of recordings, sessions, and assignments</p>
        </div>
        <ContentScheduleCalendar readOnly />
      </div>
    </RoleGuard>
  );
}
