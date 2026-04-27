# Database Tables Reference

Detailed reference for all Growth OS database tables and their structure.

## User Management Tables

### `users`
Core authentication and user profiles.
```sql
- id (uuid, primary key)
- email (text, unique)
- created_at (timestamp)
- role (enum: student, mentor, admin, enrollment_manager, superadmin)
- is_active (boolean)
```

### `students`
Student-specific profile information.
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to users)
- full_name (text)
- company_name (text)
- phone_number (text)
- course_access (boolean)
- created_at (timestamp)
```

### `student_details`
Extended student information and preferences.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key to students)
- business_info (jsonb)
- learning_preferences (jsonb)
- contact_preferences (jsonb)
```

## Learning Management Tables

### `available_lessons`
Course structure and lesson metadata.
```sql
- id (uuid, primary key)
- title (text)
- description (text)
- module_number (integer)
- lesson_number (integer)
- is_active (boolean)
- prerequisites (text[])
```

### `lesson_recordings`
Video content and media files.
```sql
- id (uuid, primary key)
- lesson_id (uuid, foreign key)
- title (text)
- video_url (text)
- duration_seconds (integer)
- file_size (bigint)
- quality (text)
```

### `student_recordings`
Student progress and video completion tracking.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- recording_id (uuid, foreign key)
- watched_duration (integer)
- completion_percentage (numeric)
- last_position (integer)
- completed_at (timestamp)
```

### `sequential_unlocks`
Content progression and unlock rules.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- recording_id (uuid, foreign key)
- unlocked_at (timestamp)
- unlock_type (text)
- prerequisites_met (boolean)
```

## Assignment System Tables

### `assignments`
Assignment definitions and requirements.
```sql
- id (uuid, primary key)
- title (text)
- description (text)
- recording_id (uuid, foreign key)
- due_date (date)
- max_score (integer)
- is_active (boolean)
```

### `student_assignments`
Student assignment submissions and grading.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- assignment_id (uuid, foreign key)
- submission_text (text)
- submission_file_url (text)
- score (integer)
- feedback (text)
- submitted_at (timestamp)
- graded_at (timestamp)
```

## Financial Management Tables

### `invoices`
Financial transactions and billing.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- amount (numeric)
- currency (text)
- status (text)
- due_date (date)
- payment_method (text)
- notes (text)
```

### `installment_plans`
Payment scheduling and installment tracking.
```sql
- id (uuid, primary key)
- invoice_id (uuid, foreign key)
- installment_number (integer)
- amount (numeric)
- due_date (date)
- status (text)
- paid_at (timestamp)
```

### `payment_methods`
Stored payment information.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- method_type (text)
- last_four (text)
- expiry_date (text)
- is_default (boolean)
```

## Communication Tables

### `notifications`
System notifications and alerts.
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key)
- title (text)
- message (text)
- type (text)
- is_read (boolean)
- created_at (timestamp)
```

### `support_tickets`
Customer support and help desk.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- subject (text)
- message (text)
- status (text)
- priority (text)
- assigned_to (uuid)
- created_at (timestamp)
```

## Analytics & Tracking Tables

### `admin_logs`
Administrative action logging.
```sql
- id (uuid, primary key)
- admin_id (uuid, foreign key)
- action (text)
- table_name (text)
- record_id (uuid)
- old_values (jsonb)
- new_values (jsonb)
- timestamp (timestamp)
```

### `student_performance`
Academic performance metrics.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- metric_type (text)
- metric_value (numeric)
- calculation_date (date)
- module_number (integer)
```

### `video_ratings`
Content quality and feedback.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- recording_id (uuid, foreign key)
- rating (integer)
- feedback_text (text)
- created_at (timestamp)
```

## Integration Tables

### `shopify_metrics`
E-commerce platform integration.
```sql
- id (uuid, primary key)
- shop_domain (text)
- total_orders (integer)
- revenue (numeric)
- conversion_rate (numeric)
- sync_date (date)
```

### `meta_ads_metrics`
Marketing campaign tracking.
```sql
- id (uuid, primary key)
- campaign_id (text)
- impressions (integer)
- clicks (integer)
- spend (numeric)
- conversions (integer)
- date (date)
```

## System Configuration Tables

### `company_settings`
Multi-tenant configuration.
```sql
- id (uuid, primary key)
- company_name (text)
- logo_url (text)
- primary_color (text)
- secondary_color (text)
- default_currency (text)
- settings (jsonb)
```

### `feature_flags`
System feature toggles.
```sql
- id (uuid, primary key)
- flag_name (text, unique)
- is_enabled (boolean)
- description (text)
- created_at (timestamp)
```

## Specialized Tables

### `milestone_celebration`
Achievement tracking and gamification.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- milestone_type (text)
- milestone_data (jsonb)
- achieved_at (timestamp)
- is_celebrated (boolean)
```

### `questionnaire_responses`
Student onboarding and assessment data.
```sql
- id (uuid, primary key)
- student_id (uuid, foreign key)
- questionnaire_type (text)
- responses (jsonb)
- completed_at (timestamp)
```

## Indexes and Performance

### Critical Indexes
- `students.user_id` - Fast user lookups
- `student_recordings.student_id` - Progress queries
- `invoices.student_id` - Financial lookups
- `notifications.user_id` - Notification delivery
- `admin_logs.timestamp` - Activity monitoring

### Composite Indexes
- `(student_id, recording_id)` - Progress tracking
- `(module_number, lesson_number)` - Content ordering
- `(status, due_date)` - Payment processing

## Related Documentation

- [Database Overview](./database-overview.md)
- [Database Security](./database-security.md)
- [Features Overview](./features-overview.md)
- [API Reference](./technical-capabilities.md)