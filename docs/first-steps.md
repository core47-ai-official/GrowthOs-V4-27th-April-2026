# First Steps - Complete Setup Guide

This comprehensive guide covers everything needed to host and configure Growth OS, from initial setup to production deployment.

## 📋 Prerequisites

Before starting, ensure you have:

- **Node.js 18+** and npm installed
- **Git** for version control
- **Supabase account** (free tier available)
- **SMTP email credentials** for email delivery (Gmail, Outlook, SendGrid, etc.)
- **Domain name** (optional, for custom branding)

## 🚀 Initial Setup

### 1. Repository Setup

```bash
# Clone the repository
git clone <your-repository-url>
cd growth-os

# Install dependencies
npm install

# Copy environment template
cp .env.example .env
```

### 2. Environment Configuration

Edit your `.env` file with the following required variables:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Email Configuration (SMTP - added as Supabase secrets)
# These will be configured in Supabase Edge Function secrets
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@company.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your Company Name

# Company Branding
VITE_COMPANY_NAME=Your Company Name
VITE_PRIMARY_COLOR=#your-brand-color
VITE_SUPPORT_EMAIL=support@yourdomain.com

```

### 3. Supabase Project Setup

#### Create New Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and set project name
4. Set database password (save this securely)
5. Select region closest to your users

#### Configure Authentication
1. Navigate to Authentication > Settings
2. Enable email confirmations: **OFF** (for faster onboarding)
3. Set password requirements
4. Configure session timeout (default: 1 week)

#### Database Migration
1. Navigate to SQL Editor in Supabase Dashboard
2. Copy contents of `database-migration-complete.sql`
3. Execute the migration script
4. Verify tables were created successfully

#### Storage Setup
```sql
-- Create required storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
('assignment-files', 'assignment-files', true),
('company-branding', 'company-branding', true);

-- Create storage policies
CREATE POLICY "Assignment files are accessible by authenticated users" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'assignment-files' AND auth.role() = 'authenticated');

CREATE POLICY "Company branding is publicly accessible" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'company-branding');
```

#### Edge Functions Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Deploy all Edge Functions
supabase functions deploy --project-ref your-project-ref

# Set required secrets
supabase secrets set SMTP_HOST=smtp.gmail.com --project-ref your-project-ref
supabase secrets set SMTP_PORT=587 --project-ref your-project-ref
supabase secrets set SMTP_USER=your-email@company.com --project-ref your-project-ref
supabase secrets set SMTP_PASSWORD=your-app-password --project-ref your-project-ref
supabase secrets set SMTP_FROM_EMAIL=noreply@company.com --project-ref your-project-ref
supabase secrets set SMTP_FROM_NAME="Growth OS" --project-ref your-project-ref
```

## 🎨 Branding & Customization

### 1. Update Favicon
1. Prepare favicon file (PNG/JPG format, 32x32 or 512x512 pixels)
2. Upload to `public/` folder or use external URL
3. Update `index.html`:
```html
<link rel="icon" href="/your-favicon.png" type="image/png">
```

### 2. Company Logo Setup
1. Navigate to Superadmin Dashboard > Company Settings
2. Upload company logo (recommended: PNG with transparent background)
3. Logo will automatically appear in:
   - Navigation header
   - Email templates
   - PDF invoices
   - Login page

### 3. Color Theme Customization
Edit `src/index.css` to customize your brand colors:

```css
:root {
  /* Primary brand colors */
  --primary: 210 100% 50%;    /* Your main brand color */
  --primary-foreground: 0 0% 100%;
  
  /* Secondary colors */
  --secondary: 210 50% 95%;
  --secondary-foreground: 210 50% 10%;
  
  /* Accent colors */
  --accent: 210 100% 95%;
  --accent-foreground: 210 100% 10%;
  
  /* Background colors */
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}
```

## 📧 Email Service Configuration

### 1. SMTP Email Setup
1. Choose your email provider (Gmail, Outlook, SendGrid, etc.)
2. Configure SMTP credentials:
   - **Gmail**: Enable 2FA and create App Password
   - **Outlook**: Use account credentials or app password  
   - **SendGrid**: Use API key as password
3. Add SMTP configuration to Supabase secrets:
   ```bash
   supabase secrets set SMTP_HOST=smtp.gmail.com --project-ref your-project-ref
   supabase secrets set SMTP_PORT=587 --project-ref your-project-ref
   supabase secrets set SMTP_USER=your-email@company.com --project-ref your-project-ref
   supabase secrets set SMTP_PASSWORD=your-app-password --project-ref your-project-ref
   ```
4. Add API key to your environment variables

### 2. Custom SMTP (Alternative)
If using custom SMTP instead of Resend:
```bash
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_SECURE=true
```

### 3. Email Testing
```bash
# Test email delivery
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/test-email' \
  -H 'Authorization: Bearer your-anon-key' \
  -H 'Content-Type: application/json' \
  -d '{"to": "test@yourdomain.com", "subject": "Test Email"}'
```

## 👥 Initial User Setup

### 1. Create Superadmin Account
```sql
-- Execute in Supabase SQL Editor
INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, created_at, updated_at)
VALUES (
  'admin@yourdomain.com',
  crypt('your-secure-password', gen_salt('bf')),
  now(),
  now(),
  now()
);

-- Get the user ID and create profile
INSERT INTO profiles (user_id, full_name, role)
SELECT id, 'System Administrator', 'superadmin'
FROM auth.users 
WHERE email = 'admin@yourdomain.com';
```

### 2. Configure Company Settings
1. Login with superadmin account
2. Navigate to Company Settings
3. Configure:
   - Company name and contact information
   - Default course pricing
   - Installment plan options
   - System-wide settings

### 3. Create First Mentor
1. Use Superadmin Dashboard > Team Management
2. Create mentor account with appropriate permissions
3. Test mentor login and assign to test student

## 🔧 System Configuration

### 1. LMS Access Control
Configure who can access the learning content:
```sql
-- Update company settings for LMS access
UPDATE company_settings 
SET lms_access_enabled = true,
    require_payment_for_access = false  -- Set to true for paid access
WHERE id = 1;
```

### 2. Payment Configuration
```sql
-- Configure installment plans
UPDATE company_settings 
SET installment_plans = '[
  {"installments": 1, "amount_per_installment": 997, "description": "Full payment"},
  {"installments": 2, "amount_per_installment": 498.50, "description": "2 installments"},
  {"installments": 3, "amount_per_installment": 332.33, "description": "3 installments"}
]'::jsonb
WHERE id = 1;
```

### 3. Notification Settings
```sql
-- Configure notification preferences
UPDATE company_settings 
SET notification_settings = '{
  "email_notifications": true,
  "assignment_reminders": true,
  "payment_reminders": true,
  "milestone_celebrations": true
}'::jsonb
WHERE id = 1;
```

## 🌐 Deployment Options

### Option 1: Vercel Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Configure environment variables in Vercel dashboard
```

### Option 2: Netlify Deployment
```bash
# Build the project
npm run build

# Deploy to Netlify
# Upload dist/ folder to Netlify or connect GitHub
```

### Option 3: Self-Hosted
```bash
# Build for production
npm run build

# Serve with any static file server
npx serve dist
# or upload dist/ contents to your web server
```

## 🔒 Production Security Setup

### 1. Environment Variables Security
- Never commit `.env` files to version control
- Use secure secret management in production
- Rotate API keys regularly
- Monitor access logs

### 2. Database Security
- Enable Row Level Security (RLS) on all tables
- Review and test all RLS policies
- Use least-privilege access principles
- Regular security audits

### 3. HTTPS Configuration
- Enable HTTPS on your domain
- Configure security headers
- Set up Content Security Policy (CSP)
- Enable HSTS headers

## 📊 Monitoring & Maintenance

### 1. System Health Monitoring
- Set up uptime monitoring
- Configure error tracking
- Monitor database performance
- Track email delivery rates

### 2. Backup Strategy
```bash
# Automate database backups
supabase db dump --data-only --project-ref your-project-ref > backup.sql

# Schedule regular backups with cron or CI/CD
```

### 3. Performance Optimization
- Monitor Core Web Vitals
- Optimize image sizes
- Enable CDN for static assets
- Regular performance audits

## 🆘 Troubleshooting

### Common Issues

**Email Not Sending**
- Verify SMTP configuration
- Check domain verification status
- Review DNS records
- Test with different email addresses

**Database Connection Errors**
- Verify Supabase project URL
- Check API keys
- Review RLS policies
- Monitor connection limits

**File Upload Issues**
- Check storage bucket policies
- Verify file size limits
- Review CORS settings
- Test with different file types

**Authentication Problems**
- Verify JWT secret
- Check session timeout settings
- Review user permissions
- Test with fresh browser session

### Getting Help
1. Check system logs in Supabase Dashboard
2. Review error messages in browser console
3. Test with minimal configuration
4. Contact support with specific error details

## ✅ Post-Setup Checklist

After completing setup, verify:

- [ ] Application loads without errors
- [ ] User registration and login works
- [ ] Email delivery is functional
- [ ] File uploads work correctly
- [ ] All user roles have appropriate access
- [ ] Payment tracking functions properly
- [ ] Notifications are being sent
- [ ] Branding appears correctly
- [ ] SSL certificate is active
- [ ] Backup system is configured

## 🚀 Next Steps

Once your Growth OS instance is running:

1. **Create Sample Content**: Add modules, lessons, and assignments
2. **Test User Journeys**: Complete full student and mentor workflows
3. **Configure Integrations**: Set up Shopify or other third-party services
4. **Train Administrators**: Ensure team knows how to use admin features
5. **Plan Content Strategy**: Develop comprehensive course content
6. **Set Up Analytics**: Configure tracking and reporting
7. **Establish Support Processes**: Create customer support workflows

## 📚 Additional Resources

- [Feature Documentation](./features/) - Detailed feature guides
- [User Role Documentation](./roles/) - Role-specific capabilities
- [Integration Guides](./integrations/) - Third-party service setup
- [API Documentation](./api/) - Developer reference
- [Troubleshooting Guide](./troubleshooting.md) - Common issues and solutions

---

**Need Help?** Contact support at your configured support email or refer to the troubleshooting documentation.
