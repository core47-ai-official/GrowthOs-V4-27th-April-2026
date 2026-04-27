# Glossary

## A

**Admin**: User role with system administration capabilities including student management, content upload, and financial tracking. Cannot manage other admins or system-level settings.

**Assignment**: Learning task that students complete after watching videos, requiring mentor review and approval before unlocking subsequent content.

**Assignment Gate**: Content unlocking mechanism where students must complete and receive approval for assignments before accessing new videos or modules.

**Audit Trail**: Comprehensive logging system that tracks all user activities, system changes, and administrative actions for security and compliance.

## B

**Batch Operations**: Administrative functions that allow bulk actions on multiple students, assignments, or other entities simultaneously.

## C

**Content Unlocking**: Sequential learning system where videos, assignments, and modules become available only after completing prerequisites.

**CORS**: Cross-Origin Resource Sharing - security feature that enables web applications to make requests to different domains safely.

## D

**Dashboard**: Personalized interface showing relevant information and actions for each user role (student, mentor, admin, etc.).

## E

**Edge Functions**: Serverless functions hosted on Supabase that handle business logic, integrations, and automated processes.

**Enrollment Manager**: User role specialized in student onboarding, enrollment processing, and initial student support.

## F

**Fee Structure**: Payment plan configuration determining how student fees are divided into installments (e.g., "3_installments").

## G

**Growth OS**: The complete Learning Management System platform designed for e-commerce education and mentorship programs.

## I

**Installment Payment**: Structured payment plan allowing students to pay course fees in multiple scheduled payments rather than a single lump sum.

**Integration**: Connection between Growth OS and external services like Shopify, email providers, or Zapier for enhanced functionality.

## J

**JWT Token**: JSON Web Token used for secure authentication and authorization, automatically managed by Supabase Auth.

## L

**Learning Path**: Sequential progression through modules, videos, and assignments designed to build knowledge systematically.

**LMS Status**: Student's access level to learning content (`active`, `inactive`, `suspended`).

## M

**Mentor**: User role responsible for guiding students, reviewing assignments, providing feedback, and tracking student progress.

**Module**: Collection of related videos, assignments, and quizzes organized around a specific learning topic or skill.

**Module Completion**: Achievement status when all videos are watched and assignments are approved within a module.

## N

**Notification System**: Multi-channel communication system delivering updates via in-app notifications, email, and real-time alerts.

**N8N**: Automation platform that can integrate with Growth OS through webhooks to trigger actions in other applications.

## O

**Onboarding**: Automated process for new students including email delivery, questionnaire completion, and LMS access setup.

**Onboarding Jobs**: Background tasks that handle email delivery and other automated onboarding processes with retry logic.

## P

**Progress Tracking**: System monitoring student advancement through courses, including completion percentages, time spent, and performance metrics.

## R

**Recording**: Video lesson content stored and delivered through the platform, also referred to as "videos" or "lessons".

**Role-Based Access Control (RBAC)**: Security system limiting user access based on assigned roles (student, mentor, admin, superadmin, enrollment_manager).

**Row Level Security (RLS)**: Database security feature ensuring users can only access data they're authorized to see based on their identity and role.

## S

**Sequential Unlocking**: Learning progression system requiring completion of prerequisites before accessing new content.

**Student**: Primary user role for individuals consuming learning content, submitting assignments, and progressing through courses.

**Student ID**: Unique identifier assigned to students in format "STU000001" for tracking and administration.

**Supabase**: Backend-as-a-Service platform providing database, authentication, storage, and serverless functions for Growth OS.

**Superadmin**: Highest privilege user role with complete system access including user management, system configuration, and integration setup.

**Support Ticket**: Customer service system allowing users to submit help requests and receive assistance from staff.

**SMTP**: Simple Mail Transfer Protocol used for sending transactional emails, notifications, and automated communications.

## U

**User Activity Logs**: Detailed tracking of all user actions within the system for audit, analytics, and support purposes.

**User Module Progress**: Database tracking of individual student completion status for each module.

## V

**Video Player**: Interface component allowing students to watch learning content with progress tracking and controls.

**Video Views**: Tracking system recording which videos students have watched and their completion status.

## W

**Webhook**: HTTP callback mechanism allowing external services to notify Growth OS of events for automation and integration.


## Technical Terms

**API**: Application Programming Interface - methods for different software components to communicate.

**CDN**: Content Delivery Network - system for efficiently delivering video and file content to users.

**Database Migration**: Structured changes to database schema tracked through version-controlled SQL files.

**Environment Variable**: Configuration value stored securely outside the codebase for sensitive information like API keys.

**React Query**: Library for efficient data fetching, caching, and synchronization in the React frontend.

**TypeScript**: Programming language adding type safety to JavaScript code for better development experience.

**Vite**: Build tool providing fast development and optimized production builds for the React application.

## Acronyms

- **LMS**: Learning Management System
- **UI**: User Interface  
- **UX**: User Experience
- **CRUD**: Create, Read, Update, Delete
- **SLA**: Service Level Agreement
- **SMS**: Short Message Service
- **SMTP**: Simple Mail Transfer Protocol
- **UUID**: Universally Unique Identifier
- **JSON**: JavaScript Object Notation
- **SQL**: Structured Query Language
- **RPC**: Remote Procedure Call

## Next Steps
For implementation details, refer to the [Architecture Overview](./architecture.md) or specific [Feature Documentation](./features/) for comprehensive technical information.
