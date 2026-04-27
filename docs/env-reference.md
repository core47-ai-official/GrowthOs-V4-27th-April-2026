# Environment Variables Reference

This document serves as a comprehensive reference for all environment variables used in the Growth OS project. All variables are optional and include sensible fallbacks.

> **📝 Note:** The `.env.example` file has been streamlined to include only the most commonly used variables (~100 lines). This document contains the complete reference for all 100+ available configuration options.

## Quick Setup

1. **Copy environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Validate configuration:**
   ```bash
   node scripts/validate-env.js
   ```

## Required Environment Variables

### Supabase Core Configuration
These variables are essential for the application to function properly:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPABASE_PROJECT_ID=your_project_id
```

### Email Configuration (Backend)
Required for notifications and communication:

```bash
SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_username
SMTP_PASSWORD=your_smtp_password
```

## Application Configuration

### Branding & Identity
Customize the application's appearance and branding:

```bash
VITE_APP_TITLE="Growth OS - AI-Powered Learning Platform"
VITE_APP_DESCRIPTION="Growth OS by IDM Pakistan - AI-powered LMS for e-commerce success"
VITE_APP_AUTHOR="IDM Pakistan"
VITE_COMPANY_NAME="IDM Pakistan"
VITE_TWITTER_HANDLE="@core47ai"
VITE_FAVICON_PATH="/favicon.ico"
VITE_SITE_URL="https://your-domain.com"
```

### Feature Flags
Control feature rollout and experimental functionality:

```bash
# Core Features
VITE_ENABLE_CONSOLE_LOGGING=false
VITE_ENHANCED_ERROR_HANDLING=true
VITE_SAFE_DATABASE_QUERIES=true
VITE_TYPE_SAFETY_IMPROVEMENTS=true
VITE_LMS_SEQUENTIAL_UNLOCK=false

# Database Safety
VITE_MIGRATE_SINGLE_QUERIES=false
VITE_ENABLE_DATABASE_ERROR_BOUNDARIES=false
VITE_SAFE_QUERY_FALLBACKS=false

# Performance & UI
VITE_REPLACE_WINDOW_RELOAD=false
VITE_ENABLE_REAL_RECOVERY_RATE=false
VITE_OPTIMIZE_DATABASE_QUERIES=false
VITE_ENHANCED_LOADING_STATES=false

# Development & Debugging
VITE_MIGRATE_CONSOLE_LOGS=false
VITE_PRESERVE_DEBUG_LOGS=true
VITE_STRICT_TYPE_CHECKING=false
VITE_RUNTIME_TYPE_VALIDATION=false
```

### Company Defaults
Default values used across the application:

```bash
VITE_DEFAULT_COMPANY_NAME="Your Company"
VITE_DEFAULT_CURRENCY="USD"
VITE_DEFAULT_FEE_AMOUNT=3000
VITE_DEFAULT_MAX_INSTALLMENTS=3
VITE_DEFAULT_LMS_URL="https://growthos.core47.ai"
VITE_DEFAULT_INVOICE_OVERDUE_DAYS=30
VITE_DEFAULT_INVOICE_SEND_GAP_DAYS=7
VITE_DEFAULT_RECOVERY_RATE=85
```

### Performance & UI Thresholds
Fine-tune application performance and user experience:

```bash
# Scoring & Analytics
VITE_STUDENT_SCORE_THRESHOLD=85

# Timing & Debouncing
VITE_SEARCH_DEBOUNCE_MS=300
VITE_INPUT_DEBOUNCE_MS=500
VITE_RESIZE_DEBOUNCE_MS=150

# Notifications
VITE_NOTIFICATION_DURATION_MS=5000
VITE_SUCCESS_TOAST_DURATION_MS=3000
VITE_ERROR_TOAST_DURATION_MS=5000

# Animations
VITE_ANIMATION_FAST_MS=200
VITE_ANIMATION_NORMAL_MS=300
VITE_ANIMATION_SLOW_MS=500
VITE_ANIMATION_EXTRA_SLOW_MS=1000

# Pagination
VITE_DEFAULT_PAGE_SIZE=10
VITE_MAX_PAGE_SIZE=100
VITE_INFINITE_SCROLL_THRESHOLD=2

# Cache & Timeouts
VITE_CACHE_TIME_MS=300000        # 5 minutes
VITE_STALE_TIME_MS=30000         # 30 seconds
VITE_SETTINGS_STALE_TIME_MS=300000  # 5 minutes
VITE_DEFAULT_TIMEOUT_MS=30000    # 30 seconds
VITE_SHORT_TIMEOUT_MS=5000       # 5 seconds
VITE_LONG_TIMEOUT_MS=60000       # 60 seconds
```

### Milestone Thresholds
Configure achievement and progress milestones:

```bash
VITE_MILESTONE_BRONZE=500
VITE_MILESTONE_SILVER=1000
VITE_MILESTONE_GOLD=1500
VITE_MILESTONE_PLATINUM=2000
```

### External Services
Configuration for third-party integrations:

```bash
# Support & Contact
VITE_SUPPORT_EMAIL="support@growthos.core47.ai"
VITE_SUPPORT_PHONE="+92 300 1234567"
VITE_SUPPORT_WHATSAPP="+923001234567"
VITE_SUPPORT_ADDRESS="Islamabad, Pakistan"

# External APIs
VITE_WHATSAPP_API_URL="https://api.whatsapp.com"
VITE_N8N_WEBHOOK_BASE="https://n8n.core47.ai/webhook"
VITE_SHOPIFY_APP_URL="https://shopify.core47.ai"

# Email Configuration
VITE_FROM_EMAIL="noreply@growthos.core47.ai"
VITE_FROM_NAME="Growth OS"
VITE_REPLY_TO_EMAIL="support@growthos.core47.ai"
```

### Business Rules
Configure application behavior and policies:

```bash
VITE_DEFAULT_ASSIGNMENT_DEADLINE_DAYS=7
VITE_DEFAULT_SESSION_DURATION_MINUTES=60
VITE_MINIMUM_PASSWORD_LENGTH=8
VITE_INACTIVE_STUDENT_THRESHOLD_DAYS=3
VITE_PAYMENT_REMINDER_DAYS_BEFORE=3
```

### Security & Validation
Security-related configuration:

```bash
VITE_SESSION_TIMEOUT_MINUTES=30
VITE_MAX_LOGIN_ATTEMPTS=5
VITE_PASSWORD_RESET_TIMEOUT_HOURS=24
VITE_SHOPIFY_DOMAIN_SUFFIX=".myshopify.com"
VITE_SHOPIFY_DOMAIN_PATTERN="^[a-z0-9-]+\.myshopify\.com$"
VITE_BLOCKED_DOMAINS="growthos.core47.ai,core47.ai"
```

### UI Text Content
Customize user-facing text:

```bash
VITE_APP_WELCOME_MESSAGE="Welcome to Growth OS"
VITE_SIGN_IN_BUTTON_TEXT="Sign In to Growth OS"
VITE_SHOPIFY_PLACEHOLDER="yourstore.myshopify.com"
VITE_GENERIC_ERROR_MESSAGE="An error occurred. Please try again."
VITE_CONNECTION_ERROR_MESSAGE="Connection failed. Please check your details and try again."
VITE_SUCCESS_MESSAGE="Operation completed successfully"
```

### Test Data Configuration
For development and testing:

```bash
VITE_TEST_ADMIN_EMAIL="admin@testcompany.com"
VITE_TEST_MENTOR_EMAIL="mentor@testcompany.com"
VITE_TEST_STUDENT_EMAIL="student@testcompany.com"
VITE_TEST_PASSWORD="testpassword123"
```

## Configuration by Environment

### Development
Use local configuration with debug features enabled:
```bash
NODE_ENV=development
VITE_ENABLE_CONSOLE_LOGGING=true
VITE_PRESERVE_DEBUG_LOGS=true
```

### Staging
Mirror production settings but use staging services:
```bash
NODE_ENV=production
VITE_SITE_URL="https://staging.yourdomain.com"
# All other variables should match production
```

### Production
Configure for live deployment:
```bash
NODE_ENV=production
VITE_ENABLE_CONSOLE_LOGGING=false
VITE_ENHANCED_ERROR_HANDLING=true
# Set all URLs to production endpoints
```

## Validation & Troubleshooting

### Environment Validation
Run the validation script to check your configuration:

```bash
# Check current environment setup
node scripts/validate-env.js

# Regenerate HTML from template
node scripts/build-html.js
```

### Common Issues

#### Missing Environment Variables
The system will warn about missing required variables but continue with fallbacks:
```
Warning: Missing required environment variables: VITE_SUPABASE_URL
```

#### Configuration Override Not Working
1. Ensure variable name is exactly correct (case-sensitive)
2. Restart development server after changing .env
3. Check that .env file is in project root
4. Verify no spaces around = in variable definitions

#### Email Delivery Failures
Check SMTP configuration in Supabase Dashboard:
```sql
-- Check SMTP settings
SELECT * FROM vault.secrets WHERE name LIKE 'SMTP%';
```

#### Feature Flags Not Working
1. Check boolean values are lowercase strings ('true'/'false')
2. Verify ENV_CONFIG is imported correctly
3. Restart application after changes

### Debug Commands

Useful commands for troubleshooting:

```bash
# Check Supabase connection
npx supabase status

# View Edge Function logs
npx supabase functions logs

# Test email configuration
npx supabase functions invoke process-email-queue

# Check database connectivity
npx supabase db ping
```

## Security Best Practices

1. **Secret Rotation**: Regularly rotate sensitive credentials
2. **Environment Separation**: Use distinct credentials for staging/production
3. **Log Monitoring**: Monitor Edge Function logs for errors
4. **Rate Limiting**: Configure appropriate rate limits for APIs
5. **Access Auditing**: Regularly audit user access and permissions

## Hard-coded Values Override

The following constants were previously hard-coded but are now configurable:

| Previously Hard-coded | Environment Variable | Default |
|----------------------|---------------------|---------|
| `85` (score threshold) | `VITE_STUDENT_SCORE_THRESHOLD` | 85 |
| `300` (search debounce) | `VITE_SEARCH_DEBOUNCE_MS` | 300 |
| `5000` (notification duration) | `VITE_NOTIFICATION_DURATION_MS` | 5000 |
| `10` (page size) | `VITE_DEFAULT_PAGE_SIZE` | 10 |
| `30` (timeout minutes) | `VITE_SESSION_TIMEOUT_MINUTES` | 30 |

## Configuration Files

- `.env.example` - Template with all available variables
- `.env` - Your local configuration (create from template)
- `src/lib/env-config.ts` - Configuration loader with fallbacks
- `index.template.html` - HTML template with placeholders
- `scripts/validate-env.js` - Environment validation script

## Next Steps

After configuring your environment:

1. **Test Configuration**: Run validation script
2. **Deploy**: Follow deployment guide for your environment
3. **Monitor**: Set up logging and monitoring
4. **Document**: Keep environment-specific documentation updated

For deployment instructions, see the [Deployment Guide](deployment.md).