import { RoleGuard } from '@/components/RoleGuard';
import { MentorSessions } from '@/components/mentor/MentorSessions';

export default function MentorSessionsPage() {
  return (
    <RoleGuard allowedRoles={['mentor']}>
      <MentorSessions />
    </RoleGuard>
  );
}