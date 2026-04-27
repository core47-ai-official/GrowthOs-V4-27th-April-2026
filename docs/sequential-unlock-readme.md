# Sequential Unlock System

## Overview

The Sequential Unlock System enforces a structured learning path where students must complete recordings and assignments in order. This system is feature-flagged and maintains backward compatibility.

## Feature Flags

### Sequential Unlock
- **Flag**: `lms_sequential_unlock` in `company_settings` table
- **Default**: `false` (disabled)
- **When disabled**: Uses existing unlock behavior (zero regression)
- **When enabled**: Enforces sequential unlock rules

### Content Drip
- **Flag**: `drip_enabled_default` in `company_settings` table
- **Default**: `false` (disabled)
- **Course Override**: `drip_enabled` in `courses` table (null = use default, true/false = override)
- **Pathway Override**: `drip_enabled` in `learning_pathways` table (null = use default, true/false = override)
- **Recording Setting**: `drip_days` in `available_lessons` table (days after enrollment before available)

## Business Rules

### Initial Access
- Student must have `fees_cleared = true` in students table
- When fees are cleared, only the first recording (lowest `sequence_order`) is unlocked
- All other recordings remain locked

### Progression Flow
1. **Watch Recording**: Student watches unlocked recording
2. **Unlock Assignment**: After recording is completed, linked assignment becomes available
3. **Submit Assignment**: Student submits assignment (status: `pending`)
4. **Review Process**: Staff reviews and sets status to `approved` or `declined`
5. **Unlock Next**: If approved, next recording by `sequence_order` is unlocked
6. **Resubmission**: If declined, student can resubmit; latest approved submission unlocks next recording

### Content Drip Rules
- When drip is enabled for a course/pathway, recordings unlock based on time since enrollment
- Each recording has a `drip_days` value (default 0 = immediate)
- A recording is available when: `NOW() >= enrolled_at + drip_days`
- Drip timing is checked IN ADDITION to sequential requirements
- Both conditions must be met for a recording to unlock

### Version Control
- Each resubmission increments the `version` field
- Current status always reflects the latest submission
- Assignment completion is determined by latest submission being approved

## Database Schema

### New/Modified Fields (Additive Only)
- `company_settings.lms_sequential_unlock` (boolean, default false)
- `company_settings.drip_enabled_default` (boolean, default false)
- `courses.drip_enabled` (boolean, nullable - null means use default)
- `learning_pathways.drip_enabled` (boolean, nullable - null means use default)
- `available_lessons.drip_days` (integer, default 0)
- `submissions.version` (integer, default 1)
- `students.fees_cleared` (boolean, default false)

### Existing Tables Used
- `available_lessons.sequence_order` - determines recording order
- `assignments.recording_id` - links assignments to recordings
- `user_unlocks` - tracks what's unlocked for each student
- `recording_views` - tracks what's been watched
- `submissions` - enhanced with version tracking
- `course_enrollments.enrolled_at` - used for drip timing calculations

### `handle_sequential_submission_approval()`
- **Purpose**: Trigger function for submission approvals
- **Behavior**:
  - When flag OFF: uses existing unlock logic
  - When flag ON: unlocks next recording in sequence
- **Triggers**: On UPDATE of submissions table when status changes to 'approved'

## UI Components

### `SequentialLockIndicator`
- Shows lock/unlock status with appropriate icons
- Displays reason for current state
- Provides visual feedback for assignment status

### `SequentialProgressCard`
- Card component for individual recordings
- Shows sequence number, title, status
- Provides action buttons (Watch, Submit Assignment)
- Disabled state when locked

## React Hooks

### `useSequentialUnlock`
- Manages sequential unlock state
- Checks feature flag and fees status
- Provides initialization for first recording unlock

### `useSequentialSubmissions`
- Manages submission history and versioning
- Tracks latest submission status per assignment
- Handles resubmission logic

## Integration Points

### Existing Components Modified
- `useRecordingUnlocks`: Enhanced to check feature flag
- Submission approval triggers: Enhanced with sequential logic
- Assignment components: Enhanced with version tracking

### Zero-Breaking Changes
- All existing functionality preserved when flag is OFF
- New database fields are optional with safe defaults
- UI components gracefully handle missing data
- Functions maintain backward compatibility

## Testing

### Feature Flag OFF (Default)
- All existing behavior should work unchanged
- No new UI elements should interfere
- Performance should be identical

### Feature Flag ON
- First recording unlocks after fees cleared
- Subsequent recordings unlock only after assignment approval
- Resubmissions properly update status and unlock next content
- UI properly reflects locked/unlocked states

## Admin Configuration

The sequential unlock flag can be toggled in:
1. Database: `UPDATE company_settings SET lms_sequential_unlock = true WHERE id = 1`
2. Admin UI: Company Settings panel (when implemented)

## Rollback Strategy

To disable the feature:
1. Set `lms_sequential_unlock = false` in company_settings
2. System immediately reverts to existing behavior
3. No data loss or corruption
4. Students retain existing progress