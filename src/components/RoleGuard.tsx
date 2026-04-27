import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX } from 'lucide-react';

export type AppRole =
  | 'student'
  | 'admin'
  | 'mentor'
  | 'superadmin'
  | 'enrollment_manager'
  | 'support_member';

interface RoleGuardProps {
  children: ReactNode;
  allowedRoles: AppRole | AppRole[];
  fallback?: ReactNode;
  requireLMSAccess?: boolean;
}

export const RoleGuard = ({
  children,
  allowedRoles,
  fallback,
  requireLMSAccess = false,
}: RoleGuardProps) => {
  const { user, hasRole, canAccessLMS, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      fallback || (
        <Alert className="m-4">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            You must be logged in to access this content.
          </AlertDescription>
        </Alert>
      )
    );
  }

  if (!hasRole(allowedRoles)) {
    return (
      fallback || (
        <Alert className="m-4">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            You don't have permission to access this content.
          </AlertDescription>
        </Alert>
      )
    );
  }

  if (requireLMSAccess && !canAccessLMS()) {
    return (
      fallback || (
        <Alert className="m-4">
          <ShieldX className="h-4 w-4" />
          <AlertDescription>
            Your LMS access is currently restricted. Please contact support or check your payment status.
          </AlertDescription>
        </Alert>
      )
    );
  }

  return <>{children}</>;
};
