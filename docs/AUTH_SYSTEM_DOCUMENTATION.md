# Authentication System Documentation

## Overview
This document summarizes the new role-based authentication system that was implemented to replace the previous authentication setup.

## Role Matrix

### User Roles
- **superadmin**: Full system access
- **admin**: Limited administrative access 
- **enrollment_manager**: Student management only
- **mentor**: Student progress and sessions
- **student**: Learning platform access

### Role Creation Permissions

| Creator Role | Can Create | Page/Location |
|--------------|------------|---------------|
| **superadmin** | mentor, enrollment_manager, admin, student | `/teams` (for staff), `/students` (for students) |
| **admin** | mentor, enrollment_manager, student | `/teams` (for staff), `/students` (for students) |
| **enrollment_manager** | student | `/students` dashboard |
| **mentor** | ❌ None | N/A |
| **student** | ❌ None | N/A |

### Role Deletion Permissions

| Deleter Role | Can Delete | Notes |
|--------------|------------|-------|
| **superadmin** | Any role | Full deletion access |
| **admin** | mentor, enrollment_manager, student | Cannot delete superadmins |
| **enrollment_manager** | ❌ None | Can only create students |
| **mentor** | ❌ None | No deletion rights |
| **student** | ❌ None | No deletion rights |

## Implementation Details

### Database Structure
- **Table**: `profiles` (replaces old `users` table)
- **Columns**: `id` (UUID, FK to auth.users), `email`, `full_name`, `role`, `created_at`, `updated_at`, `metadata`
- **Role Type**: ENUM with values: 'superadmin', 'admin', 'enrollment_manager', 'mentor', 'student'

### API Functions

#### Edge Functions
1. **create-user-with-role**: Creates new users with role validation
2. **delete-user-with-role**: Deletes users with permission checks
3. **whoami**: Returns current user profile information

#### Database Functions
1. **create_user_with_role()**: Validates role creation permissions
2. **delete_user_with_permissions()**: Validates deletion permissions and cascades
3. **get_current_user_info()**: Returns authenticated user's profile

### React Components

#### Pages
- **Teams** (`/teams`): Staff management for superadmins and admins
- **StudentsManagement** (`/students`): Student management for authorized roles
- **EnrollmentManagerDashboard**: Simplified dashboard with student creation

#### Hooks
- **useAuth**: Updated to use new profiles table
- **useUserManagement**: Handles user creation, deletion, and info retrieval

#### Components
- **CreateStudentDialog**: Reusable student creation component
- **RoleGuard**: Authorization component for route protection

### Security Features

#### Row Level Security (RLS)
- Users can view/update their own profiles
- Superadmins can view all profiles
- Admins can view non-superadmin profiles
- Enrollment managers can view student profiles only

#### Permission Validation
- Creation permissions validated both client-side and server-side
- Deletion cascades through related tables (enrollments, assignments)
- Auth user deletion handled through Supabase admin API

## Usage Examples

### Creating a Student (Enrollment Manager)
```typescript
const { createUser } = useUserManagement();
await createUser({
  target_email: "student@example.com",
  target_password: "temp123",
  target_role: "student",
  target_full_name: "John Doe"
});
```

### Creating a Mentor (Admin)
```typescript
const { createUser } = useUserManagement();
await createUser({
  target_email: "mentor@example.com", 
  target_password: "temp123",
  target_role: "mentor",
  target_full_name: "Jane Smith"
});
```

### Deleting a User (Admin/Superadmin)
```typescript
const { deleteUser } = useUserManagement();
await deleteUser(userId);
```

## Extension Guide

### Adding New Roles
1. Update the `user_role` ENUM in the database migration
2. Add role to the `User` interface in `useAuth.ts`
3. Update permission matrices in edge functions
4. Add navigation rules in `Layout.tsx`
5. Update role creation options in UI components

### Adding Role-Specific Permissions
1. Update the permission validation functions in edge functions
2. Modify RLS policies if needed for data access
3. Update UI components to show/hide options based on roles
4. Add route guards using `RoleGuard` component

### Navigation Customization
Edit the navigation logic in `Layout.tsx` to add/remove menu items for specific roles:

```typescript
if (isUserEnrollmentManager) {
  return [
    { name: "Dashboard", href: "/enrollment-manager", icon: Monitor },
    { name: "Students", href: "/students", icon: Users },
    { name: "Profile", href: "/profile", icon: User }
  ];
}
```

## Migration Notes

### Database Changes
- Migrated from `users` table to `profiles` table
- Added proper role ENUM type
- Implemented comprehensive RLS policies
- Created helper functions for user management

### Breaking Changes
- All user creation now goes through edge functions
- Role validation is strictly enforced
- Old authentication flows no longer work
- Direct database insertions are blocked by RLS

### Testing Checklist
- [ ] Superadmin can create all roles
- [ ] Admin cannot create superadmins
- [ ] Enrollment manager can only create students
- [ ] Mentors and students cannot create users
- [ ] Deletion permissions work correctly
- [ ] RLS policies prevent unauthorized access
- [ ] Navigation shows correct items per role
- [ ] Role guards protect sensitive routes