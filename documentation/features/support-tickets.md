# Support Ticket System

## Overview

The Support Ticket System provides a comprehensive help desk solution with multi-tier support, ticket routing, and automated notifications for customer service management.

## User-Facing Behavior

### For Students
- **Ticket Creation**: Submit support requests with priority levels
- **Ticket Tracking**: View ticket status and response history
- **Reply System**: Respond to staff replies and provide additional information
- **Ticket Categories**: Select appropriate support categories

### For Staff (Mentors, Admins, Superadmins)
- **Ticket Management**: View, assign, and resolve support tickets
- **Response System**: Reply to tickets with rich text responses
- **Priority Handling**: Manage urgent tickets with priority escalation
- **Ticket Assignment**: Route tickets to appropriate team members
- **Status Updates**: Update ticket status and track resolution

## Technical Implementation

### Core Components
- `src/components/superadmin/SupportManagement.tsx` - Admin ticket management interface
- `src/pages/Support.tsx` - User support portal
- Integrated notification system for ticket updates

### Database Tables
- `support_tickets` - Main ticket records
- `ticket_replies` - Conversation threads
- `notifications` - Ticket update notifications

### Database Functions
- `handle_ticket_reply()` - Notification trigger for new replies
- `handle_ticket_status_change()` - Status update notifications
- RLS policies for role-based ticket access

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `SMTP_*` / `RESEND_API_KEY` | Ticket notifications | None | Yes |

### Ticket Configuration
| Field | Options | Default | Description |
|-------|---------|---------|-------------|
| `status` | open, in_progress, resolved, closed | open | Ticket state |
| `priority` | low, medium, high, urgent | medium | Response priority |
| `type` | general, technical, billing, account | general | Support category |
| `assigned_to` | UUID (staff member) | NULL | Ticket assignment |

### Hard-coded Values
```typescript
// Ticket statuses
const TICKET_STATUS = ['open', 'in_progress', 'resolved', 'closed'];

// Priority levels
const PRIORITY_LEVELS = ['low', 'medium', 'high', 'urgent'];

// Support categories
const TICKET_TYPES = ['general', 'technical', 'billing', 'account'];
```

## Security Considerations

### Access Control
- **Students**: Can only view and reply to their own tickets
- **Mentors**: Can view and respond to all tickets (limited assignment)
- **Admins**: Full ticket management including assignment and status changes
- **Superadmins**: Complete access to all support functions

### Data Protection
- Ticket content is private to ticket owner and staff
- Personal information in tickets is protected by RLS
- Audit trails track all ticket modifications
- Staff replies are marked with `is_staff` flag

### Failure Modes
- **Email Notification Failures**: In-app notifications as backup
- **Assignment Conflicts**: Multiple staff assignment prevention
- **Data Loss**: Ticket deletion is restricted
- **Escalation Issues**: Priority-based routing may need manual override

## Workflow Examples

### Student Creating Ticket
1. Student navigates to Support page
2. Fills out ticket form (title, description, type, priority)
3. Submits ticket - automatically assigned ID and 'open' status
4. Email notification sent to support staff
5. Student receives confirmation notification

### Staff Responding to Ticket
1. Staff member views ticket in Support Management
2. Reviews ticket details and history
3. Adds reply with solution or follow-up questions
4. Updates ticket status if resolved
5. Student receives email and in-app notification

### Ticket Escalation
1. High/urgent priority tickets highlighted in interface
2. Automatic notifications to admin staff
3. Optional assignment to senior support members
4. SLA tracking for response times

## Integration Points

### Notification System
```typescript
// Automatic notifications for ticket events
const ticketNotifications = {
  new_ticket: 'notify_admins_new_ticket',
  status_change: 'notify_ticket_status_change', 
  new_reply: 'notify_ticket_reply',
  assignment: 'notify_ticket_assignment'
}
```

### Email Templates
- New ticket confirmation
- Reply notifications
- Status change alerts
- Resolution confirmations

### User Activity Logging
```typescript
// Ticket activities logged for audit
const logTicketActivity = (ticketId, action, userId) => {
  // Tracks: creation, replies, status changes, assignments
}
```

## Extending the System

### SLA Management
> **Note:** Service Level Agreement tracking requires additional development

```typescript
// SLA tracking implementation
const calculateSLA = (ticket) => {
  const responseTime = {
    urgent: 2 * 60 * 60 * 1000, // 2 hours
    high: 4 * 60 * 60 * 1000,   // 4 hours  
    medium: 24 * 60 * 60 * 1000, // 24 hours
    low: 72 * 60 * 60 * 1000     // 72 hours
  };
  
  return responseTime[ticket.priority];
}
```

### Advanced Routing
1. Add category-specific assignment rules
2. Implement automatic escalation based on response time
3. Create skill-based routing for technical issues
4. Add workload balancing for support staff

### Knowledge Base Integration
```typescript
// Self-service options
const suggestKnowledgeBase = (ticketContent) => {
  // AI-powered content matching
  // FAQ suggestions
  // Documentation links
}
```

### Multi-Department Support
1. Add department field to support_tickets table
2. Create department-specific routing rules
3. Implement department-based access controls
4. Add department performance metrics

## Analytics and Reporting

### Ticket Metrics
- Response time by priority level
- Resolution rate by category
- Staff performance metrics
- Customer satisfaction scores

### Report Generation
```typescript
// Support analytics
const generateSupportReport = (dateRange) => {
  // Ticket volume trends
  // Resolution time analysis  
  // Staff productivity metrics
  // Customer satisfaction data
}
```

## Troubleshooting

### Common Issues

**Tickets Not Creating**
- Check RLS policies for support_tickets table
- Verify user authentication status
- Confirm required fields are provided
- Review database constraints

**Notifications Not Sending**
- Validate email configuration
- Check notification triggers in database
- Verify staff user roles and permissions
- Review Edge Function logs

**Reply System Issues**
- Check ticket_replies table permissions
- Verify foreign key relationships
- Confirm user has access to ticket
- Test with different user roles

**Assignment Problems**
- Verify assigned staff member exists
- Check user role permissions for assignment
- Confirm assignment update RLS policies
- Test assignment notification triggers

### Debugging Queries
```sql
-- View recent tickets with details
SELECT t.*, u.full_name as creator_name, a.full_name as assigned_name
FROM support_tickets t
LEFT JOIN users u ON t.user_id = u.id  
LEFT JOIN users a ON t.assigned_to = a.id
ORDER BY t.created_at DESC;

-- Check ticket reply counts
SELECT ticket_id, COUNT(*) as reply_count
FROM ticket_replies 
GROUP BY ticket_id
ORDER BY reply_count DESC;
```

## Next Steps

Review [User Activity Logging](./user-activity-logging.md) for audit trail integration and [Notifications System](./notifications-system.md) for detailed notification configuration.