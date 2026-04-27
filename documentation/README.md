# Growth OS Documentation

Complete documentation for deploying, configuring, and managing the Growth OS Learning Management System.

**Developed by Core47.ai** | [Website](https://core47.ai) | [Support](mailto:support@core47.ai)

## 📚 Documentation Structure

This documentation is organized into three main sections:

### 1. [Features](./features/) - Feature Documentation
Detailed documentation for each system feature, including:
- Implementation details
- User workflows
- Technical specifications
- Configuration options

[View Features Documentation →](./features/README.md)

### 2. [Database](./database/) - Database Documentation
Comprehensive database architecture and reference:
- Table schemas and relationships
- Security policies (RLS)
- Functions and triggers
- Storage buckets
- Migration guides

[View Database Documentation →](./database/README.md)

### 3. [Deployment](./deployment/) - Deployment Guides
Step-by-step deployment instructions:
- Platform-specific guides (CloudFlare Workers, Vercel, Netlify)
- Database setup (chronological order)
- SMTP configuration examples
- Environment variables
- Verification checklists

[View Deployment Documentation →](./deployment/README.md)

## 🚀 Quick Start

### For New Deployments
1. Start with [Deployment Guide](./deployment/README.md)
2. Follow [Database Setup](./deployment/database-setup.md) in exact order
3. Configure [SMTP Secrets](./deployment/smtp-secrets/README.md)
4. Verify deployment with [Checklist](./deployment/verification-checklist.md)

### For Feature Development
1. Review [Feature Documentation](./features/README.md)
2. Check [Database Reference](./database/tables-reference.md)
3. Understand [Table Relationships](./database/table-relationships.md)

### For Database Changes
1. Review [Database Overview](./database/overview.md)
2. Check [Security Policies](./database/security.md)
3. Update [Functions](./database/functions.md) as needed
4. Create migration in [migrations folder](./database/migrations/)

## 📋 System Overview

**Growth OS** is a comprehensive Learning Management System (LMS) built on:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Row-Level Security (RLS) with 5 user roles
- **Storage**: Supabase Storage with 4 buckets
- **Database**: 44 production tables, 40+ functions, 200+ RLS policies

### Key Statistics
- **44 Production Tables** across 10 functional areas
- **40+ Database Functions** (security, notifications, progress tracking)
- **200+ RLS Policies** for granular access control
- **29 Edge Functions** for serverless backend logic
- **4 Storage Buckets** for file management
- **5 User Roles** (Superadmin, Admin, Enrollment Manager, Mentor, Student)

## 🎯 Feature Status

| Feature | Status | Documentation |
|---------|--------|---------------|
| Authentication System | ✅ Complete | [Docs](./features/authentication-system.md) |
| Student Management | ✅ Complete | [Docs](./features/student-management.md) |
| Learning Management (LMS) | ✅ Complete | [Docs](./features/learning-management.md) |
| Sequential Unlock System | ✅ Complete | [Docs](./features/sequential-unlock-system.md) |
| Assignment System | ✅ Complete | [Docs](./features/assignment-system.md) |
| Financial Management | ✅ Complete | [Docs](./features/financial-management.md) |
| Notifications System | ✅ Complete | [Docs](./features/notifications-system.md) |
| Support Tickets | ✅ Complete | [Docs](./features/support-tickets.md) |
| Live Sessions | ✅ Complete | [Docs](./features/live-sessions.md) |
| Student Recovery System | ✅ Complete | [Docs](./features/student-recovery-system.md) |
| Success Partner AI | ✅ Complete | [Docs](./features/success-partner-ai.md) |
| Company Branding | ✅ Complete | [Docs](./features/company-branding.md) |
| Recording Ratings | ✅ Complete | [Docs](./features/recording-ratings.md) |
| Activity Logging | ✅ Complete | [Docs](./features/user-activity-logging.md) |
| Reporting & Analytics | ✅ Complete | [Docs](./features/reporting-analytics.md) |
| Leaderboard System | ✅ Complete | [Docs](./features/leaderboard-system.md) |
| Certificate System | 📋 Planned | [Docs](./features/certificates-system.md) |

**Legend**: ✅ Complete | 🚧 Partial Implementation | 📋 Planned for v2.0

## 🔐 Security Features

- **Row-Level Security (RLS)** on all tables
- **Role-Based Access Control (RBAC)** with 5 distinct roles
- **Audit Logging** for all administrative actions
- **Secure Password Storage** with bcrypt hashing
- **Data Encryption** for sensitive information
- **CORS Protection** on Edge Functions
- **Input Validation** across all forms

## 🛠️ Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **React Query** - Data fetching
- **React Router** - Routing

### Backend
- **Supabase** - Backend-as-a-Service
- **PostgreSQL** - Database
- **Edge Functions** - Serverless functions
- **Row-Level Security** - Access control
- **Realtime** - Live updates

### Integrations
- **SMTP/Resend** - Email delivery
- **Shopify** (Optional) - E-commerce integration
- **WhatsApp** (Optional) - Messaging
- **Meta Ads** (Optional) - Analytics

## 📞 Support

For questions or issues:
- Review [FAQ](../docs/faq.md)
- Check feature-specific troubleshooting sections
- Consult [Verification Checklist](./deployment/verification-checklist.md)

## 📝 Contributing to Documentation

When adding or updating documentation:
1. Follow the existing structure
2. Include code examples where relevant
3. Add cross-references to related documentation
4. Update the feature status matrix
5. Keep chronological database setup updated

---

**Last Updated**: December 2025  
**Version**: 2.1  
**Developed & Maintained by**: [Core47.ai](https://core47.ai)  
**License**: Proprietary - © 2025 Core47.ai. All rights reserved.  
**Support**: support@core47.ai
