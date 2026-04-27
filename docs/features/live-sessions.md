# Live Sessions Management

## Overview

The Live Sessions system manages scheduled success sessions, mentorship meetings, and group coaching calls with integrated attendance tracking and mentor assignment.

## User-Facing Behavior

### For Students
- **Session Calendar**: View upcoming live sessions and schedules
- **Session Registration**: Join scheduled success sessions
- **Attendance Tracking**: Automatic attendance recording
- **Session Recordings**: Access to recorded sessions (if available)

### For Mentors
- **Session Hosting**: Lead assigned success sessions
- **Student Management**: View attendee lists and engagement
- **Session Scheduling**: Create and manage session times
- **Attendance Reports**: Track student participation

### For Admins/Superadmins
- **Session Creation**: Schedule new success sessions
- **Mentor Assignment**: Assign sessions to specific mentors
- **Attendance Analytics**: View participation metrics
- **Session Management**: Edit, cancel, or reschedule sessions

## Technical Implementation

### Core Components
- `src/pages/LiveSessions.tsx` - Main session interface
- `src/components/superadmin/SuccessSessionsManagement.tsx` - Admin session management
- `src/pages/MentorSessionsPage.tsx` - Mentor session dashboard

### Database Tables
- `success_sessions` - Session schedules and details
- `session_attendance` - Attendance tracking records
- `segmented_weekly_success_sessions` - Automated session view

### Key Functions
- `handle_success_session_changes()` - Database trigger for notifications
- Session notification system via email

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `SMTP_*` / `RESEND_API_KEY` | Session notifications | None | Yes |

### Database Settings
| Field | Purpose | Default |
|-------|---------|---------|
| `status` | Session state | 'upcoming' |
| `mentor_id` | Assigned mentor | NULL |
| `course_id` | Target course | NULL |
| `batch_id` | Target batch (NULL = unbatched students) | NULL |
| `start_time` / `end_time` | Session schedule | Required |
| `zoom_meeting_id` | Meeting ID | NULL |
| `zoom_passcode` | Meeting password | NULL |
| `link` | Session URL | Required |

### Hard-coded Values
```typescript
// Session statuses
const SESSION_STATUS = ['upcoming', 'live', 'completed', 'cancelled'];

// Default session duration
const DEFAULT_SESSION_DURATION = 60; // minutes
```

## Security Considerations

### Access Control
- Students only see sessions matching their **active enrollment** (`course_enrollments.status = 'active'`) with matching `course_id` and `batch_id` (or unbatched status)
- Mentors only see sessions where they are assigned as host (`mentor_id = auth.uid()`)
- Admins/Superadmins/Enrollment Managers can view and manage all sessions
- Session links may require authentication

### Data Protection
- Session credentials (passcodes) stored securely
- Attendance data linked to user IDs only
- Session recordings access controlled

### Failure Modes
- **Session Link Failures**: Backup meeting platforms needed
- **Attendance Tracking**: Manual backup for technical issues
- **Notification Delivery**: Email failures may cause missed sessions
- **Mentor Availability**: Session reassignment procedures

## Integration Points

### Zoom Integration
```typescript
// Session creation with Zoom details
const createSession = {
  zoom_meeting_id: "123456789",
  zoom_passcode: "secure123",
  link: "https://zoom.us/j/123456789"
}
```

### Email Notifications
- Session reminders sent automatically
- Schedule changes notify all participants
- Attendance summaries for mentors

### Calendar Integration
- iCal export capabilities
- Session time zone handling
- Recurring session support

## Extending the System

### Adding Video Platforms
1. Update session creation form for new platform
2. Add platform-specific fields to database
3. Implement platform integration in Edge Functions
4. Update notification templates

### Advanced Scheduling
```typescript
// Recurring sessions
const createRecurringSession = (sessionData, recurrence) => {
  // Generate multiple sessions based on pattern
  // Weekly, bi-weekly, monthly options
}
```

### Attendance Analytics
```typescript
// Detailed participation metrics
const generateAttendanceReport = (dateRange) => {
  // Student participation rates
  // Session effectiveness metrics
  // Mentor performance data
}
```

### Session Recordings
> **Note:** Recording integration requires additional video platform setup

1. Configure recording permissions in video platform
2. Add recording URL field to database
3. Implement recording access controls
4. Create recording management interface

## Workflow Examples

### Creating a Success Session
1. Admin navigates to Success Sessions Management
2. Clicks "Create New Session"
3. Fills session details (title, description, schedule)
4. Assigns mentor from dropdown
5. Adds Zoom/meeting platform details
6. Saves session - notifications sent automatically

### Student Joining Session
1. Student views Live Sessions page
2. Sees upcoming sessions in calendar view
3. Clicks "Join Session" link
4. Attendance automatically recorded
5. Session details displayed with meeting credentials

## Troubleshooting

### Common Issues

**Sessions Not Appearing**
- Check database permissions for success_sessions table
- Verify RLS policies allow user access
- Confirm session status is not 'cancelled'

**Attendance Not Recording**
- Verify session_attendance table permissions
- Check if user is properly authenticated
- Confirm session ID is valid

**Notification Failures**
- Validate email configuration
- Check notification triggers in database
- Review Edge Function logs for email service

**Meeting Platform Issues**
- Verify meeting credentials are correct
- Check platform API integration
- Ensure meeting links are valid and active

## Next Steps

Review [Mentorship Program](./mentorship-program.md) for one-on-one session management and [Notifications System](./notifications-system.md) for session reminder configuration.