import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { RoleGuard } from '@/components/RoleGuard';
import { SubmissionsManagement } from '@/components/assignments/SubmissionsManagement';

export default function AdminSubmissions() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Check if user has proper access
    if (user && !['admin', 'superadmin'].includes(user.role)) {
      toast({
        title: "Access denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      navigate('/');
    }
  }, [user, navigate, toast]);

  return (
    <RoleGuard allowedRoles={['admin', 'superadmin']}>
      <div className="container mx-auto p-6">
        <SubmissionsManagement userRole={user?.role as 'admin' | 'superadmin'} />
      </div>
    </RoleGuard>
  );
}