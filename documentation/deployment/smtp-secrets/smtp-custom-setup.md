# Custom SMTP Configuration

Configure Growth OS with any SMTP provider: SendGrid, Mailgun, Amazon SES, Postmark, etc.

## 🔧 Generic SMTP Configuration

All SMTP providers require these settings:

```bash
SMTP_HOST = smtp.yourprovider.com
SMTP_PORT = 587  # or 465 for SSL
SMTP_USER = your_smtp_username
SMTP_PASSWORD = your_smtp_password
SMTP_FROM_EMAIL = noreply@yourdomain.com
SMTP_FROM_NAME = Your Company Name
```

## 📧 Provider Examples

### SendGrid
```bash
SMTP_HOST = smtp.sendgrid.net
SMTP_PORT = 587
SMTP_USER = apikey
SMTP_PASSWORD = SG.xxxxxxxxxxxxxxxx
```

### Mailgun
```bash
SMTP_HOST = smtp.mailgun.org
SMTP_PORT = 587
SMTP_USER = postmaster@yourdomain.com
SMTP_PASSWORD = your_mailgun_password
```

### Amazon SES
```bash
SMTP_HOST = email-smtp.us-east-1.amazonaws.com
SMTP_PORT = 587
SMTP_USER = your_ses_username
SMTP_PASSWORD = your_ses_password
```

## ✅ Add to Supabase

Follow [main SMTP guide](./README.md) to add secrets to Supabase Dashboard.
