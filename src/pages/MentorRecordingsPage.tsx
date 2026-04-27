import { RoleGuard } from '@/components/RoleGuard';
import { MentorRecordingsManagement } from '@/components/mentor/MentorRecordingsManagement';
export default function MentorRecordingsPage() {
  return <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        
        <MentorRecordingsManagement />
      </div>
    </RoleGuard>;
}