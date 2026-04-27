# Deployment Guide

## Overview

This guide covers deploying Growth OS from local development to production environments, including database migrations, environment configuration, and service integrations.

## Environment Setup

### Development Environment

1. **Prerequisites**
   ```bash
   - Node.js 18+ 
   - npm or yarn
   - Git
   - Supabase CLI (optional but recommended)
   ```

2. **Local Setup**
   ```bash
   git clone <repository-url>
   cd growth-os
   npm install
   cp .env.example .env.local
   npm run dev
   ```

3. **Environment Variables**
   - Configure all required variables (see [Environment Reference](./env-reference.md))
   - Ensure Supabase project is properly configured
   - Set up email service credentials

### Staging Environment

1. **Supabase Project Setup**
   - Create new Supabase project for staging
   - Run database migrations
   - Configure authentication providers
   - Set up storage buckets

2. **Environment Configuration**
   ```bash
   SUPABASE_URL=https://your-staging-project.supabase.co
   SUPABASE_ANON_KEY=your-staging-anon-key
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@company.com
   SMTP_PASSWORD=your-app-password
   ```

3. **Deploy Application**
   - Build application: `npm run build`
   - Deploy to staging platform (Vercel, Netlify, etc.)
   - Test all integrations and functionality

### Production Environment

1. **Infrastructure Requirements**
   - Production Supabase project
   - Custom domain setup
   - SSL certificate configuration
   - CDN configuration for static assets

2. **Database Migration**
   ```bash
   # Using Supabase CLI
   supabase db push --project-ref YOUR_PROJECT_REF
   
   # Or manually execute migration files
   ```

3. **Environment Secrets**
   - Configure all production environment variables
   - Use secure secret management
   - Enable production-level security settings

## Database Migrations

### Migration Process

1. **Pre-Migration Checklist**
   - Backup existing database
   - Test migrations on staging environment
   - Review RLS policies and permissions
   - Validate Edge Function deployments

2. **Running Migrations**
   ```sql
   -- Core table structure
   \i database-migration-complete.sql
   
   -- Verify data integrity
   SELECT * FROM company_settings LIMIT 1;
   SELECT COUNT(*) FROM users;
   ```

3. **Post-Migration Verification**
   - Test user authentication flow
   - Verify role-based access controls
   - Test file upload functionality
   - Validate email notification system

### Edge Functions Deployment

1. **Function Deployment**
   ```bash
   # Deploy all functions
   supabase functions deploy --project-ref YOUR_PROJECT_REF
   
   # Deploy specific function
   supabase functions deploy create-student --project-ref YOUR_PROJECT_REF
   ```

2. **Environment Secrets**
   ```bash
   # Set required secrets
   supabase secrets set SMTP_HOST=smtp.gmail.com --project-ref YOUR_PROJECT_REF
   supabase secrets set SMTP_PORT=587 --project-ref YOUR_PROJECT_REF
   supabase secrets set SMTP_USER=your-email@company.com --project-ref YOUR_PROJECT_REF
   supabase secrets set SMTP_PASSWORD=your-app-password --project-ref YOUR_PROJECT_REF
   supabase secrets set SMTP_FROM_EMAIL=noreply@company.com --project-ref YOUR_PROJECT_REF
   supabase secrets set SMTP_FROM_NAME="Growth OS" --project-ref YOUR_PROJECT_REF
   ```

### File Storage

1. **Storage Buckets**
   ```sql
   -- Create required buckets
   INSERT INTO storage.buckets (id, name, public) VALUES 
   ('assignment-files', 'assignment-files', true),
   ('company-branding', 'company-branding', true);
   ```

2. **Storage Policies**
   - Configure RLS policies for file access
   - Set up CDN optimization
   - Configure file size limits

### Third-Party Integrations

1. **Shopify (Optional)**
   - Configure Shopify app credentials
   - Set up webhook endpoints
   - Test data synchronization

2. **N8N (Optional)**
   - Configure webhook endpoints
   - Set up automation workflows
   - Test integration endpoints

## Security Configuration

### Authentication Settings

1. **Supabase Auth Configuration**
   - Enable email confirmations
   - Configure password requirements
   - Set up rate limiting
   - Configure session timeout

2. **Row Level Security**
   - Verify all RLS policies are active
   - Test role-based access controls
   - Validate data isolation between users

### SSL and Domain Configuration

1. **Custom Domain Setup**
   - Configure DNS records
   - Set up SSL certificates
   - Configure CDN settings
   - Test domain functionality

2. **Security Headers**
   ```javascript
   // Configure security headers
   {
     "X-Frame-Options": "DENY",
     "X-Content-Type-Options": "nosniff",
     "Referrer-Policy": "strict-origin-when-cross-origin"
   }
   ```

## Monitoring and Maintenance

### Health Checks

1. **Application Monitoring**
   - Set up uptime monitoring
   - Configure error tracking
   - Monitor performance metrics
   - Set up alerting for critical issues

2. **Database Monitoring**
   - Monitor query performance
   - Track storage usage
   - Monitor connection pools
   - Set up backup schedules

### Backup Strategy

1. **Database Backups**
   - Configure automated daily backups
   - Test backup restoration process
   - Store backups in secure location
   - Document recovery procedures

2. **File Storage Backups**
   - Configure storage bucket backups
   - Monitor storage usage and costs
   - Test file recovery procedures

## Troubleshooting

### Common Deployment Issues

1. **Environment Variable Errors**
   - Verify all required variables are set
   - Check variable names for typos
   - Validate API keys and credentials

2. **Database Connection Issues**
   - Check Supabase project status
   - Verify connection strings
   - Check firewall and network settings

3. **Email Delivery Issues**
   - Verify SMTP configuration
   - Check domain verification status
   - Monitor email delivery logs

### Performance Optimization

1. **Database Optimization**
   - Monitor slow queries
   - Optimize indexes
   - Review RLS policy performance

2. **Frontend Optimization**
   - Enable gzip compression
   - Configure CDN caching
   - Optimize image assets
   - Monitor bundle size

## Next Steps

After successful deployment:
1. Set up monitoring and alerting
2. Configure backup procedures
3. Train administrators on system management
4. Plan regular maintenance windows
5. Review security settings regularly

For ongoing maintenance, refer to the [FAQ](./faq.md) and feature-specific documentation for troubleshooting guides.
