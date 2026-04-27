# Database Overview

A high-level overview of the Growth OS database architecture and organization.

## Architecture Summary

Growth OS uses Supabase PostgreSQL with a comprehensive schema designed for scalability and security.

### Key Statistics
- **38 Production Tables** across 10 functional areas
- **35+ Database Functions** for business logic
- **200+ RLS Policies** for comprehensive security
- **25+ Triggers** for automation and data integrity
- **Optimized Indexes** for performance
- **4 Storage Buckets** for file management

## Critical Dependencies

### Essential Security Function
The database relies on a critical security function that **MUST** be created before any RLS policies:

```sql
-- CRITICAL: This function is referenced by 68+ RLS policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;
```

## Functional Areas

### 1. User Management & Authentication
Core user authentication, profiles, and access control.

**Key Tables:**
- `users` - Core user authentication and profiles
- `students` - Student-specific information and enrollment data
- `user_security_summary` - Security monitoring and risk assessment
- `user_security_summary_backup` - Security audit backups
- `user_activity_logs` - User action tracking
- `onboarding_responses` - Student onboarding questionnaire data
- `onboarding_jobs` - Background job processing for onboarding

**Key Functions:**
- `get_current_user_role()` - Critical security function for RLS
- `create_user_with_role()` - Secure user creation with role validation
- `handle_auth_user_deleted()` - Auth user deletion handling
- `handle_user_cascade_deletion()` - Cascade deletion management
- `validate_user_role()` - Role validation trigger
- `validate_password_security()` - Password security enforcement

### 2. Learning Management System
Content delivery, progress tracking, and sequential unlocking.

**Key Tables:**
- `modules` - Learning module organization
- `available_lessons` - Course content structure and recordings
- `recording_views` - Student video watching progress
- `recording_ratings` - Student feedback and ratings
- `recording_attachments` - Additional learning materials
- `user_unlocks` - Sequential content progression tracking
- `course_tracks` - Learning path organization

**Key Functions:**
- `initialize_student_unlocks()` - First recording unlock setup
- `unlock_next_recording()` - Sequential progression logic
- `get_sequential_unlock_status()` - Comprehensive unlock analysis
- `sync_user_unlock_progress()` - Progress synchronization
- `is_recording_watched()` - Watch status validation
- `has_completed_all_modules()` - Course completion check
- `handle_recording_watched()` - Watch event processing
- `handle_recording_changes()` - Content change notifications

### 3. Assignment & Submission System
Assignment management and student submission tracking.

**Key Tables:**
- `assignments` - Assignment definitions and requirements
- `submissions` - Student assignment submissions
- `assignment_grading` - Grading and feedback system

**Key Functions:**
- `is_assignment_passed()` - Assignment completion validation
- `handle_sequential_submission_approval()` - Approval workflow
- `notify_on_assignment_graded()` - Grade notification system

### 4. Financial Management
Payment processing, invoicing, and installment plans.

**Key Tables:**
- `invoices` - Financial transactions and billing
- `installment_plans` - Payment schedule templates
- `installment_payments` - Individual payment records
- `company_settings` - Financial configuration and branding

**Key Functions:**
- `audit_invoice_changes()` - Invoice change tracking
- `update_company_branding()` - Branding management
- `handle_fees_cleared()` - Payment completion processing

### 5. Communication & Notifications
System notifications, support tickets, and user engagement.

**Key Tables:**
- `notifications` - System-wide notification delivery
- `notification_templates` - Reusable notification templates
- `notification_settings` - User notification preferences
- `support_tickets` - Customer support ticket system
- `support_ticket_replies` - Support conversation threads
- `messages` - Internal messaging system
- `email_queue` - Outbound email processing

**Key Functions:**
- `create_notification()` - Notification creation
- `notify_users()` - Multi-user notification delivery
- `notify_roles()` - Role-based notification broadcasting
- `get_users_by_role()` - User role querying
- `interpolate_template()` - Template variable substitution
- `mark_all_notifications_read()` - Bulk notification management
- `send_test_notification()` - Testing and debugging
- `notify_on_ticket_update()` - Support ticket notifications
- `notify_on_ticket_reply()` - Support reply notifications
- `audit_notification_templates()` - Template change tracking

### 6. Live Sessions & Mentorship
Success sessions, mentorship, and live event management.

**Key Tables:**
- `success_sessions` - Live session scheduling and management
- `segmented_weekly_success_sessions` - Weekly session views
- `segmented_weekly_success_sessions_backup` - Session backup data
- `success_partner_credits` - Partner credit system

**Key Functions:**
- `handle_success_session_changes()` - Session change notifications
- `handle_success_session_sync()` - Session data synchronization

### 7. Analytics & Tracking
Performance monitoring, user analytics, and business intelligence.

**Key Tables:**
- `admin_logs` - System administration audit trail
- `user_metrics` - User behavior and performance metrics
- `student_recovery_messages` - Student re-engagement tracking
- `integrations` - Third-party service connections

**Key Functions:**
- `log_data_access_attempt()` - Security access logging
- `get_inactive_students()` - Student engagement analysis
- `record_recovery_message()` - Recovery campaign tracking
- `get_user_lms_status()` - LMS status checking
- `audit_integration_access()` - Integration security logging
- `audit_user_status_changes_to_logs()` - User status audit

### 8. Gamification & Recognition
Badges, milestones, and achievement tracking.

**Key Tables:**
- `badges` - Achievement badge definitions
- `user_badges` - User badge awards
- `milestones` - Achievement milestone system
- `milestone_categories` - Milestone organization

### 9. Quality Assurance & Validation
Data validation, questionnaire management, and system integrity.

**Key Functions:**
- `validate_questionnaire_structure()` - Questionnaire data validation
- `create_student_complete()` - Complete student creation workflow

### 10. Storage & File Management
File upload and storage management across multiple buckets.

**Storage Buckets:**
- `assignment-files` - Private student assignment uploads
- `company-branding` - Public company logos and branding assets
- `recording-attachments` - Private supplementary learning materials
- `assignment-submissions` - Private student submission files

## Security Architecture

### Row-Level Security (RLS)
- **Universal RLS** enabled on all 38 production tables
- **200+ Security Policies** covering all CRUD operations
- **Role-based access control** with 5 distinct user roles:
  - `superadmin` - Full system access
  - `admin` - Administrative management
  - `enrollment_manager` - Student enrollment and management
  - `mentor` - Student guidance and content delivery
  - `student` - Learning platform access

### Critical Security Features
- **User isolation** through auth.uid() validation
- **Company-level data segregation** for multi-tenant support
- **Audit logging** for all critical operations in `admin_logs`
- **Security monitoring** through `user_security_summary`
- **Data access tracking** via `log_data_access_attempt()`

### Security Dependencies
All RLS policies depend on the `get_current_user_role()` function. This function **MUST** be created before any table policies are established.

## Performance Characteristics

- **Sub-100ms** query performance for most operations
- **Optimized indexes** for common query patterns including:
  - User role-based filtering
  - Sequential content unlocking
  - Financial transaction tracking
  - Notification delivery optimization
- **Efficient pagination** for large datasets
- **Scalable design** supporting 10,000+ concurrent users
- **Real-time subscriptions** for live notifications

## Database Functions Summary

### Core Security (4 functions)
- User role management and validation
- Authentication and authorization

### Learning Management (8 functions)
- Sequential unlocking logic
- Progress tracking and validation
- Content delivery optimization

### Notification System (7 functions)
- Multi-channel notification delivery
- Template processing and rendering
- User preference management

### Financial Operations (3 functions)
- Invoice processing and audit
- Payment workflow management
- Company settings administration

### User Management (6 functions)
- User creation and deletion
- Security monitoring and logging
- Profile and preference management

### Analytics & Recovery (4 functions)
- Student engagement analysis
- Recovery campaign management
- Performance metrics collection

### System Administration (3 functions)
- Audit trail management
- Data validation and integrity
- Background job processing

## Storage Policy Matrix

| Bucket | Public | Student Access | Staff Access | Use Case |
|--------|--------|----------------|--------------|----------|
| `assignment-files` | No | Own files only | All files | Assignment uploads |
| `company-branding` | Yes | Read-only | Full control | Logos and branding |
| `recording-attachments` | No | Read-only | Full control | Learning materials |
| `assignment-submissions` | No | Own files only | All files | Student submissions |

## Troubleshooting & Validation

### Common Issues
1. **Missing `get_current_user_role()` function** - All RLS policies will fail
2. **Incorrect sequence dependencies** - Tables referencing missing sequences
3. **Storage bucket mismatch** - Policies referencing non-existent buckets
4. **Foreign key violations** - Missing referenced tables or functions

### Validation Queries
```sql
-- Verify critical function exists
SELECT proname FROM pg_proc WHERE proname = 'get_current_user_role';

-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = false;

-- Verify storage buckets
SELECT id, name, public FROM storage.buckets;
```

## Related Documentation

- [Database Creation Guide](./database-creation-guide.md) - Complete setup instructions
- [Database Security](./database-security.md) - Security implementation details
- [Database Tables Reference](./database-tables.md) - Table structure documentation
- [Technical Capabilities](./technical-capabilities.md) - System capabilities overview
- [Features Overview](./features-overview.md) - Feature-level documentation