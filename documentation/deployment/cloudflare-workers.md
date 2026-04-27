# Deploy to CloudFlare Workers

Complete guide for deploying Growth OS to CloudFlare Workers for global edge deployment with automatic HTTPS and excellent performance.

**Developed by Core47.ai** | Enterprise Learning Management System

## 🌟 Why CloudFlare Workers?

- ⚡ **Global Edge Network** - Deploy to 275+ locations worldwide
- 🚀 **Fast Performance** - Sub-50ms response times globally
- 🔒 **Automatic HTTPS** - Free SSL certificates
- 💰 **Generous Free Tier** - 100,000 requests/day free
- 🔄 **Git Integration** - Deploy from GitHub automatically
- 📊 **Analytics** - Built-in usage analytics

## ⏱️ Deployment Time

- **First Time**: ~20-30 minutes
- **Subsequent Deployments**: ~5 minutes

## 📋 Prerequisites

### Required

- ✅ CloudFlare account (free tier works)
- ✅ GitHub repository with Growth OS code
- ✅ Supabase project set up ([Guide](./supabase-setup.md))
- ✅ Database configured ([Guide](./database-setup.md))
- ✅ SMTP configured ([Guide](./smtp-secrets/README.md))

### Tools Needed

- Node.js 18+ installed
- Git installed
- Terminal/Command line access

## 🚀 Step 1: Install Wrangler CLI

Wrangler is CloudFlare's command-line tool for Workers.

```bash
# Install Wrangler globally
npm install -g wrangler

# Verify installation
wrangler --version
```

**Expected Output:**
```
⛅️ wrangler 3.x.x
```

## 🔑 Step 2: Login to CloudFlare

Authenticate Wrangler with your CloudFlare account:

```bash
# Login to CloudFlare
wrangler login
```

This will:
1. Open your browser
2. Ask you to authorize Wrangler
3. Save authentication tokens locally

**Verify login:**
```bash
wrangler whoami
```

## ⚠️ Step 3: Prepare Repository (CRITICAL)

### Delete bun.lockb File

**CRITICAL**: CloudFlare Workers requires `package-lock.json` or `yarn.lock`, not `bun.lockb`.

```bash
# Navigate to your project root
cd /path/to/growth-os

# Delete bun.lockb (REQUIRED)
rm bun.lockb

# Generate package-lock.json
npm install

# Verify package-lock.json exists
ls -la package-lock.json
```

**Why this is critical:**
- CloudFlare Workers doesn't support Bun's lock file format
- Deployment will fail without `package-lock.json`
- This only needs to be done once

### Commit Changes

```bash
# Stage changes
git add package-lock.json
git add .

# Commit (note: bun.lockb deletion is already tracked)
git commit -m "Prepare for CloudFlare Workers deployment"

# Push to GitHub
git push origin main
```

## 📝 Step 4: Create wrangler.toml

Create a `wrangler.toml` file in your project root:

```toml
name = "growth-os"
main = "dist/index.js"
compatibility_date = "2024-01-01"
node_compat = true

# Build configuration
[build]
command = "npm run build"
watch_dirs = ["src"]

# Build output
[site]
bucket = "./dist"

# Environment variables (public)
[vars]
VITE_SUPABASE_URL = "https://your-project.supabase.co"
VITE_SUPABASE_ANON_KEY = "your_anon_key_here"

# Routes configuration
[[routes]]
pattern = "yourdomain.com/*"
zone_name = "yourdomain.com"
```

**Important Configuration Notes:**

1. **name**: Must be unique across CloudFlare
2. **VITE_SUPABASE_URL**: Replace with your Supabase project URL
3. **VITE_SUPABASE_ANON_KEY**: Replace with your anon key
4. **routes**: Configure your custom domain (optional)

### Secure Variables

For sensitive values, use CloudFlare Secrets (see Step 7).

## 🔧 Step 5: Update package.json Scripts

Add CloudFlare-specific scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "deploy:cf": "wrangler deploy",
    "deploy:cf:staging": "wrangler deploy --env staging",
    "deploy:cf:production": "wrangler deploy --env production"
  }
}
```

## 🏗️ Step 6: Build the Application

Build your application for production:

```bash
# Clean previous builds
rm -rf dist/

# Build for production
npm run build
```

**Expected Output:**
```
vite v4.x.x building for production...
✓ 1234 modules transformed.
dist/index.html                   1.23 kB
dist/assets/index-abc123.css     45.67 kB
dist/assets/index-def456.js     234.56 kB
✓ built in 12.34s
```

**Verify build:**
```bash
# Check dist directory exists
ls -la dist/

# Should see index.html and assets/
```

## 🚢 Step 7: Deploy to CloudFlare Workers

### First Deployment

```bash
# Deploy to CloudFlare
wrangler deploy

# Or use npm script
npm run deploy:cf
```

**Deployment Process:**
1. Uploads your build files
2. Configures Workers
3. Provisions subdomain
4. Returns deployment URL

**Expected Output:**
```
✨ Success! Uploaded 123 files (4.56 MB)
🌎 Deployment complete!
🔗 https://growth-os.<your-subdomain>.workers.dev
```

### Configure Secrets (SMTP)

SMTP credentials should NEVER be in code. Use CloudFlare Secrets:

```bash
# Set SMTP secrets (from Supabase, not CloudFlare)
# These are for your Edge Functions, not CloudFlare Workers

# Navigate to Supabase Dashboard
# Project Settings → Edge Functions → Secrets
# Add the following secrets:

SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASSWORD=re_xxxxxxxxxxxxx
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=Your Company Name
```

**Note**: SMTP runs in Supabase Edge Functions, not CloudFlare Workers. The frontend (CloudFlare) calls Supabase Edge Functions.

### Verify Deployment

Visit your deployment URL:
```
https://growth-os.<your-subdomain>.workers.dev
```

**Check:**
- ✅ Page loads correctly
- ✅ Assets load (images, CSS, JS)
- ✅ Can access login page
- ✅ No console errors

## 🌐 Step 8: Custom Domain (Optional)

### Add Custom Domain in CloudFlare

1. **Add Domain to CloudFlare**:
   - Go to CloudFlare Dashboard
   - Add your domain
   - Update nameservers

2. **Configure Workers Route**:
   ```bash
   wrangler route add "yourdomain.com/*" growth-os
   ```

3. **Update wrangler.toml**:
   ```toml
   [[routes]]
   pattern = "yourdomain.com/*"
   zone_name = "yourdomain.com"
   ```

4. **Update Environment Variables**:
   ```toml
   [vars]
   VITE_SITE_URL = "https://yourdomain.com"
   ```

5. **Redeploy**:
   ```bash
   npm run deploy:cf
   ```

### SSL/TLS Configuration

CloudFlare provides automatic HTTPS:
1. Go to SSL/TLS in CloudFlare Dashboard
2. Set SSL/TLS mode to "Full" or "Full (strict)"
3. Wait for certificate provisioning (~5 minutes)

## 🔄 Step 9: Set Up Continuous Deployment

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to CloudFlare Workers

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - uses: actions/checkout@v3
      
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm install
      
      - name: Build
        run: npm run build
        
      - name: Deploy to CloudFlare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
```

### Add CloudFlare API Token to GitHub

1. **Create API Token**:
   - Go to CloudFlare Dashboard → My Profile → API Tokens
   - Create Token → Edit CloudFlare Workers
   - Copy token

2. **Add to GitHub Secrets**:
   - Go to GitHub repository → Settings → Secrets
   - Add secret: `CF_API_TOKEN`
   - Paste token value

Now every push to `main` automatically deploys!

## 🔍 Step 10: Verify Deployment

Use the [Verification Checklist](./verification-checklist.md):

### Frontend Checks
- [ ] Page loads at CloudFlare URL
- [ ] Login page accessible
- [ ] Assets load correctly
- [ ] No 404 errors
- [ ] Responsive design works

### Backend Checks
- [ ] Can login with test user
- [ ] Database queries work
- [ ] Edge Functions respond
- [ ] Emails send correctly
- [ ] File uploads work

### Performance Checks
- [ ] Page load < 2 seconds
- [ ] Assets cached properly
- [ ] HTTPS enabled
- [ ] No security warnings

## 📊 Step 11: Monitor Deployment

### CloudFlare Analytics

View analytics in CloudFlare Dashboard:
- **Requests**: Total requests per day
- **Bandwidth**: Data transferred
- **Errors**: 4xx and 5xx errors
- **Geographic Distribution**: Where users are

### CloudFlare Logs

View real-time logs:
```bash
wrangler tail
```

This shows:
- HTTP requests
- Response times
- Errors
- Console logs

### Metrics to Monitor

- **Request Volume**: Normal vs spike traffic
- **Error Rate**: Should be < 1%
- **Response Time**: Target < 100ms
- **Geographic Performance**: Check all regions

## 🔧 Troubleshooting

### Common Issues

#### Build Fails
```
Error: Module not found
```

**Solution:**
```bash
# Regenerate package-lock.json
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Deployment Fails - bun.lockb Error
```
Error: Unsupported lock file format
```

**Solution:**
```bash
# Delete bun.lockb (CRITICAL)
rm bun.lockb

# Generate package-lock.json
npm install

# Try deployment again
npm run deploy:cf
```

#### 404 Errors After Deployment
```
404 Not Found for /assets/...
```

**Solution:**
Check `wrangler.toml` site configuration:
```toml
[site]
bucket = "./dist"  # Must point to build output
```

#### Environment Variables Not Working
```
TypeError: Cannot read property 'VITE_SUPABASE_URL'
```

**Solution:**
1. Ensure variables in `wrangler.toml`
2. Prefix with `VITE_` for Vite
3. Redeploy after changes

#### Custom Domain Not Working
```
DNS_PROBE_FINISHED_NXDOMAIN
```

**Solution:**
1. Verify domain added to CloudFlare
2. Check nameservers updated
3. Wait for DNS propagation (up to 24 hours)
4. Verify Workers route configured

### Debug Commands

```bash
# Check wrangler configuration
wrangler config

# View deployment info
wrangler deployments list

# View real-time logs
wrangler tail

# Check build output
ls -la dist/

# Test build locally
npm run preview
```

## 🚀 Production Deployment Checklist

Before going live:

### Pre-Deployment
- [ ] Database fully configured
- [ ] All Edge Functions deployed
- [ ] SMTP tested and working
- [ ] Environment variables set
- [ ] Custom domain configured
- [ ] SSL certificate active

### Deployment
- [ ] bun.lockb deleted
- [ ] Build successful
- [ ] No errors in logs
- [ ] All assets loading

### Post-Deployment
- [ ] Run [Verification Checklist](./verification-checklist.md)
- [ ] Test user registration
- [ ] Test email delivery
- [ ] Test file uploads
- [ ] Check all features working

### Monitoring
- [ ] Set up CloudFlare Analytics
- [ ] Configure error alerts
- [ ] Monitor performance
- [ ] Set up uptime monitoring

## 📚 Additional Resources

### CloudFlare Documentation
- [Workers Documentation](https://developers.cloudflare.com/workers/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- [Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/)

### Growth OS Documentation
- [Database Setup](./database-setup.md)
- [Environment Variables](./environment-variables.md)
- [Verification Checklist](./verification-checklist.md)

## 🎯 Next Steps

After successful deployment:

1. **Configure Monitoring**: Set up CloudFlare Analytics and alerts
2. **Enable Backups**: Configure database backups in Supabase
3. **Train Team**: Share admin credentials and documentation
4. **Plan Maintenance**: Schedule regular update windows

---

**Deployment successful?** Run the [Verification Checklist](./verification-checklist.md) to ensure everything works!

**Developed by Core47.ai** - © 2025 Core47.ai. All rights reserved.  
**Need deployment help?** Contact: support@core47.ai
