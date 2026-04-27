# Cloudflare Pages Deployment Guide

Complete step-by-step guide to deploy Growth OS UI to Cloudflare Pages with production-ready configuration.

## Prerequisites

- GitHub/GitLab repository with Growth OS code
- Cloudflare account (free tier available)
- Custom domain (optional)
- Supabase project already set up

## Overview

This guide covers:
- Repository setup and configuration
- Cloudflare Pages project creation
- Build settings and environment variables
- Custom domain configuration
- SSL/TLS setup and security headers
- Performance optimization
- Monitoring and maintenance

## Step 1: Repository Preparation

### 1.1 Ensure Repository Structure

Your repository should have this structure:
```
growth-os/
├── src/
├── public/
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── index.html
├── .env.example
└── README.md
```

### 1.2 Update Package.json Scripts

Ensure your `package.json` includes proper build scripts:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0"
  }
}
```

### 1.3 Configure Vite for Production

Update `vite.config.ts` for optimal Cloudflare deployment:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Optimize for Cloudflare Pages
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false, // Disable in production for security
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          supabase: ['@supabase/supabase-js'],
          utils: ['clsx', 'tailwind-merge']
        }
      }
    },
    // Cloudflare Pages limits
    chunkSizeWarningLimit: 1000
  },
  // Important for SPA routing
  base: './'
})
```

### 1.4 Create Production Environment Template

Create `.env.production.example`:

```bash
# Production Environment Variables Template
# Copy to .env.production and fill in your values

# Supabase Configuration (Required)
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# App Configuration
VITE_APP_TITLE=Growth OS
VITE_APP_DESCRIPTION=Learning Management System
VITE_APP_URL=https://your-domain.com

# Feature Flags (Optional)
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true
```

### 1.5 Add _redirects File

Create `public/_redirects` for SPA routing:

```
# SPA Routing
/*    /index.html   200

# API Redirects (if needed)
/api/*  https://your-project-id.supabase.co/rest/v1/:splat  200

# Legacy redirects (if migrating)
/old-path/*  /new-path/:splat  301
```

### 1.6 Add _headers File

Create `public/_headers` for security and performance:

```
/*
  # Security Headers
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  
  # Content Security Policy
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none';
  
  # Performance Headers
  Cache-Control: public, max-age=31536000, immutable

/index.html
  # Disable caching for HTML
  Cache-Control: no-cache, no-store, must-revalidate
  Pragma: no-cache
  Expires: 0

/api/*
  # API headers
  Cache-Control: no-cache, no-store, must-revalidate
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
  Access-Control-Allow-Headers: Content-Type, Authorization
```

## Step 2: Cloudflare Pages Setup

### 2.1 Create Cloudflare Account

1. Go to [Cloudflare Pages](https://pages.cloudflare.com/)
2. Sign up for a free account or log in
3. Navigate to "Pages" in the dashboard

### 2.2 Connect Repository

1. Click "Create a project"
2. Choose "Connect to Git"
3. Authorize GitHub/GitLab access
4. Select your Growth OS repository
5. Click "Begin setup"

### 2.3 Configure Build Settings

**Project Name**: `growth-os` (or your preferred name)

**Production Branch**: `main` (or your main branch)

**Build Settings**:
- **Framework preset**: `Vite`
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave empty if repo root)

**Node.js Version**: 
- Go to Settings → Functions → Compatibility
- Set Node.js version to `18` or `20`

### 2.4 Environment Variables Setup

In your Cloudflare Pages project:

1. Go to **Settings** → **Environment variables**
2. Add **Production** variables:

```bash
VITE_SUPABASE_URL = https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY = your-anon-key
VITE_APP_TITLE = Growth OS
VITE_APP_DESCRIPTION = Learning Management System
VITE_APP_URL = https://your-domain.com
```

3. Add **Preview** variables (same as production but with different URLs if needed)

### 2.5 Initial Deployment

1. Click "Save and Deploy"
2. Wait for the build to complete (usually 2-5 minutes)
3. Cloudflare will provide a temporary subdomain: `https://growth-os-xxx.pages.dev`

## Step 3: Custom Domain Configuration

### 3.1 Add Custom Domain

1. In your Pages project, go to **Custom domains**
2. Click "Set up a custom domain"
3. Enter your domain: `yourdomain.com`
4. Click "Continue"

### 3.2 DNS Configuration

**Option A: Full DNS Management via Cloudflare (Recommended)**

1. Update your domain's nameservers to Cloudflare's
2. Cloudflare will automatically configure DNS
3. SSL certificate will be automatically provisioned

**Option B: DNS Only (if you can't change nameservers)**

Add CNAME record to your DNS provider:
```
Type: CNAME
Name: @ (or www)
Value: growth-os-xxx.pages.dev
TTL: Auto or 300
```

### 3.3 SSL/TLS Configuration

1. Go to **SSL/TLS** → **Overview**
2. Set encryption mode to **Full (strict)**
3. Enable **Always Use HTTPS**
4. Go to **Edge Certificates**
5. Enable **Always Use HTTPS**
6. Enable **HTTP Strict Transport Security (HSTS)**

### 3.4 Verify Domain Setup

1. Wait 5-15 minutes for DNS propagation
2. Visit your custom domain
3. Verify HTTPS is working
4. Check that the certificate is valid

## Step 4: Performance Optimization

### 4.1 Caching Configuration

1. Go to **Caching** → **Configuration**
2. Set **Caching Level** to "Standard"
3. Set **Browser Cache TTL** to "8 days"
4. Enable **Always Online**

### 4.2 Speed Optimization

1. Go to **Speed** → **Optimization**
2. Enable **Auto Minify** for:
   - HTML ✓
   - CSS ✓
   - JavaScript ✓
3. Enable **Brotli** compression
4. Enable **Rocket Loader** (test carefully)

### 4.3 Polish (Image Optimization)

1. Go to **Speed** → **Polish**
2. Enable **Polish** (compresses images automatically)
3. Set to **Lossless** or **Lossy** based on preference

### 4.4 Argo Smart Routing (Paid Feature)

For improved performance on paid plans:
1. Go to **Network**
2. Enable **Argo Smart Routing**
3. This routes traffic through less congested paths

## Step 5: Security Configuration

### 5.1 Firewall Rules (Optional)

1. Go to **Security** → **WAF**
2. Consider adding rules for:
   - Rate limiting (API endpoints)
   - Country blocking if needed
   - Known malicious IPs

### 5.2 Bot Fight Mode

1. Go to **Security** → **Bots**
2. Enable **Bot Fight Mode** (free)
3. Consider **Super Bot Fight Mode** (paid)

### 5.3 DDoS Protection

1. Go to **Security** → **DDoS**
2. DDoS protection is enabled by default
3. Review and adjust sensitivity if needed

### 5.4 Security Headers Verification

Verify headers are working:
```bash
curl -I https://yourdomain.com
```

Should include:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000
```

## Step 6: Analytics and Monitoring

### 6.1 Web Analytics (Free)

1. Go to **Analytics** → **Web Analytics**
2. Enable **Web Analytics**
3. Add the analytics script to your site if needed

### 6.2 Core Web Vitals

1. Monitor **Core Web Vitals** in the Analytics tab
2. Review **Performance** metrics
3. Address any issues highlighted

### 6.3 Real User Monitoring (RUM)

For paid plans:
1. Enable **Real User Monitoring**
2. Set up alerts for performance degradation
3. Monitor user experience metrics

### 6.4 External Monitoring Setup

**Uptime Monitoring** (using external services):
```javascript
// Add to your site for health checks
// Create /health endpoint or use service worker

self.addEventListener('fetch', event => {
  if (event.request.url.endsWith('/health')) {
    event.respondWith(
      new Response(
        JSON.stringify({ 
          status: 'ok', 
          timestamp: new Date().toISOString() 
        }),
        { 
          headers: { 'Content-Type': 'application/json' } 
        }
      )
    );
  }
});
```

## Step 7: Deployment Automation

### 7.1 Automatic Deployments

Cloudflare Pages automatically deploys on:
- Push to production branch
- Pull request creation (preview deployments)
- Merge to production branch

### 7.2 Branch Previews

Configure preview branches:
1. Go to **Settings** → **Builds & deployments**
2. Set **Preview deployments** to "All branches"
3. Each branch gets a unique URL for testing

### 7.3 Build Hooks (Optional)

For manual deployments:
1. Go to **Settings** → **Builds & deployments**
2. Create a **Deploy hook**
3. Use the webhook URL to trigger deployments via API

### 7.4 Environment-Specific Configurations

**Production Configuration**:
```javascript
// vite.config.ts
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'
  
  return {
    // ... other config
    define: {
      __IS_PRODUCTION__: isProduction,
      __BUILD_TIME__: JSON.stringify(new Date().toISOString())
    },
    build: {
      minify: isProduction ? 'esbuild' : false,
      sourcemap: !isProduction
    }
  }
})
```

## Step 8: Troubleshooting Common Issues

### 8.1 Build Failures

**Node.js Version Issues**:
```bash
# Check build logs for version conflicts
# Update package.json engines field:
{
  "engines": {
    "node": ">=18.0.0",
    "npm": ">=8.0.0"
  }
}
```

**Memory Issues**:
```bash
# Add to build command if build fails due to memory
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Dependency Issues**:
```bash
# Clear lock file and reinstall
rm package-lock.json
npm install
```

### 8.2 Routing Issues

**SPA Routing Problems**:
```
# Ensure _redirects file is in public folder:
/*    /index.html   200

# Check vite.config.ts base setting:
base: './'
```

**API Route Issues**:
```
# Add to _redirects if using API routes:
/api/*  https://your-backend.com/api/:splat  200
```

### 8.3 Environment Variable Issues

**Missing Variables**:
1. Check **Functions** tab in Cloudflare dashboard
2. Verify environment variables are set correctly
3. Ensure `VITE_` prefix for client-side variables

**Variable Not Loading**:
```javascript
// Debug in browser console:
console.log('Environment:', {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  NODE_ENV: import.meta.env.MODE
});
```

### 8.4 SSL Certificate Issues

**Certificate Not Provisioning**:
1. Wait 24-48 hours for DNS propagation
2. Check DNS records are correct
3. Try disabling Universal SSL and re-enabling

**Mixed Content Warnings**:
```javascript
// Ensure all resources use HTTPS
// Update any hardcoded HTTP URLs
const apiUrl = 'https://api.example.com'  // Not http://
```

### 8.5 Performance Issues

**Large Bundle Size**:
```javascript
// Analyze bundle with:
npm run build -- --analyze

// Implement code splitting:
const LazyComponent = lazy(() => import('./Component'))
```

**Slow Load Times**:
1. Check **Speed** tab in Cloudflare
2. Enable Argo (paid feature)
3. Optimize images and assets
4. Review **Core Web Vitals**

## Step 9: Maintenance and Updates

### 9.1 Regular Maintenance Tasks

**Weekly**:
- Review Analytics for performance issues
- Check Core Web Vitals scores
- Monitor error rates

**Monthly**:
- Update dependencies: `npm update`
- Review security headers
- Check SSL certificate status
- Review firewall logs

**Quarterly**:
- Audit bundle size and performance
- Review CDN cache hit ratios
- Update security configurations
- Review and update environment variables

### 9.2 Backup Strategy

**Repository Backup**:
- Use GitHub/GitLab repository protection
- Enable branch protection rules
- Set up automated backups if needed

**Configuration Backup**:
```bash
# Export Cloudflare configuration
# Save environment variables securely
# Document DNS settings
```

### 9.3 Disaster Recovery

**Rollback Strategy**:
1. Cloudflare keeps deployment history
2. Can rollback to previous deployment instantly
3. Use **Deployments** tab to manage versions

**Alternative Deployment**:
- Keep alternative deployment ready (Netlify/Vercel)
- Maintain DNS backup configurations
- Document recovery procedures

### 9.4 Monitoring and Alerts

**Set Up Alerts** (for paid plans):
1. Go to **Notifications**
2. Create alerts for:
   - Site downtime
   - High error rates
   - Performance degradation
   - SSL certificate issues

**Health Check Script**:
```javascript
// health-check.js
const fetch = require('node-fetch');

async function healthCheck() {
  try {
    const response = await fetch('https://yourdomain.com/health');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    console.log('✅ Site is healthy');
  } catch (error) {
    console.error('❌ Site health check failed:', error.message);
    // Send alert via email/Slack/etc.
  }
}

// Run every 5 minutes
setInterval(healthCheck, 5 * 60 * 1000);
```

## Step 10: Advanced Configuration

### 10.1 Workers for Advanced Logic

Create a Cloudflare Worker for advanced functionality:

```javascript
// worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Add security headers
    const response = await fetch(request);
    const newHeaders = new Headers(response.headers);
    
    newHeaders.set('X-Custom-Header', 'Growth-OS');
    newHeaders.set('X-Build-Version', env.BUILD_VERSION || 'unknown');
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
```

### 10.2 Edge-Side Includes (ESI)

For dynamic content caching:
```html
<!-- Use ESI for dynamic parts -->
<div>
  <!--esi <esi:include src="/api/user-data" /> -->
</div>
```

### 10.3 A/B Testing Setup

```javascript
// A/B testing with Cloudflare Workers
export default {
  async fetch(request) {
    const country = request.cf.country;
    const testGroup = Math.random() < 0.5 ? 'A' : 'B';
    
    // Modify response based on test group
    const response = await fetch(request);
    
    if (testGroup === 'B') {
      // Inject different CSS/JS for test group B
      return new HTMLRewriter()
        .on('head', {
          element(element) {
            element.append('<meta name="test-group" content="B">', {html: true});
          }
        })
        .transform(response);
    }
    
    return response;
  }
};
```

## Conclusion

Following this comprehensive guide will give you a production-ready Growth OS deployment on Cloudflare Pages with:

✅ **High Performance**: Optimized builds, global CDN, smart caching  
✅ **Security**: SSL/TLS, security headers, DDoS protection  
✅ **Reliability**: 99.9%+ uptime, automatic failover  
✅ **Scalability**: Auto-scaling, global edge network  
✅ **Cost-Effective**: Generous free tier, predictable pricing  
✅ **Developer Experience**: Git integration, instant previews, easy rollbacks  

Your Growth OS platform is now ready to serve users globally with enterprise-grade performance and security.

For ongoing support and advanced configurations, refer to:
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Performance Best Practices](https://developers.cloudflare.com/fundamentals/speed/)
