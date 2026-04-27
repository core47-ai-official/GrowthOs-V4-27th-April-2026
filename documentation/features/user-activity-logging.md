# User Activity Logging System

## Overview

The User Activity Logging system provides comprehensive audit trails, user behavior tracking, and administrative oversight capabilities to ensure security, compliance, and operational transparency.

## User-Facing Behavior

### For Students
- **Activity History**: View personal activity logs and learning history
- **Progress Tracking**: Automatic logging of learning milestones and achievements
- **Session Records**: Login/logout times and session duration tracking

### For Mentors
- **Student Activity Monitoring**: View activity logs for assigned students
- **Engagement Analytics**: Track student interaction patterns and progress
- **Mentorship Records**: Log mentoring sessions and student interactions

### For Admins/Superadmins
- **System Audit Trails**: Complete visibility into all user activities
- **Security Monitoring**: Track authentication events and suspicious activities
- **Administrative Actions**: Log all administrative changes and operations
- **Compliance Reporting**: Generate audit reports for regulatory requirements

## Technical Implementation

### Core Components
- `src/components/admin/ActivityLogs.tsx` - Admin activity log interface
- `src/components/superadmin/GlobalActivityLogs.tsx` - System-wide activity monitoring
- `src/components/ActivityLogsDialog.tsx` - Detailed activity view dialog
- `src/lib/activity-logger.ts` - Activity logging utilities

### Database Tables
- `user_activity_logs` - All user activity records
- `admin_logs` - Administrative action audit trail
- Automatic logging triggers across multiple tables

### Database Functions
```sql
-- Core logging functions
log_user_activity(user_id, activity_type, metadata)
audit_user() -- Trigger for user table changes
log_user_deletions() -- Secure deletion logging
```

### Activity Types
```typescript
// Comprehensive activity tracking
const ACTIVITY_TYPES = {
  // Authentication
  'login', 'logout', 'password_change', 'account_locked',
  
  // Learning Activities  
  'video_started', 'video_completed', 'assignment_submitted',
  'quiz_completed', 'module_completed', 'recording_unlocked',
  
  // System Interactions
  'profile_updated', 'notification_read', 'support_ticket_created',
  'session_attended', 'badge_earned',
  
  // Administrative Actions
  'user_created', 'user_deleted', 'role_changed', 'payment_processed'
};
```

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| No specific environment variables | Logging handled by database | N/A | N/A |

### Logging Configuration
| Setting | Purpose | Default | Location |
|---------|---------|---------|----------|
| Log retention period | How long to keep logs | Indefinite | Database policy |
| Activity detail level | Metadata verbosity | Full | Application logic |
| Anonymous logging | Log without user PII | False | Privacy settings |

### Hard-coded Settings
```typescript
// Logging behavior
const LOGGING_CONFIG = {
  MAX_METADATA_SIZE: 10000, // Maximum metadata JSON size
  BATCH_SIZE: 100, // Bulk logging batch size
  RETENTION_DAYS: null, // No automatic cleanup
  SENSITIVE_FIELDS: ['password', 'token', 'secret'] // Excluded from logs
};
```

## Security Considerations

### Access Control
- **Students**: Can only view their own activity logs
- **Mentors**: Access to assigned student activity logs
- **Admins**: Full access to user activity logs and admin logs
- **Superadmins**: Complete access to all logging systems

### Data Protection
- Sensitive data automatically excluded from log metadata
- Personal information is pseudonymized where possible
- Admin logs track all data access and modifications
- Compliance with data retention regulations

### Audit Trail Integrity
- Log entries are immutable once created
- Foreign key constraints prevent orphaned log entries
- Administrative actions are always logged
- Deletion activities specially tracked and protected

### Failure Modes
- **Logging Service Failure**: Graceful degradation without blocking operations
- **Storage Overflow**: Automatic log rotation and cleanup procedures
- **Performance Impact**: Asynchronous logging to minimize system impact
- **Data Corruption**: Log validation and integrity checking

## Key Logging Features

### Automatic Activity Tracking
```typescript
// Comprehensive activity logging
const logActivity = async (userId: string, activityType: string, metadata: any) => {
  // Sanitize sensitive data
  const sanitizedMetadata = sanitizeMetadata(metadata);
  
  // Insert activity log
  await supabase.from('user_activity_logs').insert({
    user_id: userId,
    activity_type: activityType,
    metadata: sanitizedMetadata,
    occurred_at: new Date()
  });
}
```

### Administrative Audit Trail
```typescript
// Admin action logging
const logAdminAction = (entityType: string, entityId: string, action: string, data: any) => {
  return supabase.from('admin_logs').insert({
    entity_type: entityType,
    entity_id: entityId,
    action: action,
    description: generateDescription(action, data),
    performed_by: auth.uid(),
    data: sanitizeAdminData(data)
  });
}
```

### Learning Progress Tracking
- Video watch time and completion tracking
- Assignment submission timestamps and status changes
- Quiz attempts and results logging
- Module progression and unlock events

### Security Event Monitoring
- Failed login attempts and account lockouts
- Privilege escalation and role changes
- Data access patterns and unusual activities
- System configuration changes

## Integration Points

### Real-time Monitoring
```typescript
// Live activity monitoring
const subscribeToActivityLogs = () => {
  return supabase
    .channel('activity_logs')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'user_activity_logs'
    }, handleNewActivity)
    .subscribe();
}
```

### Notification Integration
- Automated alerts for suspicious activities
- Administrative action notifications
- Security incident escalation
- Compliance violation alerts

### External System Integration
```typescript
// SIEM integration capability
const exportActivityLogs = (dateRange, format) => {
  // Export logs in standardized format
  // Compatible with security information systems
  // Automated compliance reporting
}
```

## Extending the System

### Advanced Analytics
```typescript
// Behavioral analytics
const generateUserBehaviorAnalysis = (userId) => {
  // Learning pattern analysis
  // Engagement trend detection
  // Anomaly identification
  // Performance correlation
}
```

### Compliance Reporting
```typescript
// Regulatory compliance reports
const generateComplianceReport = (period, standard) => {
  // GDPR compliance tracking
  // SOX audit trail reports
  // FERPA educational record logs
  // Custom compliance frameworks
}
```

### Real-time Alerting
1. Add alert configuration for specific activity patterns
2. Implement threshold-based monitoring
3. Create escalation procedures for security events
4. Add integration with external monitoring systems

### Data Retention Management
```sql
-- Automated log cleanup
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  -- Archive logs older than retention period
  -- Maintain referential integrity
  -- Preserve critical audit records
END;
$$ LANGUAGE plpgsql;
```

## Activity Log Categories

### Learning Activities
- Content access and consumption
- Assignment and quiz interactions
- Progress milestones and achievements
- Collaboration and discussion participation

### System Usage
- Login/logout patterns and session duration
- Feature usage and navigation patterns
- Search and discovery activities
- Support and help-seeking behavior

### Administrative Activities
- User management operations
- Content and course modifications
- System configuration changes
- Financial and billing operations

### Security Events
- Authentication successes and failures
- Permission changes and access attempts
- Data export and privacy-related activities
- System security configuration changes

## Troubleshooting

### Common Issues

**Activity Logs Not Recording**
- Check user_activity_logs table permissions
- Verify activity logging functions are working
- Confirm database triggers are active
- Review application logging code

**Performance Issues with Logging**
- Monitor database performance during high activity
- Check for missing indexes on activity logs
- Verify asynchronous logging implementation
- Consider log batching for high-volume operations

**Missing Admin Logs**
- Verify admin_logs table permissions
- Check audit triggers on monitored tables
- Confirm administrative functions include logging
- Review RLS policies for admin log access

**Log Data Inconsistencies**
- Validate foreign key relationships
- Check for concurrent logging operations
- Verify transaction isolation levels
- Review log entry validation logic

### Debugging Queries
```sql
-- Recent activity summary
SELECT activity_type, COUNT(*) as count, 
       MAX(occurred_at) as latest
FROM user_activity_logs 
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY activity_type
ORDER BY count DESC;

-- Admin action audit
SELECT entity_type, action, COUNT(*) as frequency,
       performed_by
FROM admin_logs 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY entity_type, action, performed_by
ORDER BY frequency DESC;

-- User activity patterns
SELECT user_id, COUNT(*) as activity_count,
       MIN(occurred_at) as first_activity,
       MAX(occurred_at) as last_activity
FROM user_activity_logs
WHERE occurred_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY activity_count DESC;
```

## Next Steps

Review [Security Considerations](../architecture.md#security-architecture) in the Architecture documentation and [Support Tickets](./support-tickets.md) for customer service audit requirements.