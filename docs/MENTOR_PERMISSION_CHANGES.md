# Mentor Permission Changes (October 2025)

## Overview

This document explains the recent changes to mentor permissions in the Growth OS system, implemented in October 2025 to better align with the mentorship role's responsibilities and improve system security.

---

## Changes Summary

### What Changed

| Permission | Before October 2025 | After October 2025 | Rationale |
|------------|-------------------|------------------|-----------|
| **Create Recordings** | ✅ Allowed | ❌ Removed | Content structure managed by admins |
| **Delete Recordings** | ✅ Allowed | ❌ Removed | Content preservation and audit trail |
| **Edit Recordings** | ✅ Allowed | ✅ Maintained | Mentors improve existing content |
| **Create Modules** | ✅ Allowed | ❌ Removed | Curriculum structure managed by admins |
| **Delete Modules** | ✅ Allowed | ❌ Removed | Content preservation and audit trail |
| **Edit Modules** | ✅ Allowed | ✅ Maintained | Mentors improve existing content |
| **Create Assignments** | ❌ Removed (Oct 5) | ✅ Restored (Oct 8) | Core mentorship responsibility |
| **Edit Assignments** | ✅ Allowed | ✅ Maintained | Assignment management essential |
| **Delete Assignments** | ✅ Allowed | ❌ Removed | Assignment history preservation |
| **Modify Video URLs** | ❌ Never allowed | ❌ Blocked by trigger | Security: prevent unauthorized content |

---

## Migration Timeline

### October 5, 2025 - Initial Restriction (Migration 20251008083557)

**Changes Applied**:
```sql
-- Removed mentor INSERT permissions for recordings
DROP POLICY IF EXISTS "Mentors can insert recordings" ON public.available_lessons;

-- Removed mentor DELETE permissions for recordings
DROP POLICY IF EXISTS "Mentors can delete recordings" ON public.available_lessons;

-- Removed mentor INSERT permissions for modules
DROP POLICY IF EXISTS "Mentors can insert modules" ON public.modules;

-- Removed mentor DELETE permissions for modules
DROP POLICY IF EXISTS "Mentors can delete modules" ON public.modules;

-- Removed mentor INSERT permissions for assignments (TOO RESTRICTIVE)
DROP POLICY IF EXISTS "Mentors can insert assignments" ON public.assignments;

-- Removed mentor DELETE permissions for assignments
DROP POLICY IF EXISTS "Mentors can delete assignments" ON public.assignments;
```

**Impact**: Mentors lost ability to create assignments (unintended consequence)

### October 8, 2025 - Assignment Creation Restored (Migration 20251008085249)

**Changes Applied**:
```sql
-- Restore mentor ability to create assignments
CREATE POLICY "Mentors can insert assignments" ON public.assignments
FOR INSERT 
WITH CHECK (get_current_user_role() = 'mentor');
```

**Impact**: Mentors can now create and edit assignments again (as intended)

---

## Current Mentor Permissions

### ✅ What Mentors CAN Do

1. **Assignment Management** (Core Responsibility)
   - ✅ Create new assignments
   - ✅ Edit existing assignments
   - ✅ Link assignments to recordings
   - ✅ Configure submission requirements
   - ✅ Review and grade student submissions

2. **Content Editing** (Improvement Focus)
   - ✅ Edit video recording metadata (title, description, instructions)
   - ✅ Edit module information
   - ✅ Add/edit recording attachments
   - ❌ Cannot modify video URLs (security restriction)

3. **Student Management**
   - ✅ View assigned students
   - ✅ Track student progress
   - ✅ Provide feedback and guidance
   - ✅ Manage mentorship sessions

### ❌ What Mentors CANNOT Do

1. **Content Structure Changes**
   - ❌ Create new recordings (admin/superadmin only)
   - ❌ Delete recordings (admin/superadmin only)
   - ❌ Create new modules (admin/superadmin only)
   - ❌ Delete modules (admin/superadmin only)
   - ❌ Delete assignments (admin/superadmin only)

2. **Technical Restrictions**
   - ❌ Modify video URLs in recordings (blocked by database trigger)
   - ❌ Change course structure or sequence
   - ❌ Access unassigned students' data
   - ❌ Modify system-wide settings

---

## Rationale for Changes

### Why Remove Content Creation Permissions?

**Problem**: Mentors had unrestricted ability to modify core content structure.

**Risks**:
- Accidental deletion of critical learning content
- Inconsistent course structure across mentors
- Difficulty tracking content changes
- Potential for content quality issues

**Solution**: Centralize content structure management with admins/superadmins.

**Benefits**:
- Consistent course quality and structure
- Clear content approval workflow
- Better audit trail for content changes
- Reduced risk of accidental data loss

### Why Keep Content Editing Permissions?

**Reasoning**: Mentors are closest to students and can identify areas for improvement.

**Benefits**:
- Mentors can update outdated information
- Quick fixes for typos and clarity issues
- Mentors can add helpful context and notes
- Improves content quality iteratively

**Safety Measures**:
- Video URLs cannot be changed (database trigger)
- All edits logged in `admin_logs`
- Admins can review mentor changes
- Easy rollback via audit trail

### Why Restore Assignment Creation?

**Problem**: Initial restriction was too broad, removed core mentorship capability.

**Impact**: Mentors couldn't create assignments for their teaching workflow.

**Reasoning**: Assignment creation is a core mentorship responsibility:
- Mentors need to assess student learning
- Custom assignments for different student needs
- Flexible teaching approach
- Direct feedback mechanism

**Solution**: Restore assignment creation, maintain deletion restriction.

**Benefits**:
- Mentors can create tailored assessments
- Flexible teaching methodology
- Quick iteration on assignment design
- Assignment history preserved (no deletion)

---

## Technical Implementation

### Database Trigger: Prevent Video URL Modification

```sql
CREATE OR REPLACE FUNCTION public.validate_mentor_recording_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Check if current user is a mentor
  IF EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = auth.uid() AND role = 'mentor'
  ) THEN
    -- Prevent mentors from changing recording_url
    IF OLD.recording_url IS DISTINCT FROM NEW.recording_url THEN
      RAISE EXCEPTION 'Mentors cannot modify video URLs';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Apply trigger to available_lessons table
CREATE TRIGGER validate_mentor_recording_update
BEFORE UPDATE ON public.available_lessons
FOR EACH ROW
EXECUTE FUNCTION public.validate_mentor_recording_update();
```

**Purpose**: Prevent mentors from replacing course videos with unauthorized content.

### RLS Policies

**Recordings (available_lessons)**:
```sql
-- Mentors can UPDATE but not INSERT or DELETE
CREATE POLICY "Mentors can update recordings"
ON public.available_lessons FOR UPDATE
USING (get_current_user_role() = 'mentor');
```

**Modules**:
```sql
-- Mentors can UPDATE but not INSERT or DELETE
CREATE POLICY "Mentors can update modules"
ON public.modules FOR UPDATE
USING (get_current_user_role() = 'mentor');
```

**Assignments**:
```sql
-- Mentors can INSERT and UPDATE but not DELETE
CREATE POLICY "Mentors can insert assignments"
ON public.assignments FOR INSERT
WITH CHECK (get_current_user_role() = 'mentor');

CREATE POLICY "Mentors can update assignments"
ON public.assignments FOR UPDATE
USING (get_current_user_role() = 'mentor');
```

---

## Impact on Mentors

### Workflow Changes

**Before**: Mentor could create entire course structure
- Create module → Create recordings → Create assignments → Teach

**After**: Mentor works within existing structure
- Request module creation (admin) → Edit recordings → Create assignments → Teach

### Best Practices for Mentors

1. **Content Improvement Workflow**
   - Identify areas for improvement while teaching
   - Edit recording metadata, add helpful notes
   - Request structural changes through admin team
   - Create supplementary assignments as needed

2. **Assignment Creation**
   - Create assignments for each recording
   - Configure submission requirements
   - Link assignments to specific recordings
   - Cannot delete assignments (ask admin if needed)

3. **Collaboration with Admins**
   - Request new modules or recordings via support ticket
   - Suggest content improvements through admin team
   - Report structural issues or gaps
   - Coordinate on curriculum changes

---

## FAQ

### Q: Why can't mentors delete assignments they created?

**A**: Assignment deletion removes historical data needed for:
- Student progress tracking
- Audit trails and compliance
- Analytics and reporting
- Performance metrics

If an assignment needs to be retired, admins can mark it as inactive while preserving history.

### Q: What if a mentor needs to create a new module?

**A**: Mentors should submit a request to the admin team explaining:
- Module purpose and learning objectives
- Target student audience
- Relationship to existing modules
- Proposed content outline

Admins will create the module structure, then mentor can populate with assignments.

### Q: Can mentors modify video content?

**A**: No. Video files are managed by admins/superadmins. Mentors can:
- Update video titles and descriptions
- Add instructional notes and context
- Attach supplementary materials
- Request video replacements through admin team

### Q: What happens if a mentor tries to delete a recording?

**A**: The database will reject the operation due to RLS policies. Mentor will receive an error message: "Permission denied - contact administrator."

### Q: How are mentor edits tracked?

**A**: All mentor actions are logged in the `admin_logs` table, including:
- What was changed (table and record ID)
- When it was changed (timestamp)
- Who made the change (mentor ID)
- What changed (before/after values)

---

## Admin Guidelines

### When to Grant Temporary Permissions

In rare cases, admins may need to temporarily grant additional permissions to mentors:

1. **Content Migration**: Moving content from external system
2. **Bulk Updates**: Large-scale content improvements
3. **Special Projects**: Curriculum redesign initiatives

**Process**:
```sql
-- Temporarily grant permission (superadmin only)
CREATE POLICY "temp_mentor_insert_recordings"
ON public.available_lessons FOR INSERT
WITH CHECK (get_current_user_role() = 'mentor');

-- Remove after task completion
DROP POLICY "temp_mentor_insert_recordings" ON public.available_lessons;
```

**Important**: Document the reason, duration, and removal date.

### Reviewing Mentor Changes

Admins should periodically review mentor edits:

```sql
-- View all mentor edits in last 30 days
SELECT 
  al.entity_type,
  al.entity_id,
  al.action,
  al.description,
  al.performed_by,
  al.created_at,
  u.full_name as mentor_name
FROM admin_logs al
JOIN users u ON u.id = al.performed_by
WHERE u.role = 'mentor'
  AND al.created_at > now() - interval '30 days'
ORDER BY al.created_at DESC;
```

---

## Rollback Procedures

If these permission changes need to be reverted:

```sql
-- Restore full mentor permissions (NOT RECOMMENDED)
CREATE POLICY "Mentors can insert recordings"
ON public.available_lessons FOR INSERT
WITH CHECK (get_current_user_role() = 'mentor');

CREATE POLICY "Mentors can delete recordings"
ON public.available_lessons FOR DELETE
USING (get_current_user_role() = 'mentor');

-- Restore module permissions
CREATE POLICY "Mentors can insert modules"
ON public.modules FOR INSERT
WITH CHECK (get_current_user_role() = 'mentor');

CREATE POLICY "Mentors can delete modules"
ON public.modules FOR DELETE
USING (get_current_user_role() = 'mentor');

-- Restore assignment deletion
CREATE POLICY "Mentors can delete assignments"
ON public.assignments FOR DELETE
USING (get_current_user_role() = 'mentor');
```

**Warning**: Restoring these permissions reintroduces the risks that prompted these changes.

---

## Related Documentation

- [Mentor Role Documentation](./roles/mentor-role.md)
- [Assignment System](../documentation/features/assignment-system.md)
- [Database Security](../documentation/database/security.md)
- [Admin Logs](../documentation/features/user-activity-logging.md)

---

**Document Version**: 1.0  
**Last Updated**: October 8, 2025  
**Migration Files**: 20251008083557, 20251008085249  
**Approved By**: Core47.ai Security Team

**Developed by Core47.ai** - © 2025 Core47.ai. All rights reserved.
