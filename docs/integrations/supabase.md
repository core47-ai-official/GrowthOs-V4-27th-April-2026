# Supabase Integration

## Overview

Supabase provides the complete backend infrastructure for Growth OS, including database, authentication, storage, and Edge Functions.

## Purpose in Project

- **Database**: PostgreSQL with Row Level Security (RLS)
- **Authentication**: JWT-based user management with role-based access
- **Storage**: File uploads for assignments and company branding
- **Edge Functions**: Serverless backend logic and integrations
- **Real-time**: Live notifications and data synchronization

## Setup and Configuration

### Environment Variables
- `SUPABASE_URL`: `https://majqoqago****u.supabase.co`
- `SUPABASE_ANON_KEY`: Public API key for client operations
- `SUPABASE_SERVICE_ROLE_KEY`: Admin API key for Edge Functions

### Database Schema
- 25+ tables with comprehensive RLS policies
- Automated triggers for notifications and logging
- 20+ database functions for business logic

### Storage Buckets
- `assignment-files`: Student assignment uploads
- `company-branding`: Logo and branding assets

## Key Objects and References

### Critical Tables
- `users`: Core user management with roles
- `modules`: Learning content organization
- `assignments`: Assignment management
- `notifications`: System-wide notifications
- `company_settings`: Platform configuration

### Edge Functions
- `create-student`: Student onboarding automation
- `mark-invoice-paid`: Payment processing
- `motivational-notifications`: Engagement system

## Troubleshooting

### Common Issues
- **RLS Policy Errors**: Check user roles and permissions
- **Edge Function Failures**: Review function logs in dashboard
- **Real-time Issues**: Verify WebSocket connections

### Debug Resources
- SQL Editor: Test queries and policies
- Function Logs: Monitor Edge Function execution
- Auth Users: Manage user accounts and sessions

## Next Steps
Review [Authentication System](../features/authentication-system.md) for user management details.
