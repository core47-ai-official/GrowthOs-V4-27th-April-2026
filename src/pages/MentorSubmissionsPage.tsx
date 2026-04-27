import { SubmissionsManagement } from '@/components/assignments/SubmissionsManagement';
import { RoleGuard } from '@/components/RoleGuard';

export default function MentorSubmissionsPage() {
  return (
    <RoleGuard allowedRoles="mentor">
      <SubmissionsManagement userRole="mentor" />
    </RoleGuard>
  );
}
