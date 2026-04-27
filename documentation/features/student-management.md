# Student Management System

## Overview

The Student Management System handles the complete student lifecycle from initial enrollment through course completion, including onboarding, progress tracking, and administrative oversight.

## Student Lifecycle

### 1. Enrollment Process

**Initiated By**: Enrollment Managers, Admins, Superadmins

1. **Student Creation**
   - Collect basic information (name, email, phone)
   - Configure payment plan (installment options)
   - Generate secure login credentials
   - Create student profile and learning records

2. **Payment Setup**
   - Configure installment schedule
   - Generate initial invoice
   - Process first payment (if applicable)
   - Set up automated payment reminders

3. **Account Activation**
   - Send welcome email with credentials
   - Grant LMS access
   - Initialize learning progress tracking
   - Assign mentor (if configured)

### 2. Onboarding Workflow

**Student Experience**:
1. Receive welcome email with login credentials
2. First-time login prompts onboarding questionnaire
3. Complete required profile information
4. Review learning objectives and expectations
5. Access first learning module

**Admin Oversight**:
- Monitor onboarding completion rates
- Track student engagement metrics
- Identify students needing additional support
- Automate follow-up communications

### 3. Learning Progress Management

**Content Unlocking System**:
- Sequential module access based on completion
- Assignment gates prevent progress without approval
- Mentor review required for advancement
- Automated progress notifications

**Progress Tracking**:
- Module completion percentages
- Assignment submission status
- Time spent in learning materials
- Engagement analytics

## Technical Implementation

### Core Components

**Student Creation**: `SecureStudentCreationDialog.tsx`
- Form validation and data collection
- Payment plan configuration
- Secure credential generation
- Integration with Edge Functions

**Student Dashboard**: `StudentDashboard.tsx`
- Progress visualization
- Next assignment display
- Mentor communication tools
- Notification center

**Management Interface**: `StudentManagement.tsx`
- Bulk student operations
- Search and filtering
- Status management
- Financial overview

### Database Structure

```sql
-- Core student data
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  role TEXT DEFAULT 'student',
  student_id TEXT UNIQUE,
  mentor_id UUID REFERENCES public.users(id),
  status TEXT DEFAULT 'Active',
  lms_status TEXT DEFAULT 'inactive',
  fees_structure TEXT,
  onboarding_done BOOLEAN DEFAULT false
);

-- Student progress tracking
CREATE TABLE public.user_module_progress (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  module_id UUID REFERENCES public.modules(id),
  progress_percentage INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ
);

-- Payment tracking
CREATE TABLE public.installment_payments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  installment_number INTEGER NOT NULL,
  total_installments INTEGER NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE,
  paid_date DATE,
  status TEXT DEFAULT 'pending'
);
```

### Edge Functions

**create-student**: Atomic student creation
```typescript
export async function createStudent(studentData) {
  // Validate permissions
  // Generate student ID
  // Create user record
  // Set up payment schedule
  // Initialize progress tracking
  // Send welcome email
  
  return { success: true, studentId };
}
```

**cleanup-inactive-students**: Automated maintenance
```typescript
export async function cleanupInactiveStudents() {
  // Identify inactive students
  // Send reactivation reminders
  // Archive long-term inactive accounts
  // Update analytics
}
```

## Administrative Features

### Student Search and Filtering

**Search Capabilities**:
- Name, email, phone, student ID search
- Status filtering (Active, Inactive, Suspended)
- Payment status filtering
- Mentor assignment filtering
- Date range filtering (enrollment, last activity)

**Bulk Operations**:
- Status updates (suspend, reactivate)
- Mentor reassignment
- Payment status updates
- Email broadcasts
- Progress resets

### Student Status Management

**Status Types**:
- **Active**: Full platform access
- **Inactive**: Limited access, payment pending
- **Suspended**: No platform access
- **Completed**: Course finished successfully
- **Withdrawn**: Voluntarily left program

**LMS Access Control**:
- **active**: Full learning platform access
- **inactive**: Login only, no content access
- **suspended**: Complete access blocked

### Financial Management Integration

**Payment Tracking**:
- Real-time installment status
- Automated payment reminders
- Overdue payment notifications
- Payment history and receipts

**Financial Reports**:
- Revenue by student cohort
- Payment completion rates
- Outstanding balances
- Refund tracking

## Student Support Features

### Communication Tools

**Direct Messaging**:
- Student-to-mentor communication
- Support ticket system
- Automated notifications
- Bulk announcements

**Progress Notifications**:
- Assignment submissions
- Grade notifications
- Module completions
- Achievement badges

### Mentor Assignment

**Assignment Logic**:
- Automatic assignment based on capacity
- Manual assignment by administrators
- Mentor expertise matching
- Workload balancing (max 20 students per mentor)

**Mentor Management**:
- Student portfolio overview
- Progress tracking dashboard
- Communication history
- Performance analytics

## Integration Points

### Learning Management System
- Content unlocking based on progress
- Assignment submission workflows
- Certificate generation

### Notification System
- Welcome and onboarding emails
- Progress milestone notifications
- Payment reminders
- Support communications

### Analytics and Reporting
- Student engagement metrics
- Completion rate tracking
- Performance analytics
- Cohort analysis

## Security and Privacy

### Data Protection
- Student data encrypted at rest
- Row Level Security policies
- GDPR compliance features
- Data retention policies

### Access Controls
- Role-based data access
- Mentor-student data isolation
- Admin audit logging
- Privacy controls

## Workflows and Automation

### Automated Processes

1. **Welcome Sequence**
   - Send credentials immediately after creation
   - Follow-up onboarding reminders
   - Initial mentor introduction
   - First assignment notifications

2. **Progress Monitoring**
   - Weekly progress reports
   - Inactivity alerts after 7 days
   - Assignment deadline reminders
   - Completion celebrations

3. **Payment Processing**
   - Automated invoice generation
   - Payment due reminders
   - Overdue notifications
   - Suspension workflows

### Manual Interventions

**Common Admin Tasks**:
- Password resets
- Status changes
- Mentor reassignments
- Payment adjustments
- Progress overrides

**Escalation Procedures**:
- Support ticket escalation
- Payment dispute resolution
- Academic integrity issues
- Technical support requests

## Performance and Scalability

### Optimization Strategies
- Efficient database queries with proper indexing
- Lazy loading for large student lists
- Caching for frequently accessed data
- Background processing for bulk operations

### Monitoring and Analytics
- Student engagement tracking
- System performance metrics
- Error rate monitoring
- User experience analytics

## Troubleshooting

### Common Issues

**Student Creation Failures**:
- Email already exists validation
- Phone number conflicts
- Payment plan configuration errors
- Edge Function timeout issues

**Access Problems**:
- Password reset requests
- Email delivery issues
- LMS status synchronization
- Role permission conflicts

**Progress Tracking Issues**:
- Module unlock problems
- Assignment gate failures
- Progress percentage calculation
- Mentor assignment conflicts

### Debug Procedures

```sql
-- Check student status
SELECT id, email, status, lms_status, onboarding_done
FROM public.users 
WHERE role = 'student' AND email = 'student@example.com';

-- Verify progress tracking
SELECT ump.*, m.title 
FROM public.user_module_progress ump
JOIN public.modules m ON m.id = ump.module_id
WHERE ump.user_id = 'student-uuid';

-- Payment status check
SELECT * FROM public.installment_payments 
WHERE user_id = 'student-uuid'
ORDER BY installment_number;
```

## Next Steps

Review [Learning Management](./learning-management.md) for content delivery details and [Assignment System](./assignment-system.md) for student assessment workflows.
