# Growth OS - Comprehensive Learning Management System

![Growth OS](https://img.shields.io/badge/Growth%20OS-LMS%20Platform-blue?style=for-the-badge)
![React](https://img.shields.io/badge/React-18.x-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3FCF8E?style=flat-square&logo=supabase)

Growth OS is a comprehensive, AI-powered Learning Management System designed specifically for e-commerce education and mentorship programs. Built with modern web technologies, it provides a complete platform for student onboarding, course delivery, assignment management, financial tracking, and real-time collaboration.

## 🚀 Key Features

### **Multi-Role Authentication System**
- **5 Distinct User Roles**: Student, Mentor, Admin, Superadmin, Enrollment Manager
- **Role-Based Access Control**: Granular permissions with Row Level Security
- **Secure Authentication**: JWT-based auth with Supabase integration
- **Profile Management**: Customizable user profiles with avatar upload

### **Advanced Learning Management**
- **Sequential Content Unlocking**: Progress-based module and lesson access
- **Video-Based Learning**: Integrated video player with rating system
- **Assignment Management**: File uploads, submissions, and mentor feedback
- **Recording Analytics**: Video completion tracking and performance metrics

### **Comprehensive Student Experience**
- **Interactive Dashboard**: Personalized learning hub with progress tracking
- **Dream Goal Tracking**: Goal-setting and milestone celebration system
- **Leaderboard System**: Gamified learning with performance rankings
- **Success Partner Chat**: AI-powered assistance and guidance

### **Mentorship Program**
- **Dedicated Mentor Assignment**: One-on-one mentor-student relationships
- **Live Session Management**: Scheduled success sessions with calendar integration
- **Student Progress Tracking**: Detailed analytics and performance monitoring
- **Assignment Review System**: Submission review and feedback management
- **Communication Tools**: Direct messaging and notification system

### **Financial Management**
- **Installment Payment Tracking**: Multi-tier payment plan management
- **Automated Invoicing**: PDF invoice generation with custom branding
- **Payment Status Monitoring**: Real-time payment tracking and notifications
- **Financial Analytics**: Revenue tracking and payment analytics
- **Recovery Management**: Automated follow-up for overdue payments

### **Administrative Tools**
- **Student Management**: Bulk student creation and profile management
- **Content Management**: Module and lesson content administration
- **Team Management**: Multi-role team member creation and oversight
- **Company Branding**: Custom logo, colors, and email template management
- **System Health Monitoring**: Real-time system status and performance metrics

### **Notification & Communication**
- **Real-Time Notifications**: In-app and email notification system
- **Motivational Messaging**: Automated encouragement and milestone alerts
- **Support Ticket System**: Multi-tier customer support with priority levels
- **Activity Logging**: Comprehensive audit trails and user activity tracking
- **Email Integration**: SMTP email delivery through Supabase Edge Function secrets

### **Advanced Integrations**
- **Shopify Integration**: E-commerce metrics and customer data sync
- **N8N Webhooks**: Third-party automation and workflow integration
- **File Storage System**: Secure document and media management
- **Analytics Dashboard**: Comprehensive reporting and data visualization
- **API Integration**: RESTful APIs and Edge Functions for custom workflows

## 🛠 Technology Stack

### **Frontend**
- **React 18**: Modern component-based architecture
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first styling with custom design system
- **shadcn/ui**: Modern component library
- **React Router**: Client-side routing
- **TanStack Query**: Efficient data fetching and caching
- **Framer Motion**: Smooth animations and transitions

### **Backend**
- **Supabase**: Complete backend-as-a-service platform
- **PostgreSQL**: Robust relational database with Row Level Security
- **Edge Functions**: Serverless functions for business logic
- **Real-time Subscriptions**: Live data updates
- **Storage**: Secure file upload and management

### **Integrations**
- **SMTP Email**: Email delivery via provider credentials
- **Shopify API**: E-commerce platform integration
- **N8N**: Automation and workflow management

## 📁 Project Structure

```
growth-os/
├── docs/                          # Comprehensive documentation
│   ├── first-steps.md            # Initial setup and hosting guide
│   ├── features/                 # Feature-specific documentation
│   ├── roles/                   # User role documentation
│   └── integrations/            # Third-party integration guides
├── src/
│   ├── components/              # React components
│   │   ├── ui/                 # Reusable UI components
│   │   ├── admin/              # Admin-specific components
│   │   ├── mentor/             # Mentor-specific components
│   │   └── superadmin/         # Superadmin components
│   ├── pages/                  # Route components
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utility libraries
│   ├── types/                  # TypeScript type definitions
│   └── integrations/           # External service integrations
├── supabase/
│   ├── functions/              # Edge Functions
│   └── migrations/             # Database migrations
└── scripts/                    # Build and deployment scripts
```

## 🎯 User Roles & Capabilities

### **Student**
- Access personalized learning dashboard
- Complete sequential modules and assignments
- Track progress and achievements
- Participate in live sessions
- Submit assignments and receive feedback
- Use Success Partner chat assistance

### **Mentor**
- Manage assigned students
- Review and grade assignments
- Schedule and conduct live sessions
- Track student progress
- Provide personalized feedback
- Access mentorship analytics

### **Admin**
- Manage students and mentors
- Oversee financial operations
- Handle support tickets
- Monitor system activity
- Access administrative analytics
- Manage content and modules

### **Superadmin**
- Complete system administration
- Manage all user roles
- Configure company branding
- Access global analytics
- System health monitoring
- Manage integrations and settings

### **Enrollment Manager**
- Create and manage student accounts
- Oversee enrollment processes
- Track enrollment metrics
- Manage student onboarding
- Handle enrollment-related support

## 🚀 Quick Start

See [First Steps Guide](./docs/first-steps.md) for detailed setup instructions.

```bash
# Clone the repository
git clone <repository-url>
cd growth-os

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

## 📖 Documentation

- **[First Steps Guide](./docs/first-steps.md)** - Complete setup and hosting instructions
- **[Feature Documentation](./docs/features/)** - Detailed feature explanations
- **[User Role Guides](./docs/roles/)** - Role-specific capabilities
- **[Integration Guides](./docs/integrations/)** - Third-party service setup
- **[API Documentation](./docs/api/)** - Developer API reference

## 🔧 Configuration

Growth OS is highly configurable through environment variables and admin settings:

- **Company Branding**: Custom logos, colors, and themes
- **Email Templates**: Customizable notification templates
- **Payment Plans**: Flexible installment options
- **Content Management**: Modular course structure
- **User Permissions**: Granular role-based access control

## 🔒 Security

- **Row Level Security**: Database-level access control
- **JWT Authentication**: Secure token-based authentication
- **Encrypted Secrets**: Secure credential management
- **Audit Logging**: Comprehensive activity tracking
- **Data Validation**: Input sanitization and validation
- **HTTPS Enforcement**: Secure data transmission

## 🌟 Enterprise Features

- **Scalable Architecture**: Built for high-performance and growth
- **Advanced Analytics**: Comprehensive reporting and insights
- **Custom Integrations**: Extensible API for third-party connections
- **White-label Ready**: Fully customizable branding and theming

## 📊 Analytics & Reporting

- **Student Progress Tracking**: Individual and cohort performance
- **Financial Analytics**: Revenue tracking and payment insights
- **Engagement Metrics**: Video completion and interaction rates
- **System Performance**: Real-time monitoring and health checks

## 🔄 Deployment Options

- **Self-Hosted**: Deploy on your own infrastructure
- **Cloud Platforms**: Vercel, Netlify, or any modern hosting platform
- **Enterprise**: Dedicated infrastructure and support

## 🤝 Support & Community

- **Documentation**: Comprehensive guides and API reference
- **Support Tickets**: Built-in support system for users
- **Community**: Growing community of educators and developers
- **Professional Support**: Enterprise support options available

## 📄 License

This project is proprietary software. See LICENSE file for details.

---

**Growth OS** - Empowering e-commerce education through advanced learning management technology.

For detailed setup instructions, see the [First Steps Guide](./docs/first-steps.md).
