# Database Security

Comprehensive security implementation for Growth OS database.

## Security Overview

Growth OS implements enterprise-grade security with multiple layers of protection:

- ✅ **Row-Level Security (RLS)** on all user tables
- ✅ **Role-based access control** with 5 user roles
- ✅ **Audit logging** for all operations
- ✅ **Data encryption** at rest and in transit
- ✅ **SQL injection protection** via parameterized queries

## Row-Level Security (RLS)

### Universal Security Patterns

All user-facing tables implement consistent RLS patterns:

```sql
-- Standard user isolation pattern
CREATE POLICY "Users can view their own data" 
ON table_name FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own data" 
ON table_name FOR INSERT 
WITH CHECK (auth.uid() = user_id);
```

### Critical Security Functions

- `auth.uid()` - Current authenticated user ID
- `get_user_role()` - Dynamic role resolution
- `is_admin()` - Admin privilege checking
- `company_isolation()` - Multi-tenant data separation

## Access Control Matrix

| Role | Students | Recordings | Assignments | Financial | Admin |
|------|----------|------------|-------------|-----------|-------|
| **Student** | Own data | View enrolled | Submit only | Own invoices | None |
| **Mentor** | Assigned students | View relevant | Review submissions | None | None |
| **Admin** | Company students | All company content | Full management | Company finances | Company settings |
| **Superadmin** | Global access | Global access | Global management | Global finances | System config |

## Security Policies by Table

### User Management
- `students`: User can view/edit own profile, admins can manage company students
- `user_roles`: System-managed, read-only for users
- `student_details`: Extends student privacy with same rules

### Learning Content
- `lesson_recordings`: Students see enrolled content, admins manage company content
- `student_recordings`: Users track own progress, mentors see assigned students
- `assignments`: Students submit to own assignments, admins manage all

### Financial Data
- `invoices`: Users see own invoices, admins see company invoices
- `installment_plans`: Connected to invoice permissions
- `payment_methods`: User can manage own methods only

## Current Security Status

### ✅ Implemented Protections
- All user-facing tables have RLS enabled
- Comprehensive policy coverage for CRUD operations
- Admin privilege escalation controls
- Company-level data isolation
- Audit logging for sensitive operations

### ⚠️ Security Considerations
- **Milestone Data**: Currently public-readable (business requirement)
- **System Tables**: Some admin tables use security definer functions
- **Rate Limiting**: Implemented at application level, not database

## Security Monitoring

### Activity Logging
All security-relevant operations are logged:
- User authentication events
- Permission escalation attempts
- Data access patterns
- Failed authorization attempts

### Audit Tables
- `admin_logs` - Administrative actions
- `user_activity` - User behavior tracking
- `security_events` - Security-related incidents

## Best Practices

### For Developers
1. **Always use RLS**: Never bypass RLS for convenience
2. **Test policies**: Verify access controls in different user contexts
3. **Validate inputs**: Use parameterized queries exclusively
4. **Audit changes**: Log all security-relevant operations

### For Administrators
1. **Regular reviews**: Monthly access permission audits
2. **Monitor logs**: Weekly security event analysis
3. **Update policies**: Quarterly policy effectiveness review
4. **Incident response**: Documented security incident procedures

## Security Functions Reference

### Authentication
```sql
-- Get current user role
SELECT get_user_role();

-- Check admin privileges
SELECT is_admin();

-- Verify company access
SELECT has_company_access(company_id);
```

### Authorization
```sql
-- User can access student record
SELECT can_access_student(student_id);

-- Admin can modify company data
SELECT can_modify_company_data(table_name, record_id);
```

## Related Documentation

- [Authentication System](./features/authentication-system.md)
- [Database Overview](./database-overview.md)
- [Technical Capabilities](./technical-capabilities.md)
- [User Roles](./roles/)