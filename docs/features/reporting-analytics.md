# Reporting & Analytics System

## Overview

The Reporting & Analytics system provides comprehensive insights into student performance, system usage, financial metrics, and operational efficiency across Growth OS.

## User-Facing Behavior

### For Students
- **Personal Analytics**: Individual progress tracking and performance metrics
- **Leaderboard**: Competitive ranking based on performance points
- **Progress Reports**: Module completion rates and time spent learning
- **Achievement Tracking**: Badges earned and milestones reached

### For Mentors
- **Student Progress**: Detailed analytics for assigned students
- **Performance Insights**: Assignment completion rates and engagement metrics
- **Session Analytics**: Attendance and participation tracking
- **Mentorship Effectiveness**: Success rates and student outcomes

### For Admins/Superadmins
- **System Analytics**: Platform usage statistics and user engagement
- **Financial Reports**: Revenue tracking and payment analytics
- **Performance Dashboards**: Student and mentor performance overviews
- **Operational Metrics**: System health and efficiency indicators

## Technical Implementation

### Core Components
- `src/components/admin/StudentPerformance.tsx` - Student analytics interface
- `src/components/admin/RecordingAnalytics.tsx` - Content consumption analytics
- `src/components/superadmin/RecordingRatingDetails.tsx` - Content rating analysis
- `src/pages/Leaderboard.tsx` - Student ranking display

### Database Tables
- `leaderboard` - Student ranking and points
- `user_activity_logs` - All user interactions and activities
- `recording_views` - Video consumption tracking
- `progress` - Module and course completion data
- `quiz_attempts` - Assessment performance data
- `session_attendance` - Live session participation
- `performance_record` - Student performance metrics

### Analytics Functions
- Real-time data aggregation queries
- Performance calculation algorithms
- Ranking and leaderboard generation
- Report generation utilities

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| No specific environment variables required for analytics | N/A | N/A | N/A |

### Analytics Configuration
| Setting | Purpose | Default | Location |
|---------|---------|---------|----------|
| Point calculation rules | Leaderboard scoring | Code-defined | Database functions |
| Report time ranges | Analytics periods | 7d, 30d, 90d | Component props |
| Performance thresholds | Success metrics | Configurable | Company settings |

### Hard-coded Metrics
```typescript
// Performance point calculation
const POINTS_CONFIG = {
  video_completion: 10,
  assignment_submission: 15,
  quiz_completion: 20,
  session_attendance: 25,
  badge_earned: 50
};

// Report time periods
const TIME_PERIODS = ['7d', '30d', '90d', '1y', 'all'];
```

## Security Considerations

### Access Control
- **Students**: Can only view their own analytics and public leaderboards
- **Mentors**: Access to assigned student analytics only
- **Admins**: Full access to system analytics excluding sensitive financial data
- **Superadmins**: Complete access to all analytics and reports

### Data Privacy
- Personal performance data is anonymized in aggregate reports
- Individual student data requires appropriate role permissions
- Financial analytics exclude personal payment information
- Activity logs are sanitized for reporting purposes

### Failure Modes
- **Data Aggregation Failures**: Fallback to cached reports
- **Performance Calculation Errors**: Manual recalculation procedures
- **Report Generation Issues**: Alternative data export methods
- **Real-time Update Delays**: Periodic refresh fallbacks

## Key Analytics Features

### Student Performance Tracking
```typescript
// Performance metrics calculation
const calculateStudentMetrics = (userId) => {
  return {
    completion_rate: moduleCompletionRate(userId),
    engagement_score: calculateEngagement(userId),
    assignment_success_rate: assignmentSuccessRate(userId),
    session_attendance_rate: attendanceRate(userId),
    time_spent_learning: totalLearningTime(userId)
  };
}
```

### Leaderboard System
- Point-based ranking algorithm
- Multiple leaderboard categories (overall, monthly, course-specific)
- Real-time rank updates
- Achievement-based point allocation

### Financial Analytics
```typescript
// Revenue and payment analytics
const generateFinancialReport = (dateRange) => {
  return {
    total_revenue: calculateRevenue(dateRange),
    payment_completion_rate: paymentCompletionRate(dateRange),
    outstanding_balances: getOutstandingBalances(),
    installment_performance: installmentAnalytics(dateRange)
  };
}
```

### Content Analytics
- Video completion rates by module
- Most/least engaging content identification
- Content rating and feedback analysis
- Learning path effectiveness metrics

## Integration Points

### Real-time Updates
```typescript
// Live analytics updates
const subscribeToAnalytics = () => {
  return supabase
    .channel('analytics')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_activity_logs'
    }, updateAnalytics)
    .subscribe();
}
```

### Export Capabilities
- CSV export for all reports
- PDF generation for formal reports
- API endpoints for external integrations
- Scheduled report delivery via email

### Third-party Integrations
- Google Analytics integration (if enabled)
- Custom webhook notifications for milestones
- Zapier integration for automated reporting
- External BI tool compatibility

## Extending the System

### Advanced Analytics
```typescript
// Machine learning insights
const generatePredictiveAnalytics = (userData) => {
  // Student success prediction
  // At-risk student identification  
  // Optimal learning path recommendations
  // Performance trend analysis
}
```

### Custom Report Builder
1. Add report configuration interface
2. Implement dynamic query generation
3. Create custom visualization options
4. Add automated report scheduling

### A/B Testing Framework
```typescript
// Experimentation platform
const createExperiment = (experimentConfig) => {
  // Split testing for learning content
  // Performance metric comparison
  // Statistical significance testing
  // Automated winner selection
}
```

### Advanced Visualizations
- Interactive charts and graphs
- Real-time performance dashboards
- Comparative analytics across cohorts
- Trend analysis and forecasting

## Report Types

### Student Reports
- Individual progress summaries
- Performance trend analysis
- Goal achievement tracking
- Personalized recommendations

### Mentor Reports
- Student portfolio performance
- Mentorship effectiveness metrics
- Session impact analysis
- Feedback and rating summaries

### Administrative Reports
- Platform usage statistics
- Content engagement metrics
- System performance indicators
- Revenue and financial summaries

### Executive Dashboards
- High-level KPI tracking
- Business performance metrics
- Growth and retention analysis
- Operational efficiency indicators

## Troubleshooting

### Common Issues

**Analytics Not Updating**
- Check user_activity_logs table for recent entries
- Verify real-time subscriptions are working
- Confirm analytics calculation functions
- Review database performance and indexes

**Leaderboard Inconsistencies**
- Verify point calculation logic
- Check for duplicate activity logs
- Confirm leaderboard update triggers
- Review ranking algorithm implementation

**Report Generation Failures**
- Validate query performance and timeouts
- Check database connection stability
- Verify export file permissions
- Review memory usage for large datasets

**Performance Metric Discrepancies**
- Cross-reference with source data tables
- Check calculation function accuracy
- Verify date range filtering
- Review data aggregation logic

### Debugging Queries
```sql
-- Check recent activity for analytics
SELECT activity_type, COUNT(*) as count
FROM user_activity_logs 
WHERE occurred_at > NOW() - INTERVAL '24 hours'
GROUP BY activity_type;

-- Verify leaderboard calculation
SELECT u.full_name, l.points, l.rank
FROM leaderboard l
JOIN users u ON l.user_id = u.id  
ORDER BY l.rank
LIMIT 10;

-- Performance data validation
SELECT user_id, module_id, status, COUNT(*)
FROM progress
GROUP BY user_id, module_id, status
HAVING COUNT(*) > 1; -- Check for duplicates
```

## Next Steps

Review [User Activity Logging](./user-activity-logging.md) for data collection details and [Student Management](./student-management.md) for performance impact on student workflows.