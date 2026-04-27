import { RoleGuard } from '@/components/RoleGuard';
import { AssignmentManagement } from '@/components/assignments/AssignmentManagement';
export default function MentorAssignmentsPage() {
  return <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        
        <AssignmentManagement />
      </div>
    </RoleGuard>;
}