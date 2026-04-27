# SMTP Email Integration

## Overview

Growth OS uses SMTP email configuration through Supabase Edge Function secrets for all email delivery, handling transactional emails, notifications, and automated communications.

## Purpose in Project

- **Transactional Emails**: Account creation, password resets, notifications
- **Automated Communications**: Payment reminders, assignment updates
- **System Notifications**: Session reminders, support ticket updates
- **Marketing Communications**: Announcements and system updates

## Setup and Configuration

### SMTP Configuration
1. Configure your email provider (Gmail, Outlook, SendGrid, etc.)
2. Obtain SMTP credentials from your email provider
3. Add SMTP credentials to Supabase Edge Function secrets
4. Configure sender email addresses in company settings

### Required Supabase Secrets
Add these secrets via Supabase Dashboard > Edge Functions > Settings:
- `SMTP_HOST`: SMTP server hostname (e.g., smtp.gmail.com)
- `SMTP_PORT`: SMTP server port (587 for TLS, 465 for SSL)
- `SMTP_USER`: SMTP username/email
- `SMTP_PASSWORD`: SMTP password/app password
- `SMTP_FROM_EMAIL`: Default sender email address
- `SMTP_FROM_NAME`: Default sender name (fallback: "Growth OS")

## Integration Points

### Edge Functions
Email sending handled through Edge Functions using SMTPClient:
```typescript
import { SMTPClient } from '../_shared/smtp-client.ts';
const smtpClient = SMTPClient.fromEnv();
```

### Email Templates
- Student onboarding emails
- Payment confirmation notifications  
- Assignment submission alerts
- Support ticket responses

## Troubleshooting

### Common Issues
- **Authentication Failures**: Verify SMTP credentials and app passwords
- **Connection Timeouts**: Check SMTP host and port configuration
- **Delivery Failures**: Check spam folders and email filters

### Email Provider Configuration
Each provider requires specific setup:
- **Gmail**: Enable 2FA and use App Passwords
- **Outlook**: Use modern authentication
- **SendGrid**: Use API key as password

## Next Steps
Review [Notifications System](../features/notifications-system.md) for email integration details.