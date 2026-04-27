# Learning Management System

## Overview

The Learning Management System (LMS) provides structured content delivery with sequential unlocking, progress tracking, and assessment integration. Students progress through modules and recordings in a gated manner, ensuring mastery before advancement.

## Core Concepts

### Module Structure

**Modules** are the primary organizational unit containing:
- **Recordings** - Video lessons with sequential ordering
- **Assignments** - Practical exercises requiring mentor approval
- **Resources** - Supplementary materials and downloads

### Content Progression Model

1. **Sequential Access** - Content unlocks in predetermined order
2. **Assignment Gates** - Mentor approval required to advance
3. **Mastery Requirements** - Minimum scores for quiz progression
4. **Prerequisite Validation** - Previous content must be completed

## Technical Implementation

### Database Structure

```sql
-- Module organization
CREATE TABLE public.modules (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  order INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Video lessons
CREATE TABLE public.available_lessons (
  id UUID PRIMARY KEY,
  recording_title TEXT NOT NULL,
  recording_url TEXT,
  thumbnail_url TEXT,
  module UUID REFERENCES public.modules(id),
  sequence_order INTEGER,
  duration_minutes INTEGER,
  is_active BOOLEAN DEFAULT true
);

-- Student progress tracking
CREATE TABLE public.recording_views (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  recording_id UUID REFERENCES public.available_lessons(id),
  watched BOOLEAN DEFAULT false,
  watch_time_seconds INTEGER DEFAULT 0,
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, recording_id)
);

-- Content unlocking system
CREATE TABLE public.user_unlocks (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  recording_id UUID REFERENCES public.available_lessons(id),
  is_unlocked BOOLEAN DEFAULT false,
  unlocked_at TIMESTAMPTZ,
  UNIQUE(user_id, recording_id)
);
```

### Core Components

**Module Display**: `ModuleCard.tsx`
- Module overview and progress visualization
- Expandable recording lists
- Assignment status indicators
- Progress completion metrics

**Video Player**: `VideoPlayer.tsx`
- Integrated video playback
- Progress tracking and resume functionality
- Speed controls and quality settings
- Completion detection

**Progress Tracking**: `useProgressTracker.ts`
- Watch time monitoring
- Completion state management
- Unlock logic coordination
- Analytics data collection

## Content Unlocking System

### Unlock Logic

The system implements a sophisticated unlocking mechanism:

1. **First Recording** - Always unlocked for new students
2. **Sequential Requirements** - Each recording requires previous completion
3. **Assignment Gates** - Mentor approval unlocks next content
4. **Module Boundaries** - Module completion unlocks next module

### Database Functions

**Unlock Status Calculation**:
```sql
CREATE OR REPLACE FUNCTION get_user_unlock_status(_user_id uuid)
RETURNS TABLE(
  module_id uuid,
  recording_id uuid, 
  is_module_unlocked boolean,
  is_recording_unlocked boolean
)
AS $$
-- Complex logic determining unlock status
-- Based on previous completions and assignments
$$;
```

**Automatic Unlocking**:
```sql
CREATE OR REPLACE FUNCTION unlock_next_recording(
  p_student_id uuid,
  p_current_recording_id uuid
)
AS $$
-- Unlock next recording after completion
-- Triggered by assignment approval or completion
$$;
```

### Student Experience

**Content Access Flow**:
1. Student logs into dashboard
2. Available modules and recordings displayed
3. Locked content shown with requirements
4. Click unlocked recording to begin lesson
5. Progress tracked automatically
6. Assignment submission required for advancement

**Progress Visualization**:
- Module completion percentages
- Recording watch status indicators
- Assignment submission status
- Overall course progress bar
- Estimated completion timeline

## Assignment Integration

### Assignment Gates

Assignments serve as progression gates:
- **Linked to Recordings** - Each recording may have associated assignments
- **Mentor Review Required** - Submissions must be approved
- **Blocking Mechanism** - Next content locked until approval
- **Resubmission Support** - Multiple attempts allowed

### Assignment Workflow

1. **Recording Completion** - Student watches video lesson
2. **Assignment Notification** - System prompts for assignment
3. **Submission Process** - Student submits text, files, or URLs
4. **Mentor Review** - Assigned mentor evaluates submission
5. **Approval/Decline** - Mentor provides feedback and decision
6. **Content Unlock** - Approval unlocks next recording

## Progress Analytics

### Student Metrics

**Engagement Tracking**:
- Time spent per recording
- Replay frequency and patterns
- Assignment submission timing
- Login frequency and duration

**Performance Indicators**:
- Module completion rates
- Assignment pass rates
- Quiz scores and attempts
- Overall progress velocity

**Learning Patterns**:
- Peak learning times
- Content difficulty analysis
- Support request frequency
- Mentor interaction patterns

### Administrative Analytics

**Course Performance**:
- Module completion statistics
- Common student bottlenecks
- Assignment difficulty metrics
- Content engagement analysis

**Student Cohort Analysis**:
- Progression rate comparisons
- Success rate tracking
- Risk factor identification
- Intervention effectiveness

## Content Management

### Administrative Tools

**Module Management**: `ModulesManagement.tsx`
- Create and organize modules
- Set sequence ordering
- Configure unlock requirements
- Manage module metadata

**Recording Management**: `RecordingsManagement.tsx`
- Upload and organize videos
- Set sequence within modules
- Configure assignment links
- Manage video metadata

**Content Publishing**:
- Draft/published state management
- Scheduled content releases
- Bulk content operations
- Version control and rollback

### Content Organization

**Hierarchical Structure**:
```
Course
├── Module 1: Foundations
│   ├── Recording 1.1: Introduction
│   ├── Assignment 1.1: Setup Task
│   ├── Recording 1.2: Basic Concepts
│   └── Assignment 1.2: Practice Exercise
├── Module 2: Intermediate Topics
│   ├── Recording 2.1: Advanced Theory
│   └── Quiz 2.1: Knowledge Check
```

## Integration Points

### Notification System
- Progress milestone notifications
- Assignment deadline reminders
- New content availability alerts
- Completion celebrations

### Mentorship Program
- Assignment review workflows
- Student progress monitoring
- Intervention triggers
- Performance feedback

### Certificate System (Not available in version 1.0.0)
- Module completion certificates
- Course completion credentials
- Skill verification badges
- External credential integration

## Performance Optimization

### Video Delivery
- CDN integration for fast loading
- Adaptive bitrate streaming
- Video compression optimization
- Global edge caching

### Database Performance
- Optimized queries for progress calculation
- Efficient indexing strategies
- Caching for frequently accessed data
- Pagination for large datasets

### User Experience
- Progressive loading for content lists
- Offline content caching
- Resume functionality
- Responsive design across devices

## Security Considerations

### Content Protection
- Secure video streaming URLs
- Time-limited access tokens
- Download prevention measures
- Screen recording deterrents

### Access Control
- Row Level Security for user data
- Role-based content access
- Mentor assignment validation
- Student data isolation

## Troubleshooting

### Common Issues

**Content Not Unlocking**:
- Verify previous recording completion
- Check assignment approval status
- Validate sequence order configuration
- Review unlock function logs

**Progress Tracking Problems**:
- Clear browser cache and cookies
- Check video player event handling
- Verify database trigger functionality
- Review user unlock records

**Performance Issues**:
- Monitor video loading times
- Check database query performance
- Analyze user session duration
- Review CDN cache hit rates

### Debug Procedures

```sql
-- Check student unlock status
SELECT * FROM get_user_unlock_status('student-uuid');

-- Verify recording completion
SELECT * FROM public.recording_views 
WHERE user_id = 'student-uuid'
ORDER BY completed_at DESC;

-- Check assignment blocking
SELECT a.*, s.status 
FROM public.assignments a
LEFT JOIN public.assignment_submissions s ON s.assignment_id = a.id
WHERE s.student_id = 'student-uuid';
```

## Next Steps

Review [Assignment System](./assignment-system.md) for detailed assignment workflows and [Quiz Assessment](./quiz-assessment.md) for assessment integration.
