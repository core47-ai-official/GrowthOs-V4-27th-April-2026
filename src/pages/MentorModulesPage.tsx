import { RoleGuard } from '@/components/RoleGuard';
import { MentorModulesManagement } from '@/components/mentor/MentorModulesManagement';
export default function MentorModulesPage() {
  return <RoleGuard allowedRoles={['mentor']}>
      <div className="container mx-auto p-6">
        
        <MentorModulesManagement />
      </div>
    </RoleGuard>;
}