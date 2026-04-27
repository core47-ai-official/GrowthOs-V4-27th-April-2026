# Growth OS Documentation

Welcome to Growth OS - an AI-powered learning management system designed for educational excellence.

## 🚀 Quick Start

**New to Growth OS?** Start here:
- [First Steps](./first-steps.md) - Get up and running in 5 minutes
- [Environment Configuration](./env-reference.md) - Configure your deployment
- [Authentication Setup](./features/authentication-system.md) - Set up user access

## 📖 User Guides

### For Administrators
- [Student Management](./features/student-management.md) - Managing learners
- [Financial Management](./features/financial-management.md) - Billing and payments
- [Notifications System](./features/notifications-system.md) - Communication management
- [Reporting & Analytics](./features/reporting-analytics.md) - Performance insights

### For Educators & Mentors
- [Learning Management](./features/learning-management.md) - Content delivery
- [Assignment System](./features/assignment-system.md) - Assignments and submissions
- [Mentorship Program](./features/mentorship-program.md) - Mentor-student relationships
- [Live Sessions](./features/live-sessions.md) - Interactive learning sessions

### For Students
- [Student Role Guide](./roles/student-role.md) - Learning and progress tracking
- [Support System](./features/support-tickets.md) - Getting help when needed

## 👥 User Roles & Permissions

Growth OS supports five distinct user roles:

| Role | Purpose | Documentation |
|------|---------|---------------|
| **Student** | Learn and track progress | [Student Guide](./roles/student-role.md) |
| **Mentor** | Guide and support students | [Mentor Guide](./roles/mentor-role.md) |
| **Enrollment Manager** | Onboard new students | [Enrollment Guide](./roles/enrollment-manager-role.md) |
| **Admin** | Manage company operations | [Admin Guide](./roles/admin-role.md) |
| **Superadmin** | System-wide administration | [Superadmin Guide](./roles/superadmin-role.md) |

## 🔌 Integrations

Connect Growth OS with your existing tools:

- [Shopify Integration](./integrations/shopify.md) - E-commerce platform
- [SMTP Email](./integrations/smtp-email.md) - Email communication
- [File Storage](./integrations/file-storage.md) - Document management

## 🛠️ Developer Reference

**For technical teams:**
- [System Architecture](./architecture.md) - Technical design overview
- [Database Overview](./database-overview.md) - High-level database structure
- [Database Security](./database-security.md) - Security implementation
- [Database Tables](./database-tables.md) - Detailed schema reference
- [Technical Capabilities](./technical-capabilities.md) - API and system capabilities

## 📋 Complete Feature List

[Features Overview](./features-overview.md) - Comprehensive feature matrix and capabilities

## ⚙️ Configuration & Deployment

- [Environment Reference](./env-reference.md) - Complete configuration guide
- [Deployment Guide](./deployment.md) - Production deployment
- [Sequential Unlock System](./sequential-unlock-readme.md) - Content progression setup

## 📚 Additional Resources

- [FAQ](./faq.md) - Common questions and answers
- [Glossary](./glossary.md) - Terms and definitions
- [Changelog](../CHANGELOG.md) - Release history and updates

---

## Executive Overview

Growth OS is a comprehensive Learning Management System designed for e-commerce education and mentorship programs. Built with React, TypeScript, and Supabase.

### Key Capabilities
- **Multi-Role Authentication** - 5 distinct user roles with granular permissions
- **Sequential Learning** - Unlock-based content progression with assignments
- **Mentorship Program** - Dedicated mentor-student relationships
- **Financial Management** - Installment payment tracking with automated invoicing
- **Live Sessions** - Success sessions with mentor assignment
- **Company Branding** - Customizable logos and colors
- **Analytics & Reporting** - Student performance tracking and leaderboards

### Technology Stack
- **Frontend**: React 18, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Email**: SMTP configuration through Supabase Edge Functions
- **Integrations**: Shopify, N8N webhooks
- **File Storage**: Supabase Storage

---

## Navigation Tips

- **New Users**: Start with Quick Start → User Role Guide → Feature Overview
- **Administrators**: Focus on User Guides → Configuration → Integrations  
- **Developers**: Begin with Developer Reference → Technical Capabilities
- **Troubleshooting**: Check FAQ → Feature-specific docs → Support
