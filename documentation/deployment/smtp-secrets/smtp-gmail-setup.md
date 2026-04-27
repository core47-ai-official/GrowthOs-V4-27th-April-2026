# Gmail SMTP Configuration

Use Gmail SMTP for testing or small-scale deployments.

## ⚠️ Limitations

- Limited sending volume
- Requires App Password (2FA must be enabled)
- Not recommended for production
- Good for testing only

## 📋 Step 1: Enable 2-Factor Authentication

1. Go to https://myaccount.google.com/security
2. Click "2-Step Verification"
3. Follow setup wizard
4. Verify with phone

## 🔑 Step 2: Generate App Password

1. Visit https://myaccount.google.com/apppasswords
2. Select app: "Mail"
3. Select device: "Other (Custom name)"
4. Enter name: "Growth OS"
5. Click "Generate"
6. Copy 16-character password: `xxxx xxxx xxxx xxxx`

## 🔐 Step 3: Add to Supabase Secrets

```bash
SMTP_HOST = smtp.gmail.com
SMTP_PORT = 587
SMTP_USER = your-email@gmail.com
SMTP_PASSWORD = xxxx xxxx xxxx xxxx  # App Password (remove spaces)
SMTP_FROM_EMAIL = your-email@gmail.com
SMTP_FROM_NAME = Your Company Name
```

## ✅ Test & Verify

Send test email and check delivery.

For production, use [Resend](./resend-setup.md) instead.
