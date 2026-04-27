# Resend SMTP Configuration ⭐ Recommended

Resend is the recommended email provider for Growth OS - modern, reliable, and easy to set up.

## ⏱️ Setup Time: 5-10 minutes

## ✨ Why Resend?

- 🚀 **Modern API** - Built for developers
- 💰 **100 emails/day free** - Perfect for getting started
- 📧 **Excellent deliverability** - High inbox rates
- ⚡ **5-minute setup** - Fastest option
- 📊 **Built-in analytics** - Track email performance

## 📋 Step 1: Create Resend Account

1. Visit https://resend.com
2. Click "Sign Up" (free account)
3. Verify your email address
4. Login to dashboard

## 🔑 Step 2: Generate API Key

1. **Navigate to API Keys**:
   - In Resend dashboard, click "API Keys" in sidebar
   - Or visit https://resend.com/api-keys

2. **Create New API Key**:
   - Click "+ Create API Key"
   - Name: `Growth OS Production` (or whatever you prefer)
   - Permission: `Full Access`
   - Click "Create"

3. **Copy API Key** (shown only once):
   ```
   re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
   ⚠️ Save this securely - you won't see it again!

## 🌐 Step 3: Verify Domain (Optional but Recommended)

For production use, verify your domain:

1. **Add Domain**:
   - Click "Domains" in Resend dashboard
   - Click "+ Add Domain"
   - Enter your domain: `yourdomain.com`

2. **Add DNS Records**:
   Resend will show 3 DNS records to add:
   - **SPF Record** (TXT)
   - **DKIM Record** (TXT)
   - **DMARC Record** (TXT)

3. **Add to Your DNS**:
   - Login to your domain registrar (GoDaddy, Namecheap, CloudFlare, etc.)
   - Add the 3 DNS records
   - Wait 5-10 minutes for propagation

4. **Verify in Resend**:
   - Click "Verify" in Resend dashboard
   - Status should change to "Verified ✓"

## 🔐 Step 4: Add to Supabase Secrets

**CRITICAL**: Add these secrets in Supabase (NOT in your code):

### Via Supabase Dashboard

1. Open https://supabase.com/dashboard
2. Select your project
3. Go to **Settings → Edge Functions → Secrets**
4. Add each secret:

```bash
SMTP_HOST = smtp.resend.com
SMTP_PORT = 587
SMTP_USER = resend
SMTP_PASSWORD = re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Your API key
SMTP_FROM_EMAIL = noreply@yourdomain.com  # Your verified domain
SMTP_FROM_NAME = Growth OS  # Your company name
```

### Via Supabase CLI

```bash
supabase secrets set SMTP_HOST=smtp.resend.com --project-ref YOUR_PROJECT_REF
supabase secrets set SMTP_PORT=587 --project-ref YOUR_PROJECT_REF
supabase secrets set SMTP_USER=resend --project-ref YOUR_PROJECT_REF
supabase secrets set SMTP_PASSWORD=re_xxxxx --project-ref YOUR_PROJECT_REF
supabase secrets set SMTP_FROM_EMAIL=noreply@yourdomain.com --project-ref YOUR_PROJECT_REF
supabase secrets set SMTP_FROM_NAME="Growth OS" --project-ref YOUR_PROJECT_REF
```

## ✅ Step 5: Test Email Delivery

Send a test email:

```bash
# Via Supabase CLI
supabase functions invoke process-email-queue --project-ref YOUR_PROJECT_REF
```

Or from the application:
1. Login as admin
2. Navigate to Notifications
3. Send test notification
4. Check email inbox

## 📊 Monitor Email Delivery

### In Resend Dashboard

1. Go to https://resend.com/emails
2. View all sent emails
3. Check delivery status
4. See open rates and clicks

### In Supabase

```sql
-- Check email queue
SELECT * FROM email_queue 
WHERE status = 'sent' 
ORDER BY sent_at DESC 
LIMIT 10;
```

## 🎯 Production Checklist

- [ ] Resend account created
- [ ] API key generated and saved
- [ ] Domain verified (for production)
- [ ] Secrets added to Supabase
- [ ] Test email sent successfully
- [ ] Email received in inbox
- [ ] Sender name/email correct

## 📚 Additional Resources

- [Resend Documentation](https://resend.com/docs)
- [Resend API Reference](https://resend.com/docs/api-reference)
- [Growth OS SMTP Guide](./README.md)
