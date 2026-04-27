# Assignment System

## Overview

The Assignment System manages practical exercises that serve as progression gates in the learning journey. Students submit assignments for mentor review, and approval is required to unlock subsequent content.

## Assignment Workflow

### Student Perspective

1. **Assignment Discovery**
   - Assignments appear after recording completion
   - Clear instructions and requirements displayed
   - Submission guidelines and examples provided
   - Deadline information and reminders

2. **Submission Process**
   - Multiple submission types supported (text, files, URLs)
   - Draft saving and revision capabilities
   - Validation and format checking
   - Submission confirmation and tracking

3. **Review and Feedback**
   - Real-time submission status updates
   - Detailed mentor feedback and comments
   - Revision requests with specific guidance
   - Approval notifications and next steps

### Mentor Perspective

1. **Assignment Creation and Management**
   - Create new assignments and link to recordings
   - Edit existing assignment requirements and settings
   - Configure submission types and validation rules
   - **Note**: Cannot delete assignments (admin-only)

2. **Assignment Queue Management**
   - Prioritized list of pending submissions
   - Student context and progress information
   - Assignment history and patterns
   - Workload distribution and capacity

3. **Review Process**
   - Comprehensive submission viewing
   - Structured feedback forms
   - Approval/decline decision making
   - Progress tracking and analytics

4. **Student Support**
   - Direct communication channels
   - Performance trend analysis
   - Intervention and support triggers
   - Mentorship effectiveness metrics

## Technical Implementation

### Database Structure

```sql
-- Assignment definitions
CREATE TABLE public.assignments (
  id UUID PRIMARY KEY,
  assignment_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  instructions JSONB,
  recording_id UUID REFERENCES public.available_lessons(id),
  sequence_order INTEGER,
  submission_types TEXT[] DEFAULT ARRAY['text'],
  max_file_size_mb INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Student submissions
CREATE TABLE public.assignment_submissions (
  id UUID PRIMARY KEY,
  assignment_id UUID REFERENCES public.assignments(id),
  student_id UUID REFERENCES public.users(id),
  submission_type TEXT NOT NULL,
  submission_text TEXT,
  submission_url TEXT,
  file_path TEXT,
  status TEXT DEFAULT 'pending',
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.users(id),
  notes TEXT,
  feedback JSONB
);
```

### Core Components

**Assignment Management**: `AssignmentManagement.tsx`
- Create and configure assignments (mentors and admins)
- Link assignments to recordings
- Set submission requirements
- Manage assignment metadata
- **RLS Policy**: Mentors can INSERT and UPDATE assignments (migration 20251008085249)

**Student Submission**: `StudentSubmissionDialog.tsx`
- Multi-format submission interface
- File upload with validation
- URL submission with preview
- Draft saving functionality

**Submissions Review**: `SubmissionsManagement.tsx`
- Mentor review dashboard
- Bulk operations and filtering
- Feedback and grading tools
- Status management

### Submission Types

**Text Submissions**:
- Rich text editor with formatting
- Character/word count validation
- Auto-save functionality
- Version history tracking

**File Uploads**:
- Multiple file format support
- Size validation and compression
- Secure storage integration
- Download and preview capabilities

**URL Submissions**:
- Link validation and preview
- Screenshot capture for record
- External content verification
- Access tracking

## Assignment Configuration

### Assignment Creation

**Basic Settings**:
- Assignment name and description
- Detailed instructions and requirements
- Submission format requirements
- Due date and reminder settings

**Advanced Configuration**:
- Custom evaluation criteria
- Automated validation rules
- Peer review requirements
- Revision limits and policies

**Integration Settings**:
- Recording linkage for progression gates
- Module association and ordering
- Prerequisite assignment dependencies
- Certificate requirement flagging

### Submission Requirements

**Validation Rules**:
```typescript
interface AssignmentConfig {
  submissionTypes: ('text' | 'file' | 'url')[];
  textRequirements: {
    minWords?: number;
    maxWords?: number;
    requiredKeywords?: string[];
  };
  fileRequirements: {
    allowedTypes: string[];
    maxSizeMB: number;
    requireMultiple?: boolean;
  };
  urlRequirements: {
    allowedDomains?: string[];
    requireScreenshot?: boolean;
  };
}
```

## Review and Grading System

### Mentor Review Process

1. **Assignment Queue**
   - Prioritized by submission date
   - Student context and history
   - Assignment complexity indicators
   - Estimated review time

2. **Review Interface**
   - Side-by-side submission and requirements
   - Structured feedback forms
   - Quick approval/decline options
   - Detailed comment system

3. **Decision Making**
   - Clear approval criteria
   - Standardized feedback templates
   - Revision request workflows
   - Appeal and escalation processes

### Feedback System

**Structured Feedback**:
- Criteria-based evaluation
- Strengths and improvement areas
- Specific revision requests
- Additional resource recommendations

**Communication Tools**:
- Direct mentor-student messaging
- Assignment-specific comment threads
- Progress celebration and encouragement
- Intervention and support escalation

## Progress Integration

### Content Unlocking

The assignment system serves as progression gates:

```sql
-- Trigger function for content unlocking
CREATE OR REPLACE FUNCTION handle_submission_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Unlock next recording in sequence
    PERFORM unlock_next_recording(NEW.student_id, 
      (SELECT recording_id FROM assignments WHERE id = NEW.assignment_id)
    );
  END IF;
  RETURN NEW;
END;
$$;
```

### Progress Tracking

**Student Analytics**:
- Submission completion rates
- Average review turnaround time
- Revision frequency and patterns
- Assignment difficulty metrics

**Learning Insights**:
- Knowledge gap identification
- Skill development tracking
- Engagement pattern analysis
- Support need prediction

## Administrative Features

### Assignment Analytics

**Performance Metrics**:
- Submission volume and trends
- Approval/decline ratios
- Review time distribution
- Student satisfaction scores

**Quality Assurance**:
- Mentor review consistency
- Assignment difficulty calibration
- Student outcome correlation
- Curriculum effectiveness analysis

### Bulk Operations

**Administrative Tools**:
- Batch assignment creation
- Bulk status updates
- Mass feedback distribution
- Automated reminder systems

**Mentor Management**:
- Workload balancing and distribution
- Performance monitoring and support
- Training and calibration programs
- Quality review processes

## Integration Points

### Notification System
- Assignment availability alerts
- Submission confirmations
- Review completion notifications
- Revision request communications

### File Storage System
- Secure file upload and storage
- Assignment submission archival
- Mentor access and download
- Long-term retention policies

### Learning Management
- Content unlocking triggers
- Progress calculation integration
- Module completion dependencies
- Certificate requirement tracking

## Security and Privacy

### Data Protection
- Student submission encryption
- Secure file transfer protocols
- Access logging and auditing
- Data retention compliance

### Access Controls
- Role-based submission access
- Mentor assignment isolation
- Student privacy protection
- Administrative oversight

## Performance Optimization

### File Handling
- Efficient upload processing
- Compression and optimization
- CDN distribution for downloads
- Storage cost optimization

### Database Performance
- Optimized queries for large datasets
- Efficient indexing strategies
- Pagination for submission lists
- Caching for frequently accessed data

## Troubleshooting

### Common Issues

**Submission Failures**:
- File size and format validation
- Network timeout handling
- Browser compatibility issues
- Storage quota management

**Review Process Problems**:
- Mentor notification delivery
- Assignment queue synchronization
- Status update propagation
- Content unlocking delays

**Performance Issues**:
- Large file upload optimization
- Database query performance
- Real-time notification delivery
- Mobile device compatibility

### Debug Procedures

```sql
-- Check submission status
SELECT s.*, a.name as assignment_name, u.full_name as student_name
FROM public.assignment_submissions s
JOIN public.assignments a ON a.id = s.assignment_id
JOIN public.users u ON u.id = s.student_id
WHERE s.status = 'pending'
ORDER BY s.submitted_at;

-- Verify assignment configuration
SELECT a.*, al.recording_title 
FROM public.assignments a
LEFT JOIN public.available_lessons al ON al.id = a.recording_id
WHERE a.is_active = true
ORDER BY a.sequence_order;

-- Check unlocking status
SELECT * FROM public.user_unlocks 
WHERE user_id = 'student-uuid'
ORDER BY unlocked_at DESC;
```

## Next Steps

Review [Mentorship Program](./mentorship-program.md) for mentor-student interaction details and [Learning Management](./learning-management.md) for content progression integration.