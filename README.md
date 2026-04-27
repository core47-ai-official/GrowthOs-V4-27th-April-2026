# Growth OS - AI-Powered Learning Management System

<p align="center">
  <strong>Enterprise-grade Learning Management System</strong><br/>
  Built with React, TypeScript, Supabase & AI
</p>

<p align="center">
  <a href="https://core47.ai">🌐 Website</a> •
  <a href="documentation/README.md">📚 Documentation</a> •
  <a href="mailto:support@core47.ai">💬 Support</a> •
  <a href="https://core47.ai">🚀 Get Started</a>
</p>

---

## 🎯 Overview

Growth OS is a comprehensive Learning Management System (LMS) designed for modern online education businesses. Built by **[Core47.ai](https://core47.ai)**, it provides everything needed to deliver, manage, and monetize online courses.

### Key Features

✅ **5-Role Authentication System** - Superadmin, Admin, Enrollment Manager, Mentor, Student  
✅ **Sequential Course Unlock** - Guide students through structured learning paths  
✅ **Assignment Management** - Multi-format submissions with mentor review  
✅ **Financial Management** - Installment plans, automated invoicing, payment tracking  
✅ **Live Sessions** - Zoom integration for mentorship sessions  
✅ **Notification System** - Email, in-app, and WhatsApp notifications  
✅ **Student Recovery System** - Automated engagement for inactive students  
✅ **Success Partner AI** - 24/7 AI-powered student support with credit system  
✅ **Company Branding** - White-label customization  
✅ **Activity Logging** - Complete audit trail for compliance  
✅ **Analytics & Reporting** - Student performance, financial reports, recovery metrics  
✅ **Recording Ratings** - Collect student feedback on video content  

### Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Row-Level Security (RLS) with 200+ policies
- **Storage**: Supabase Storage with 4 buckets
- **Database**: 44 tables, 40+ functions, 29 edge functions

---

## 📚 Documentation

Comprehensive documentation is available in the `/documentation` folder:

- **[Getting Started](documentation/deployment/README.md)** - Deployment guide
- **[Database Setup](documentation/deployment/database-setup.md)** - Step-by-step database creation
- **[Migration Order](documentation/database/migration-order.md)** - Chronological migration guide
- **[Features](documentation/features/README.md)** - Feature documentation
- **[Database Reference](documentation/database/README.md)** - Schema & relationships
- **[API Documentation](docs/api/README.md)** - Edge Functions & API endpoints

### Quick Start

1. **Clone the repository**
2. **Follow [Database Setup Guide](documentation/deployment/database-setup.md)** (must be done in exact order)
3. **Configure environment variables** using `.env.example`
4. **Deploy to your platform** (Vercel, Netlify, CloudFlare Workers)

---

## 🏗️ Architecture

### Database Architecture (44 Tables)

**User Management** (7 tables): `users`, `students`, `user_roles`, `onboarding_responses`, `user_activity_logs`, `admin_logs`, `student_recovery_messages`

**Learning & Content** (11 tables): `modules`, `available_lessons`, `recording_attachments`, `recording_views`, `recording_ratings`, `user_unlocks`, `user_module_progress`, `assignments`, `submissions`, `badges`, `user_badges`

**Financial System** (4 tables): `invoices`, `installment_payments`, `installment_plans`, `company_settings` (financial fields)

**Communication** (6 tables): `notifications`, `notification_templates`, `notification_settings`, `messages`, `email_queue`, `success_partner_messages`

**Support & Sessions** (4 tables): `support_tickets`, `support_ticket_replies`, `success_sessions`, `session_attendance`

**Integrations** (3 tables): `integrations`, `user_metrics`, `success_partner_credits`

**System Configuration** (2 tables): `company_settings`, `course_tracks`

**Gamification** (4 tables): `milestones`, `milestone_categories`, `user_milestones`, `leaderboard_snapshots`

**Recovery & Monitoring** (3 tables): `student_recovery_checks`, `student_recovery_messages`, `error_logs`

### Security Features

- ✅ **Row-Level Security (RLS)** on all 44 tables
- ✅ **200+ RLS Policies** for granular access control
- ✅ **Role-Based Access Control (RBAC)** with 5 distinct roles
- ✅ **Audit Logging** for all administrative actions
- ✅ **Secure Password Storage** (bcrypt hashing)
- ✅ **Edge Function Authentication** with service role
- ✅ **Input Validation** across all forms

---

## 🚀 Features by Role

### Superadmin
- Complete system access and configuration
- User management (create admins, enrollment managers, mentors)
- Company branding and white-labeling
- System health monitoring and error logs
- Financial reports and analytics

### Admin
- Student management and enrollment
- Content management (modules, lessons, assignments)
- Financial tracking and invoice management
- Support ticket management
- Student performance analytics

### Enrollment Manager
- Student creation and onboarding
- Invoice tracking
- Basic student management
- Support ticket viewing

### Mentor
- Review and grade assignments
- View assigned students' progress
- Host live success sessions
- Edit course content (limited permissions)
- Monitor student engagement

### Student
- Access sequential course content
- Submit assignments with multiple formats
- View grades and feedback
- Attend live sessions
- Track personal progress and achievements
- AI Success Partner chat support

---

## 🔐 Security Status

**Latest Security Fixes** (October 2025):
- ✅ Fixed infinite recursion in RLS policies
- ✅ Removed insecure JWT claim-based authentication
- ✅ Secured `users` and `students` table access
- ✅ Implemented edge function-based admin operations
- ⚠️ 2 low-priority infrastructure warnings remaining

**Launch Readiness**: ✅ **SAFE FOR PRODUCTION** (critical security issues resolved)

See [Security Documentation](docs/SECURITY_ISSUES.md) for complete security audit details.

---

## 🎓 Recent Features (2025)

### ✅ Sequential Unlock System
- **Purpose**: Guide students through structured learning paths
- **Implementation**: Database-driven unlock logic based on video completion + assignment approval
- **Tables**: `user_unlocks`, `recording_views`, `submissions`
- **Functions**: `get_sequential_unlock_status()`, `handle_sequential_submission_approval()`

[Full Documentation →](documentation/features/sequential-unlock-system.md)

### ✅ Student Recovery System
- **Purpose**: Automatically re-engage inactive students
- **Implementation**: Daily cron job checks for inactive students, sends WhatsApp messages
- **Tables**: `student_recovery_messages`, `users` (last_active_at)
- **Edge Functions**: `daily-recovery-check`, `update-recovery-status`

[Full Documentation →](documentation/features/student-recovery-system.md)

### ✅ Success Partner AI
- **Purpose**: 24/7 AI-powered student support
- **Implementation**: Credit-based chat system with daily limits
- **Tables**: `success_partner_credits`, `messages`
- **Edge Functions**: `process-success-partner-message`, `success-partner-credits`

[Full Documentation →](documentation/features/success-partner-ai.md)

### ✅ Recording Ratings System
- **Purpose**: Collect student feedback on video content
- **Implementation**: 5-star rating with text feedback
- **Tables**: `recording_ratings`
- **Components**: `LectureRating.tsx`

[Full Documentation →](documentation/features/recording-ratings.md)

### ✅ Enhanced Financial Management
- **Purpose**: Flexible payment plans with automated tracking
- **Implementation**: Multiple installment plan templates with automated invoice generation
- **Tables**: `installment_plans`, `invoices`, `installment_payments`
- **Edge Functions**: `mark-invoice-paid`, `installment-reminder-scheduler`

### ✅ Enhanced Onboarding
- **Purpose**: Flexible questionnaire system for student intake
- **Implementation**: JSON-based dynamic questionnaires
- **Tables**: `onboarding_responses`, `company_settings.questionnaire`
- **Edge Functions**: `process-onboarding-jobs`

---

## 📊 Database Setup Order

**⚠️ CRITICAL**: Database objects must be created in this exact order to avoid dependency errors.

### Order of Execution

**STEP 0**: Create `get_current_user_role()` function ← **REQUIRED FIRST!**
- Used by 68+ RLS policies
- Must exist before any policies are created

**STEP 1**: Create sequences (`integrations_id_seq`, `user_metrics_id_seq`)

**STEP 2**: Create all 38 tables in dependency order

**STEP 3**: Enable RLS on all tables

**STEP 4**: Create RLS policies (depends on `get_current_user_role()`)

**STEP 5**: Create storage buckets and policies

**STEP 6**: Create remaining database functions

**STEP 7**: Create triggers

**STEP 8**: Insert default data (`company_settings`)

**Complete guide**: [Database Setup Guide](documentation/deployment/database-setup.md)

**Migration execution order**: [Migration Order Guide](documentation/database/migration-order.md)

---

## 🤝 Support & Contact

- **Website**: [core47.ai](https://core47.ai)
- **Email Support**: [support@core47.ai](mailto:support@core47.ai)
- **Enterprise Support**: [enterprise@core47.ai](mailto:enterprise@core47.ai)
- **Security Issues**: [security@core47.ai](mailto:security@core47.ai)

---

## 📄 License

**Proprietary Software** - © 2025 Core47.ai. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without explicit written permission from Core47.ai.

For licensing inquiries, contact: [licensing@core47.ai](mailto:licensing@core47.ai)

---

## 🎯 Developed By

<p align="center">
  <strong><a href="https://core47.ai">Core47.ai</a></strong><br/>
  Enterprise AI Solutions & Custom Software Development<br/>
  Transforming businesses through intelligent automation
</p>

---

**Version**: 2.1  
**Last Updated**: December 2025  
**Status**: Production Ready ✅

---

**Developed by Core47.ai** - © 2025 Core47.ai. All rights reserved.  
**Website**: [core47.ai](https://core47.ai) | **Support**: [support@core47.ai](mailto:support@core47.ai)
