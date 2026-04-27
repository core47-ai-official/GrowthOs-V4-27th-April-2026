# Authentication System

## Overview

Growth OS implements a comprehensive role-based authentication system supporting five distinct user roles with granular permissions and secure access controls.

## User Roles

### Role Hierarchy

1. **Superadmin** - Complete system control and configuration
2. **Admin** - Platform administration and user management
3. **Enrollment Manager** - Student onboarding and enrollment
4. **Mentor** - Student guidance and assignment review
5. **Student** - Learning platform access and progress tracking

### Role Creation Matrix

| Creator Role | Can Create | Access Page |
|--------------|------------|-------------|
| **Superadmin** | All roles | `/teams`, `/students` |
| **Admin** | Mentor, Enrollment Manager, Student | `/teams`, `/students` |
| **Enrollment Manager** | Student only | `/students` |
| **Mentor** | None | N/A |
| **Student** | None | N/A |

## Technical Implementation

### Database Structure

```sql
-- User profiles table
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL,
  student_id TEXT UNIQUE,
  mentor_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Role enumeration
CREATE TYPE user_role AS ENUM (
  'superadmin',
  'admin', 
  'enrollment_manager',
  'mentor',
  'student'
);
```

### Authentication Flow

1. **User Registration**
   - Supabase Auth creates auth.users record
   - Edge function creates corresponding profiles record
   - Role-based permissions validated
   - Welcome email sent via notification system

2. **Login Process**
   - Supabase Auth handles authentication
   - JWT token contains user metadata
   - Role-based route access enforced
   - Session management via React context

3. **Permission Validation**
   - Server-side validation in Edge Functions
   - Client-side guards using RoleGuard component
   - Row Level Security policies enforce data access
   - Real-time permission updates

## Security Features

### Row Level Security (RLS)

```sql
-- Users can view their own profile
CREATE POLICY "Users can view own profile" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

-- Admins can view non-superadmin profiles
CREATE POLICY "Admins can view managed users" 
ON public.users FOR SELECT 
USING (
  get_current_user_role() IN ('admin', 'superadmin') 
  AND (role != 'superadmin' OR get_current_user_role() = 'superadmin')
);
```

### Password Security

- Minimum 8 characters required
- Automatic password generation for new users
- Password reset via email verification
- Session timeout configuration
- Rate limiting on login attempts

### Access Control

- Route-level protection using React Router guards
- Component-level access control via RoleGuard
- API endpoint protection via JWT validation
- Feature-level permissions based on user role

## Edge Functions

### create-user-with-role

Creates new users with role validation:

```typescript
// Role creation permissions validation
const canCreate = await validateRoleCreation(
  currentUserRole, 
  targetRole
);

if (!canCreate) {
  throw new Error('Insufficient permissions');
}

// Create auth user and profile
const authUser = await createAuthUser(email, password);
const profile = await createUserProfile(authUser.id, userData);
```

### delete-user-with-role

Handles user deletion with cascade cleanup:

```typescript
// Permission validation
const canDelete = await validateDeletionPermissions(
  currentUserRole,
  targetUserId
);

// Cascade delete related data
await deleteUserData(targetUserId);
await deleteAuthUser(targetUserId);
```

### whoami

Returns current user profile information:

```typescript
const user = await getCurrentUser();
return {
  id: user.id,
  email: user.email,
  role: user.role,
  permissions: getRolePermissions(user.role)
};
```

## React Integration

### useAuth Hook

Manages authentication state and user information:

```typescript
const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Authentication state management
  // Role-based permission checking
  // Session management
  
  return { user, loading, login, logout, hasRole };
};
```

### RoleGuard Component

Protects routes and components based on user role:

```typescript
interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const RoleGuard = ({ allowedRoles, children, fallback }) => {
  const { user } = useAuth();
  
  if (!user || !allowedRoles.includes(user.role)) {
    return fallback || <Navigate to="/unauthorized" />;
  }
  
  return children;
};
```

## User Management Workflows

### Student Creation (Enrollment Manager)

1. Validate enrollment manager permissions
2. Generate secure password
3. Create Supabase auth user
4. Create profile with student role
5. Send welcome email with credentials
6. Initialize student learning progress

### Staff Member Creation (Admin/Superadmin)

1. Validate role creation permissions
2. Create auth user with temporary password
3. Create profile with specified role
4. Send onboarding email
5. Set up role-specific dashboard access

### User Deletion

1. Validate deletion permissions
2. Archive user data for audit purposes
3. Delete related records (assignments, progress)
4. Remove auth user
5. Log deletion action

## Error Handling

### Suspended Account Flow

**Implementation Details** (Updated: January 2025):

The system implements graceful error handling for suspended accounts to prevent confusing error messages:

1. **Error Detection**
   - Login attempt detected for suspended account
   - System stores `suspension_error` flag in sessionStorage
   - Flag persists for 60 seconds to coordinate error suppression

2. **PaywallModal Coordination**
   - Modal checks for suspension flag before fetching payment data
   - Automatically closes when user signs out
   - Suppresses "Failed to load payment information" toast during suspension flow

3. **Error Message Priority**
   - Only displays "Account Suspended" message to user
   - Suppresses all payment-related errors (401, 403, RLS permission errors)
   - Prevents multiple confusing error toasts

**Technical Implementation**:

```typescript
// Login.tsx - Set suspension flag with 60s timeout
useEffect(() => {
  const suspensionError = sessionStorage.getItem('suspension_error');
  if (suspensionError) {
    setLoginError(suspensionError);
    const timeout = setTimeout(() => {
      sessionStorage.removeItem('suspension_error');
      setLoginError("");
    }, 60000);
    return () => clearTimeout(timeout);
  }
}, []);

// PaywallModal.tsx - Check suspension before fetching
useEffect(() => {
  if (!isOpen) return;
  const suspensionError = sessionStorage.getItem('suspension_error');
  if (suspensionError) return; // Don't fetch during suspension
  fetchCompanySettings();
}, [isOpen]);

// App.tsx - Close paywall on sign out
useEffect(() => {
  if (!user) {
    setShowPaywall(false);
    setPendingInvoice(null);
  }
}, [user]);
```

## Troubleshooting

### Common Issues

**Login Failures**
- Check email verification status
- Verify password requirements
- Check for account suspension
- Validate role assignments

**Suspended Account Errors**
- User should only see "Account Suspended" message
- No payment-related errors should appear
- Error flag persists for 60 seconds across components
- Modal automatically closes on sign out

**Permission Errors**
- Verify user role in database
- Check RLS policy configuration
- Validate JWT token claims
- Review Edge Function permissions

**Session Issues**
- Clear browser cache and cookies
- Check session timeout settings
- Verify JWT token expiration
- Review authentication state

### Debug Commands

```sql
-- Check user role and status
SELECT id, email, role, created_at 
FROM public.users 
WHERE email = 'user@example.com';

-- Verify RLS policies
SELECT schemaname, tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'users';

-- Check authentication logs
SELECT * FROM auth.audit_log_entries 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

## Integration Points

### Notification System
- Welcome emails for new users
- Password reset notifications
- Role change notifications
- Security alerts

### Activity Logging
- Login/logout events
- Role changes
- Permission violations
- Admin actions

### Support System
- Role-based ticket assignment
- Escalation workflows
- Admin oversight capabilities

## Next Steps

Review [Student Management](./student-management.md) for detailed student workflows and [User Activity Logging](./user-activity-logging.md) for audit and compliance features.