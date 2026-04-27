# Growth OS API Documentation

Complete API reference for Growth OS Learning Management System.

## Table of Contents

1. [Authentication](#authentication)
2. [Edge Functions](#edge-functions)
3. [Database Schema](#database-schema)
4. [Security & RLS Policies](#security--rls-policies)
5. [Webhooks](#webhooks)
6. [Error Handling](#error-handling)

## Authentication

Growth OS uses Supabase Auth with JWT tokens. All authenticated endpoints require a valid session token.

### Authentication Flow

```typescript
// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Logout
await supabase.auth.signOut();
```

### User Roles

- **superadmin**: Full system access, can manage all resources
- **admin**: Company-level access, manage students and content
- **enrollment_manager**: Can create students and manage enrollments
- **mentor**: Can manage assigned students and content
- **student**: Limited access to own learning materials

## Edge Functions

### Create User with Role

**Endpoint**: `/functions/v1/create-user-with-role`  
**Method**: POST  
**Auth Required**: Yes (admin, enrollment_manager, or superadmin)

Creates a new user with specified role following permission hierarchy.

**Request Body**:
```typescript
{
  target_email: string;
  target_password: string;
  target_role: 'student' | 'mentor' | 'admin' | 'enrollment_manager' | 'superadmin';
  target_full_name?: string;
  target_metadata?: Record<string, any>;
}
```

**Response**:
```typescript
{
  success: boolean;
  user_id?: string;
  error?: string;
}
```

**Permission Matrix**:
- Superadmin: Can create anyone
- Admin: Can create students, mentors, enrollment_managers
- Enrollment Manager: Can create students only

---

### Delete User with Role

**Endpoint**: `/functions/v1/delete-user-with-role`  
**Method**: POST  
**Auth Required**: Yes (admin or superadmin)

Deletes a user and all associated records.

**Request Body**:
```typescript
{
  user_id: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  message?: string;
  error?: string;
}
```

---

### Create Enhanced Student

**Endpoint**: `/functions/v1/create-enhanced-student`  
**Method**: POST  
**Auth Required**: Yes (admin, enrollment_manager, or superadmin)

Creates a student with complete profile and sends welcome email.

**Request Body**:
```typescript
{
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  address?: string;
  mentor_id?: string;
  installment_plan_id?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  user_id?: string;
  student_id?: string;
  credentials?: {
    email: string;
    password: string;
  };
  error?: string;
}
```

---

### Mark Invoice Paid

**Endpoint**: `/functions/v1/mark-invoice-paid`  
**Method**: POST  
**Auth Required**: Yes (admin or enrollment_manager)

Marks an invoice as paid and updates student status.

**Request Body**:
```typescript
{
  invoice_id: string;
  payment_method?: string;
  transaction_id?: string;
}
```

**Response**:
```typescript
{
  success: boolean;
  invoice?: Invoice;
  fees_cleared?: boolean;
  error?: string;
}
```

---

### Process Email Queue

**Endpoint**: `/functions/v1/process-email-queue`  
**Method**: POST  
**Auth Required**: No (internal cron job)

Processes pending emails in the queue using SMTP.

**Response**:
```typescript
{
  processed: number;
  failed: number;
  results: Array<{
    id: string;
    status: 'sent' | 'failed';
    error?: string;
  }>;
}
```

---

### Shopify Metrics

**Endpoint**: `/functions/v1/shopify-metrics`  
**Method**: POST  
**Auth Required**: Yes

Fetches Shopify store metrics for authenticated user.

**Response**:
```typescript
{
  success: boolean;
  metrics?: {
    total_sales: number;
    order_count: number;
    customer_count: number;
    last_updated: string;
  };
  error?: string;
}
```

---

### Notification Scheduler

**Endpoint**: `/functions/v1/notification-scheduler`  
**Method**: POST  
**Auth Required**: No (internal cron job)

Sends scheduled notifications based on triggers and templates.

**Response**:
```typescript
{
  sent: number;
  failed: number;
  notifications: Array<{
    id: string;
    user_id: string;
    status: string;
  }>;
}
```

## Database Schema

### Core Tables

#### users
Primary user table with authentication and profile data.

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'enrollment_manager', 'mentor', 'student')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
  lms_status TEXT DEFAULT 'active' CHECK (lms_status IN ('active', 'inactive', 'restricted')),
  phone TEXT,
  password_hash TEXT, -- Only viewable by superadmin
  password_display TEXT, -- Only viewable by superadmin
  is_temp_password BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### students
Extended student information and enrollment details.

```sql
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  student_id TEXT UNIQUE,
  enrollment_date TIMESTAMPTZ DEFAULT now(),
  fees_cleared BOOLEAN DEFAULT false,
  onboarding_completed BOOLEAN DEFAULT false,
  installment_plan_id UUID REFERENCES public.installment_plans(id),
  goal_brief TEXT,
  answers_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### available_lessons
Learning content and recordings.

```sql
CREATE TABLE public.available_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_title TEXT NOT NULL,
  recording_url TEXT NOT NULL,
  description TEXT,
  notes TEXT,
  module UUID REFERENCES public.modules(id),
  sequence_order INTEGER,
  duration_min INTEGER,
  assignment_id UUID REFERENCES public.assignments(id),
  uploaded_at TIMESTAMPTZ DEFAULT now(),
  uploaded_by UUID REFERENCES public.users(id)
);
```

#### assignments
Learning assignments linked to lessons.

```sql
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  instructions TEXT,
  submission_type TEXT DEFAULT 'text' CHECK (submission_type IN ('text', 'file', 'link', 'multiple')),
  due_days INTEGER DEFAULT 7,
  mentor_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### submissions
Student assignment submissions with versioning.

```sql
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id),
  assignment_id UUID NOT NULL REFERENCES public.assignments(id),
  version INTEGER DEFAULT 1,
  content TEXT,
  file_url TEXT,
  file_urls JSONB,
  links JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'resubmit')),
  notes TEXT,
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### invoices
Student payment invoices and installments.

```sql
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id),
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  payment_method TEXT,
  notes TEXT,
  paid_at TIMESTAMPTZ,
  first_reminder_sent BOOLEAN DEFAULT false,
  first_reminder_sent_at TIMESTAMPTZ,
  second_reminder_sent BOOLEAN DEFAULT false,
  second_reminder_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Security & RLS Policies

### Password Field Protection

**Critical**: Password fields (`password_hash`, `password_display`) are only accessible to superadmin role.

```sql
-- Only superadmins can view password fields
CREATE POLICY "Superadmins have full read access"
ON public.users
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'superadmin'
  )
);
```

### User Data Access

```sql
-- Admins can view all user fields except passwords
CREATE POLICY "Admins can view users except passwords"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'admin'
  )
);

-- Enrollment managers can view users except passwords
CREATE POLICY "Enrollment managers can view users except passwords"
ON public.users FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid() AND u.role = 'enrollment_manager'
  )
);

-- Students can view own profile except passwords
CREATE POLICY "Students can view own profile except passwords"
ON public.users FOR SELECT
USING (auth.uid() = id);
```

### Assignment Access

```sql
-- Students can manage their own submissions
CREATE POLICY "Students can manage their own submissions"
ON public.submissions FOR ALL
USING (auth.uid() = student_id);

-- Staff can view all submissions
CREATE POLICY "Staff can view all submissions"
ON public.submissions FOR SELECT
USING (
  get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
);

-- Staff can update submissions (for grading)
CREATE POLICY "Staff can update submissions"
ON public.submissions FOR UPDATE
USING (
  get_current_user_role() IN ('admin', 'superadmin', 'mentor', 'enrollment_manager')
);
```

## Webhooks

### Success Partner AI Webhook

**URL**: Configured in `VITE_SUCCESS_PARTNER_WEBHOOK_URL`  
**Method**: POST

Handles AI-powered student success partner interactions.

**Payload**:
```typescript
{
  message: string;
  user_id: string;
  context?: Record<string, any>;
}
```

**Response**:
```typescript
{
  response: string;
  confidence?: number;
  suggestions?: string[];
}
```

## Error Handling

### Standard Error Response

```typescript
{
  error: string;
  code?: string;
  details?: any;
}
```

### Common Error Codes

- `AUTH_REQUIRED`: Authentication token missing or invalid
- `PERMISSION_DENIED`: User lacks required permissions
- `INVALID_INPUT`: Request validation failed
- `NOT_FOUND`: Resource not found
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_ERROR`: Server-side error

### Error Examples

```typescript
// Permission denied
{
  error: "Permission denied: Only admins can create users",
  code: "PERMISSION_DENIED"
}

// Validation error
{
  error: "Invalid email format",
  code: "INVALID_INPUT",
  details: { field: "email", value: "invalid-email" }
}

// Rate limit
{
  error: "Daily limit of 10 messages exceeded",
  code: "RATE_LIMIT_EXCEEDED",
  details: { limit: 10, reset_at: "2025-01-14T00:00:00Z" }
}
```

## Best Practices

1. **Always validate input** on both client and server side
2. **Use RLS policies** for data access control
3. **Log security events** using admin_logs table
4. **Implement rate limiting** for public endpoints
5. **Use transactions** for multi-step operations
6. **Handle errors gracefully** with user-friendly messages
7. **Monitor performance** with query optimization
8. **Regular security audits** using Supabase linter

## Rate Limits

- Success Partner: 10 messages per user per day
- Email Queue: 100 emails per minute
- API Calls: 60 requests per minute per user
- File Uploads: 10 MB max per file

## Support

For API support or questions:
- Email: support@growthos.core47.ai
- Documentation: https://docs.growthos.core47.ai
- GitHub Issues: https://github.com/yourusername/growthos/issues