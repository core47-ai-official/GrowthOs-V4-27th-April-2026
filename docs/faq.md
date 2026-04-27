# Frequently Asked Questions

## General Questions

### What is Growth OS?
Growth OS is a comprehensive Learning Management System designed for e-commerce education and mentorship programs. It provides structured learning paths, assignment management, financial tracking, and personalized mentorship.

### Who can use Growth OS?
The platform supports five user roles:
- **Students**: Learn through structured modules and assignments
- **Mentors**: Guide students and review assignments
- **Admins**: Manage day-to-day operations
- **Superadmins**: Full system configuration
- **Enrollment Managers**: Handle student onboarding

### How much does it cost to run Growth OS?
Growth OS uses a pay-as-you-go model through Supabase and your email provider:
- **Supabase**: Free tier supports up to 50,000 monthly active users
- **Email Provider**: Most providers offer free tiers (Gmail, Outlook, etc.)
- **Hosting**: Free on CloudFlare platform with optional custom domain

## Student Questions

### How do I access my courses?
1. Log in with credentials provided by your admin
2. Complete the onboarding questionnaire
3. Wait for LMS access to be granted
4. Navigate to "Modules & Videos" to start learning

### Why can't I see the next video?
Content unlocks sequentially. You must:
1. Watch the current video completely (90% minimum)
2. Complete any associated assignment
3. Receive mentor approval for your submission
4. Next content automatically unlocks

### How do I submit assignments?
1. Complete the required video lesson
2. Navigate to "Assignments" tab
3. Click on the available assignment
4. Submit text, upload files, or provide URLs as required
5. Await mentor feedback

### What if I miss a payment deadline?
- Payment reminders are sent automatically
- Late payments may result in temporary LMS suspension
- Contact your enrollment manager to discuss payment plans
- Your progress is saved and resumes upon payment

## Mentor Questions

### How do I review student assignments?
1. Go to your Mentor Dashboard
2. Check "Pending Reviews" section
3. Click on student submission to review
4. Provide detailed feedback
5. Approve or request revisions

### How many students can I mentor?
The default limit is 20 students per mentor, but this can be adjusted by administrators based on capacity and performance.

### How do I schedule sessions with students?
1. Navigate to "Live Sessions" or "Mentorship" section
2. Use the scheduling interface to book time slots
3. Students receive automatic notifications
4. Session details are sent via email

## Admin Questions

### How do I create new student accounts?
1. Go to Admin Panel → Students
2. Click "Add New Student"
3. Fill in student details and select installment plan
4. System automatically generates credentials and sends welcome email
5. Manually grant LMS access when payment is confirmed

### How do I customize company branding?
1. Navigate to Admin Panel → Company Settings
2. Upload company logo (favicon needs to be updated from the backend)
3. Configure email templates and sender information
4. Customize colors and styling through the interface

### How do I process payments?
1. Go to Admin Panel → Financial Management
2. View installment payment records
3. Mark payments as received manually
4. System automatically updates student status
5. Late payment notifications are sent automatically

## Technical Questions

### What browsers are supported?
Growth OS works on all modern browsers:
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

### Can I integrate with other systems?
Yes, Growth OS supports:
- **Shopify**: E-commerce metrics integration
- **N8N**: Workflow automation via webhooks
- **Custom APIs**: Through Supabase Edge Functions
- **Email Platforms**: Custom SMTP configuration

### Is my data secure?
Security measures include:
- Row Level Security (RLS) for database access
- JWT token authentication
- Encrypted file storage
- Audit logging for all activities
- Regular security updates

### How do I backup my data?
- **Automatic**: Supabase provides daily backups
- **Manual**: Export data via admin panel
- **Custom**: Configure additional backup services
- **Recovery**: Contact support for data restoration

## Troubleshooting

### Students can't log in
1. Verify account status is "Active"
2. Check if LMS access is granted
3. Confirm email/password combination
4. Clear browser cache and cookies
5. Try password reset if needed

### Emails not being delivered
1. Check SMTP configuration in company settings
2. Verify sender domain authentication
3. Check spam/junk folders
4. Confirm email addresses are valid
5. Review email delivery logs

### Videos won't play
1. Check internet connection speed
2. Try different browser or device
3. Disable browser extensions
4. Clear browser cache
5. Contact support if issues persist

### Assignment submissions failing
1. Check file size limits (10MB maximum)
2. Verify file format is supported
3. Ensure stable internet connection
4. Try submitting from different browser
5. Contact mentor if deadline is approaching

## Getting Help

### How do I contact support?
1. **Students**: Use in-app support ticket system
2. **Mentors/Admins**: Direct email to system administrators
3. **Technical Issues**: Check documentation first, then email at support@core47.ai
4. **Urgent Issues**: Contact superadmin directly

### Where can I find more information?
- **Documentation**: Complete guides in `/docs` folder
- **Video Tutorials**: Available in platform help section
- **Community**: Access to user forums and discussion groups
- **Training**: Admin and mentor training sessions available

### What if I have a feature request?
1. Submit detailed request through at support@core47.ai
2. Include business justification and use case
3. Provide mockups or examples if available
4. Feature requests are reviewed quarterly
5. High-impact features are prioritized for development

## Next Steps
For more detailed information, see the [Glossary](./glossary.md) for technical terms or review specific [Feature Documentation](./features/) for in-depth guides.
