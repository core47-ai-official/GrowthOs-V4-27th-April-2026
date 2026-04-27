# Database Migration Execution Order

**Developed by Core47.ai** | Database Setup Guide

**CRITICAL**: Supabase migrations in the `/supabase/migrations` folder must be executed in strict chronological order.

---

## Why Order Matters

### 1. Dependencies
Tables must exist before foreign keys can reference them. Creating a foreign key to a non-existent table causes immediate failure.

### 2. Functions First
RLS policies depend on the `get_current_user_role()` function. This function must exist before any policy references it (68+ policies use this function).

### 3. Data Integrity
Existing data must be migrated before structure changes. Altering a table structure without considering existing data can cause data loss.

### 4. Triggers Last
Triggers reference tables and functions that must exist first. A trigger on a non-existent table or calling a non-existent function will fail.

---

## Migration File Naming Convention

**Format**: `YYYYMMDDHHMMSS_uuid.sql`

- **YYYYMMDD**: Date of creation (e.g., 20250805)
- **HHMMSS**: Time of creation (e.g., 065607)
- **uuid**: Unique identifier (e.g., d43eb060-d6db-4dc7-9f10-0c475bccc2b2)

**Example**: `20250805065607_d43eb060-d6db-4dc7-9f10-0c475bccc2b2.sql`

Files are automatically sorted chronologically by filename, which is why the date/time prefix is critical.

---

## Migration Execution Order

### Phase 1: Foundation (July 2025 - Initial Setup)

**Purpose**: Establish core database structure, authentication, and basic user management.

1. **20250711065607_xxx.sql** - Initial onboarding system
2. **20250712071501_xxx.sql** - Core user tables and RBAC foundation
3. **20250713071647_xxx.sql** - Table relationship fixes
4. **20250714065607_xxx.sql** - Module progress tracking
5. **20250716065607_xxx.sql** - Enhanced user fields

**Key Tables Created**: `users`, `students`, `onboarding_responses`, `modules`, `available_lessons`

**Critical Functions Created**: `get_current_user_role()` ← **MUST EXIST FIRST**

---

### Phase 2: Core Features (Late July 2025)

**Purpose**: Add financial management, support system, and assignment functionality.

6. **20250717065607_xxx.sql** - Installment payment system
7. **20250718065607_xxx.sql** - Support ticket system
8. **20250719065607_xxx.sql** - Enhanced student management
9. **20250720065607_xxx.sql** - Currency support and financial improvements
10. **20250722065607_xxx.sql** - Assignment submission system
11. **20250724065607_xxx.sql** - Sequential unlock system (initial version)
12. **20250726065607_xxx.sql** - Student integrations (Shopify, WhatsApp)
13. **20250728065607_xxx.sql** - Onboarding job processing
14. **20250730065607_xxx.sql** - Email queue system
15. **20250731065607_xxx.sql** - Recording views tracking

**Key Tables Created**: `invoices`, `installment_payments`, `support_tickets`, `assignments`, `submissions`, `user_unlocks`, `email_queue`

**Key Functions Created**: `get_sequential_unlock_status()`, `process_onboarding_queue()`

---

### Phase 3: Refinements (August 1-5, 2025)

**Purpose**: Refine existing systems, improve performance, and add analytics.

16. **20250802065607_xxx.sql** - Assignment system v2 improvements
17. **20250803065607_xxx.sql** - Sequential unlock refinements
18. **20250804065607_xxx.sql** - Complete schema rebuild (optimization)
19. **20250805065607_xxx.sql** - Activity logging system
20. **20250805071501_xxx.sql** - Leaderboard system
21. **20250805071647_xxx.sql** - Notification system enhancements
22. **20250805072000_xxx.sql** - Badge system
23. **20250805073000_xxx.sql** - User activity logs

**Key Tables Created**: `user_activity_logs`, `admin_logs`, `leaderboard`, `badges`, `user_badges`

**Key Functions Created**: `log_user_activity()`, `calculate_leaderboard_score()`

---

### Phase 4: Advanced Features (August 6-15, 2025)

**Purpose**: Add messaging, integrations, AI features, and gamification.

24. **20250806065607_xxx.sql** - Messages system
25. **20250807065607_xxx.sql** - Shopify integration tables
26. **20250808065607_xxx.sql** - Meta Ads integration
27. **20250809065607_xxx.sql** - Success sessions (live sessions)
28. **20250810065607_xxx.sql** - User metrics tracking
29. **20250811065607_xxx.sql** - Recording attachments
30. **20250812065607_xxx.sql** - Notification templates
31. **20250813065607_xxx.sql** - Success Partner AI credits system
32. **20250814065607_xxx.sql** - Milestones and achievements
33. **20250815065607_xxx.sql** - Student recovery system

**Key Tables Created**: `messages`, `integrations`, `user_metrics`, `success_sessions`, `success_partner_credits`, `milestones`, `student_recovery_messages`

**Key Functions Created**: `check_student_recovery_status()`, `award_milestone()`, `deduct_sp_credits()`

---

### Phase 5: Security & Polish (August 16 - October 21, 2025)

**Purpose**: Harden security, fix RLS policies, add error logging, and resolve critical bugs.

34. **20250816065607_xxx.sql** - RLS policy refinements
35. **20250817065607_xxx.sql** - Admin logs fixes
36. **20250818065607_xxx.sql** - Security summary views
37. **20250819065607_xxx.sql** - Error logging system
38. **20250820065607_xxx.sql** - Recording ratings system
39. **20250821065607_xxx.sql** - Badge system fixes
40. **20250822065607_xxx.sql** - Backup tables for data safety
41. **20250905065607_xxx.sql** - September security patch
42. **20250920065607_xxx.sql** - Policy optimization
43. **20251001065607_xxx.sql** - October security audit
44. **20251015065607_xxx.sql** - RLS recursion investigation
45. **20251020065607_xxx.sql** - Pre-production security review
46. **20251021082209_xxx.sql** - **CRITICAL FIX**: Infinite recursion in `users` table RLS
47. **20251021082300_xxx.sql** - **CRITICAL FIX**: Remove insecure JWT claim-based policies

**Key Tables Created**: `user_security_summary`, `error_logs`, `recording_ratings`

**Critical Security Fixes**:
- ✅ Fixed infinite recursion in RLS policies (October 21, 2025)
- ✅ Removed insecure JWT claim checking (October 21, 2025)
- ✅ Simplified RLS policies to use `auth.uid()` only

---

## How to Execute Migrations

### Method 1: Supabase Dashboard (Recommended)

**Best for**: Production deployments, first-time setup

1. Open Supabase Dashboard
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy migration file content
5. Paste into editor
6. Click **Run**
7. Verify success (green checkmark)
8. **CRITICAL**: Do not proceed to next migration if error occurs
9. Repeat for each migration in chronological order

### Method 2: Supabase CLI

**Best for**: Development, automated deployments

```bash
# Apply all pending migrations (safe, only runs new ones)
supabase migration up

# Reset database and run all migrations (⚠️ DROPS ALL DATA!)
supabase db reset
```

**Warning**: `supabase db reset` will delete all data. Use only in development.

---

## Verification After Each Phase

### After Phase 1 (Foundation)
```sql
-- Check critical function exists
SELECT public.get_current_user_role();

-- Check core tables exist
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('users', 'students', 'modules', 'available_lessons');
-- Should return 4
```

### After Phase 2 (Core Features)
```sql
-- Check financial tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('invoices', 'installment_payments', 'installment_plans');
-- Should return 3

-- Check assignment tables
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('assignments', 'submissions', 'user_unlocks');
-- Should return 3
```

### After Phase 3 (Refinements)
```sql
-- Check activity logging
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('user_activity_logs', 'admin_logs');
-- Should return 2
```

### After Phase 4 (Advanced Features)
```sql
-- Check messaging and integrations
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('messages', 'integrations', 'success_partner_credits');
-- Should return 3
```

### After Phase 5 (Security & Polish)
```sql
-- Check all tables exist (should be 38+)
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public';

-- Check RLS is enabled on all tables
SELECT COUNT(*) FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check error logging
SELECT COUNT(*) FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('error_logs', 'recording_ratings');
-- Should return 2
```

---

## Common Migration Errors

### Error: "function get_current_user_role() does not exist"

**Cause**: RLS policies reference function that hasn't been created yet.

**Solution**: 
1. Find the migration that creates `get_current_user_role()`
2. Run that migration first
3. Then run the failed migration again

### Error: "relation does not exist"

**Cause**: Table doesn't exist yet, but migration references it (foreign key, policy, etc.).

**Solution**: 
1. Check which table is missing
2. Find the migration that creates that table
3. Run migrations in correct chronological order

### Error: "duplicate key value violates unique constraint"

**Cause**: Migration tries to insert data that already exists.

**Solution**: 
1. Check if migration was already run
2. Use `INSERT ... ON CONFLICT DO NOTHING` in migrations
3. Or manually remove conflicting data first

### Error: "infinite recursion detected"

**Cause**: RLS policy calls function that queries the same table (circular dependency).

**Solution**: 
- ✅ **Fixed in October 2025** with migrations 46 and 47
- If you encounter this, ensure you've run the latest security migrations

---

## Rollback Strategy

### If Migration Fails

1. **Do NOT proceed** to next migration
2. **Identify** the error from Supabase logs
3. **Fix** the migration SQL
4. **Rollback** if necessary:
   ```sql
   -- Drop created objects
   DROP TABLE IF EXISTS problematic_table CASCADE;
   DROP FUNCTION IF EXISTS problematic_function CASCADE;
   ```
5. **Re-run** the corrected migration
6. **Verify** success before continuing

### Complete Rollback (Development Only)

```bash
# Reset to clean state (⚠️ DELETES ALL DATA)
supabase db reset

# Start fresh from migration 1
supabase migration up
```

---

## Migration Dependencies Summary

| Migration Creates | Depends On | Used By |
|-------------------|------------|---------|
| `get_current_user_role()` | Nothing | 68+ RLS policies |
| Tables | Sequences, referenced tables | Foreign keys, policies |
| RLS Policies | Tables, `get_current_user_role()` | Access control |
| Storage Policies | Buckets | File access control |
| Triggers | Tables, functions | Automation |
| Functions | Tables | Policies, triggers, app logic |

---

## Quick Reference

| Phase | Migrations | Key Tables | Key Functions |
|-------|------------|------------|---------------|
| 1. Foundation | 1-5 | users, students, modules | get_current_user_role() |
| 2. Core Features | 6-15 | invoices, assignments, submissions | get_sequential_unlock_status() |
| 3. Refinements | 16-23 | activity_logs, badges | log_user_activity() |
| 4. Advanced | 24-33 | messages, integrations, milestones | check_student_recovery_status() |
| 5. Security | 34-47 | error_logs, recording_ratings | Fixed RLS recursion |

---

## Support

If you encounter migration issues:

1. Check error logs in Supabase Dashboard
2. Review [Database Setup Guide](../deployment/database-setup.md)
3. Consult [Troubleshooting Section](../deployment/README.md#troubleshooting)
4. Contact: [support@core47.ai](mailto:support@core47.ai)

---

**Developed by Core47.ai** - © 2025 Core47.ai. All rights reserved.  
**Website**: [core47.ai](https://core47.ai) | **Support**: [support@core47.ai](mailto:support@core47.ai)
