# Notifications System

## Overview

The Notifications System provides real-time, email, and in-app notifications for all user activities, system events, and automated reminders across Growth OS.

## User-Facing Behavior

### For All Users
- **In-App Notifications**: Real-time notification dropdown in header
- **Email Notifications**: Automated emails for important events
- **Notification History**: View past notifications and read status
- **Notification Preferences**: Control notification types (future feature)

### Notification Types
- **System Notifications**: Platform updates, maintenance alerts
- **Assignment Updates**: Submission status, new assignments
- **Financial Alerts**: Payment reminders, payment confirmations
- **Session Reminders**: Live session notifications, schedule changes
- **User Management**: Account status changes, role updates
- **Support Updates**: Ticket replies, status changes

## Technical Implementation

### Core Components
- `src/components/NotificationDropdown.tsx` - In-app notification interface
- `src/components/MotivationalNotifications.tsx` - Automated engagement notifications
- `src/lib/notification-service.ts` - Notification management utilities

### Database Infrastructure
- `notifications` table - All notification records
- `messages` table - Email message tracking
- Database functions for notification creation and distribution

### Edge Functions
- `motivational-notifications` - Automated engagement system
- `notification-scheduler` - Scheduled notification processing
- Email integration through SMTP configuration

### Key Database Functions
```sql
-- Core notification functions
create_notification(user_id, type, title, message, metadata)
notify_all_students(type, title, message, metadata)
notify_mentor_students(mentor_id, type, title, message, metadata)
```

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `SMTP_*` | SMTP email configuration | None | Required |
| `SMTP_HOST` | Custom SMTP server | None | Alternative |
| `SMTP_PORT` | SMTP port | 587 | If using SMTP |
| `SMTP_USER` | SMTP username | None | If using SMTP |
| `SMTP_PASSWORD` | SMTP password | None | If using SMTP |
| `SMTP_FROM_EMAIL` | Default sender email | None | Yes |
| `SMTP_FROM_NAME` | Default sender name | Growth OS | No |

### Notification Channels
```typescript
// Available notification channels
const CHANNELS = ['system', 'email', 'in_app', 'sms']; // SMS future

// Notification statuses  
const STATUSES = ['pending', 'sent', 'delivered', 'failed', 'read'];
```

### Hard-coded Triggers
- User status changes (suspension, activation)
- Assignment submissions and reviews
- Payment status updates
- Session scheduling and changes
- Support ticket interactions
- Module/content updates

## Security Considerations

### Access Control
- Users can only view their own notifications
- Admins can send system-wide notifications
- Mentors can notify their assigned students
- Email templates prevent information leakage

### Data Protection
- Notification content sanitized before sending
- Email addresses validated before delivery
- Personal information excluded from notification metadata
- Audit trails for all notification activities

### Failure Modes
- **Email Delivery Failures**: Graceful fallback to in-app notifications
- **Notification Overload**: Rate limiting on automated notifications
- **Template Errors**: Fallback to plain text notifications
- **Database Failures**: Queue system for retry logic

## Integration Points

### Email Service Integration
```typescript
// SMTP integration via Edge Functions
const sendEmailNotification = async (notification) => {
  const smtpClient = SMTPClient.fromEnv();
  
  await smtpClient.sendEmail({
    from: process.env.SMTP_LMS_FROM_EMAIL,
    to: user.email,
    subject: notification.title,
    html: formatNotificationTemplate(notification)
  });
}
```

### Real-time Updates
```typescript
// Supabase real-time subscriptions
const subscribeToNotifications = (userId) => {
  return supabase
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, handleNewNotification)
    .subscribe();
}
```

## Notification Triggers

### Automated Triggers (Database)
- `notify_admins_user_created()` - New user registration
- `notify_user_status_changes()` - Account status updates
- `notify_financial_events()` - Payment and invoice updates
- `notify_submission_status_change()` - Assignment reviews
- `handle_ticket_reply()` - Support ticket responses
- `handle_badge_award()` - Achievement notifications

### Manual Triggers (Admin Interface)
- System announcements
- Maintenance notifications
- Course updates
- Emergency communications

## Extending the System

### Adding SMS Notifications
> **Warning:** SMS integration requires third-party service setup

1. Add SMS provider Edge Function (Twilio, AWS SNS)
2. Update notification table with phone number support
3. Add SMS channel to notification creation functions
4. Implement SMS templates and rate limiting

### Push Notifications
```typescript
// Web Push API integration
const sendPushNotification = async (subscription, payload) => {
  // Requires service worker registration
  // Push notification service setup
}
```

### Advanced Templates
```typescript
// Dynamic email templates
const createEmailTemplate = (type, variables) => {
  // Template engine integration
  // Variable substitution
  // Multi-language support
}
```

### Notification Preferences
1. Add user_notification_preferences table
2. Create preference management UI
3. Update notification functions to check preferences
4. Implement granular notification controls

## Workflow Examples

### Assignment Notification Flow
1. Student submits assignment
2. `notify_submission_status_change()` trigger fires
3. Mentor receives in-app and email notification
4. Mentor reviews and approves/declines
5. Student receives status update notification
6. Next content unlocked, student notified

### System Announcement
1. Admin creates announcement in admin panel
2. `notify_all_students()` function called
3. In-app notifications created for all students
4. Email notifications queued and sent
5. Read receipts tracked in database

## Troubleshooting

### Common Issues

**Notifications Not Sending**
- Check SMTP email configuration
- Verify notification triggers in database
- Review Edge Function logs for errors
- Confirm user email addresses are valid

**Duplicate Notifications**
- Check trigger logic for race conditions
- Verify notification deduplication
- Review database constraints

**Email Delivery Issues**
- Validate sender domain authentication
- Check spam folder and email filters
- Verify email service quota limits
- Test with different email providers

**Real-time Updates Not Working**
- Confirm Supabase real-time is enabled
- Check WebSocket connection status
- Verify RLS policies allow real-time access
- Test with browser developer tools

### Debugging Commands
```sql
-- Check recent notifications
SELECT * FROM notifications 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check failed email deliveries
SELECT * FROM messages 
WHERE status = 'failed'
ORDER BY sent_at DESC;
```

## Next Steps

Review [Support Tickets](./support-tickets.md) for notification integration with customer support and [User Activity Logging](./user-activity-logging.md) for audit trail management.
