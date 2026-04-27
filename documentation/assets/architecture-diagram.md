# Growth OS System Architecture

**Developed by Core47.ai** | System Architecture & Data Flow

---

## Complete System Architecture

```mermaid
graph TB
    subgraph "Frontend Layer"
        UI[React + TypeScript + Vite]
        Router[React Router]
        State[React Query + Context]
        Components[shadcn/ui Components]
    end

    subgraph "Authentication Layer"
        Auth[Supabase Auth]
        RLS[Row-Level Security RLS]
        JWT[JWT Tokens]
    end

    subgraph "API Layer"
        EdgeFunctions[Supabase Edge Functions]
        ServiceRole[Service Role Bypass]
    end

    subgraph "Database Layer PostgreSQL"
        UserTables[User Management<br/>6 tables]
        LearningTables[Learning & Content<br/>10 tables]
        FinancialTables[Financial System<br/>4 tables]
        CommTables[Communication<br/>5 tables]
        SupportTables[Support & Sessions<br/>4 tables]
        IntegrationTables[Integrations<br/>3 tables]
        ConfigTables[System Config<br/>2 tables]
        GamificationTables[Gamification<br/>2 tables]
        SecurityTables[Security<br/>2 tables]
    end

    subgraph "Storage Layer"
        StudentDocs[student-documents bucket]
        Logos[company-logos bucket]
        Attachments[attachments bucket]
        Submissions[assignment-submissions bucket]
    end

    subgraph "External Integrations"
        WhatsApp[WhatsApp API]
        Email[SMTP / Resend]
        Shopify[Shopify API]
        MetaAds[Meta Ads API]
        OpenAI[OpenAI API]
    end

    subgraph "Background Jobs"
        Cron[Supabase Cron Jobs]
        Recovery[Daily Recovery Check]
        Credits[Daily Credit Reset]
        Notifications[Notification Scheduler]
    end

    UI --> Router
    Router --> Components
    Components --> State
    State --> Auth
    Auth --> JWT
    JWT --> RLS
    RLS --> UserTables
    RLS --> LearningTables
    RLS --> FinancialTables
    RLS --> CommTables
    RLS --> SupportTables
    RLS --> IntegrationTables
    RLS --> ConfigTables
    RLS --> GamificationTables
    RLS --> SecurityTables

    State --> EdgeFunctions
    EdgeFunctions --> ServiceRole
    ServiceRole --> UserTables
    ServiceRole --> LearningTables
    ServiceRole --> FinancialTables
    ServiceRole --> CommTables

    EdgeFunctions --> WhatsApp
    EdgeFunctions --> Email
    EdgeFunctions --> Shopify
    EdgeFunctions --> MetaAds
    EdgeFunctions --> OpenAI

    Components --> StudentDocs
    Components --> Logos
    Components --> Attachments
    Components --> Submissions

    Cron --> Recovery
    Cron --> Credits
    Cron --> Notifications
    Recovery --> EdgeFunctions
    Credits --> EdgeFunctions
    Notifications --> EdgeFunctions
```

---

## User Role Hierarchy

```mermaid
graph TD
    Superadmin[Superadmin<br/>Full System Access]
    Admin[Admin<br/>Company Management]
    EnrollmentMgr[Enrollment Manager<br/>Student Creation]
    Mentor[Mentor<br/>Student Guidance]
    Student[Student<br/>Course Access]

    Superadmin --> Admin
    Superadmin --> EnrollmentMgr
    Superadmin --> Mentor
    Admin --> EnrollmentMgr
    Admin --> Mentor
    EnrollmentMgr -.can create.-> Student
    Mentor -.can mentor.-> Student

    style Superadmin fill:#ff6b6b
    style Admin fill:#ffa726
    style EnrollmentMgr fill:#66bb6a
    style Mentor fill:#42a5f5
    style Student fill:#ab47bc
```

---

## Database Entity Relationships

```mermaid
erDiagram
    users ||--o{ students : "is a"
    users ||--o{ onboarding_responses : "completes"
    users ||--o{ user_activity_logs : "logs"
    users ||--o{ recording_views : "watches"
    users ||--o{ user_unlocks : "has"
    users ||--o{ recording_ratings : "rates"
    users ||--o{ messages : "sends"
    users ||--o{ notifications : "receives"
    
    students ||--o{ invoices : "has"
    students ||--o{ installment_payments : "pays"
    students ||--o{ submissions : "submits"
    students ||--o{ support_tickets : "creates"
    students ||--o{ success_partner_credits : "has"
    students ||--o{ student_recovery_messages : "receives"
    students ||--o{ session_attendance : "attends"
    students }o--o{ mentors : "assigned to"
    
    modules ||--o{ available_lessons : "contains"
    available_lessons ||--o{ recording_attachments : "has"
    available_lessons ||--o{ recording_views : "tracked by"
    available_lessons ||--o{ recording_ratings : "rated by"
    available_lessons ||--o{ user_unlocks : "unlocked via"
    available_lessons ||--o{ assignments : "has"
    
    assignments ||--o{ submissions : "receives"
    
    installment_plans ||--o{ invoices : "generates"
    invoices ||--o{ installment_payments : "tracked by"
    
    support_tickets ||--o{ support_ticket_replies : "has"
    
    success_sessions ||--o{ session_attendance : "has"
    
    company_settings ||--o{ notification_templates : "defines"
    
    integrations ||--o{ user_metrics : "tracks"
    
    milestones ||--o{ user_badges : "awards"
    badges ||--o{ user_badges : "earned as"
```

---

## Feature Dependencies

```mermaid
graph LR
    subgraph "Core System"
        Auth[Authentication System]
        UserMgmt[User Management]
        RLS[Row-Level Security]
    end

    subgraph "Content Delivery"
        LMS[Learning Management]
        Sequential[Sequential Unlock]
        VideoPlayer[Video Player]
        Assignments[Assignment System]
    end

    subgraph "Student Engagement"
        SuccessPartner[Success Partner AI]
        Recovery[Student Recovery]
        Notifications[Notifications]
        Leaderboard[Leaderboard]
        Certificates[Certificates]
    end

    subgraph "Financial"
        Invoicing[Invoicing]
        Installments[Installment Plans]
        Payments[Payment Tracking]
    end

    subgraph "Support"
        Tickets[Support Tickets]
        LiveSessions[Live Sessions]
        Messaging[Messaging]
    end

    Auth --> UserMgmt
    UserMgmt --> RLS
    RLS --> LMS
    LMS --> Sequential
    LMS --> VideoPlayer
    VideoPlayer --> Assignments
    Sequential --> Assignments
    
    UserMgmt --> SuccessPartner
    UserMgmt --> Recovery
    UserMgmt --> Notifications
    LMS --> Leaderboard
    LMS --> Certificates
    
    UserMgmt --> Invoicing
    Invoicing --> Installments
    Installments --> Payments
    
    UserMgmt --> Tickets
    UserMgmt --> LiveSessions
    UserMgmt --> Messaging

    style Auth fill:#ff6b6b
    style Sequential fill:#66bb6a
    style SuccessPartner fill:#42a5f5
    style Invoicing fill:#ffa726
```

---

## Data Flow: Student Learning Journey

```mermaid
sequenceDiagram
    participant Student
    participant Frontend
    participant Auth
    participant Database
    participant EdgeFunctions
    participant AI

    Student->>Frontend: Login
    Frontend->>Auth: Authenticate
    Auth->>Database: Check credentials & role
    Database-->>Auth: User verified
    Auth-->>Frontend: JWT token
    Frontend-->>Student: Dashboard loaded

    Student->>Frontend: Access lesson
    Frontend->>Database: Check user_unlocks
    Database-->>Frontend: Lesson unlocked
    Frontend->>Database: Log recording_view
    Frontend-->>Student: Video player

    Student->>Frontend: Submit assignment
    Frontend->>Database: Insert submission
    Database-->>Frontend: Submission saved
    Frontend->>EdgeFunctions: Trigger notification
    EdgeFunctions->>Database: Notify mentor

    Note over Database: Mentor approves submission

    Database->>Database: Trigger: handle_sequential_submission_approval
    Database->>Database: Insert into user_unlocks (next lesson)
    Database->>EdgeFunctions: Send notification
    EdgeFunctions->>Student: WhatsApp/Email notification

    Student->>Frontend: Ask Success Partner AI
    Frontend->>EdgeFunctions: process-success-partner-message
    EdgeFunctions->>Database: Deduct credits
    EdgeFunctions->>AI: Generate response
    AI-->>EdgeFunctions: AI response
    EdgeFunctions->>Database: Log message
    EdgeFunctions-->>Frontend: Return response
    Frontend-->>Student: Display AI answer
```

---

## Data Flow: Admin Operations

```mermaid
sequenceDiagram
    participant Admin
    participant Frontend
    participant EdgeFunctions
    participant Database
    participant External

    Admin->>Frontend: Create new student
    Frontend->>EdgeFunctions: /create-enhanced-student
    EdgeFunctions->>Database: Insert into users (service role)
    EdgeFunctions->>Database: Insert into students
    EdgeFunctions->>Database: Generate invoice
    EdgeFunctions->>Database: Unlock first lesson
    EdgeFunctions->>External: Send welcome email
    EdgeFunctions-->>Frontend: Success
    Frontend-->>Admin: Student created

    Admin->>Frontend: View analytics
    Frontend->>Database: Query student_performance
    Frontend->>Database: Query financial_data
    Frontend->>Database: Query recovery_metrics
    Database-->>Frontend: Aggregated data
    Frontend-->>Admin: Display dashboards

    Admin->>Frontend: Send recovery message
    Frontend->>EdgeFunctions: /daily-recovery-check (manual)
    EdgeFunctions->>Database: Find inactive students
    EdgeFunctions->>External: Send WhatsApp messages
    EdgeFunctions->>Database: Log recovery_messages
    EdgeFunctions-->>Frontend: Report sent
    Frontend-->>Admin: Messages sent
```

---

## Security Architecture

```mermaid
graph TB
    subgraph "Public Access"
        Login[Login Page]
        Public[Public Assets]
    end

    subgraph "Authenticated Access"
        Dashboard[User Dashboard]
        Content[Course Content]
    end

    subgraph "RLS Layer"
        PolicyCheck{RLS Policy Check}
        RoleCheck{Role Verification}
    end

    subgraph "Database"
        UserData[User Data]
        StudentData[Student Data]
        ContentData[Content Data]
        FinancialData[Financial Data]
    end

    subgraph "Admin Functions"
        EdgeFunc[Edge Functions<br/>Service Role]
        AdminOps[Admin Operations]
    end

    Login --> Dashboard
    Dashboard --> PolicyCheck
    Content --> PolicyCheck
    
    PolicyCheck --> RoleCheck
    RoleCheck -->|Student| UserData
    RoleCheck -->|Student| StudentData
    RoleCheck -->|Student| ContentData
    RoleCheck -->|Mentor| StudentData
    RoleCheck -->|Mentor| ContentData
    RoleCheck -->|Admin| UserData
    RoleCheck -->|Admin| StudentData
    RoleCheck -->|Admin| ContentData
    RoleCheck -->|Admin| FinancialData
    
    AdminOps --> EdgeFunc
    EdgeFunc -->|Bypass RLS| UserData
    EdgeFunc -->|Bypass RLS| StudentData
    EdgeFunc -->|Bypass RLS| FinancialData

    style PolicyCheck fill:#ff6b6b
    style RoleCheck fill:#ffa726
    style EdgeFunc fill:#66bb6a
```

---

## Deployment Architecture

```mermaid
graph TB
    subgraph "Client Side"
        Browser[Web Browser]
    end

    subgraph "CDN / Hosting"
        Vercel[Vercel / Netlify / CloudFlare]
        StaticFiles[Static Assets CSS, JS, Images]
    end

    subgraph "Supabase Cloud"
        Auth[Supabase Auth]
        Database[PostgreSQL Database]
        Storage[Supabase Storage]
        EdgeFunctions[Edge Functions Deno]
        Realtime[Realtime Subscriptions]
    end

    subgraph "External Services"
        SMTP[Email Provider]
        WhatsApp[WhatsApp Business API]
        Shopify[Shopify API]
        MetaAds[Meta Ads API]
        OpenAI[OpenAI API]
    end

    Browser --> Vercel
    Vercel --> StaticFiles
    Browser --> Auth
    Browser --> Database
    Browser --> Storage
    Browser --> EdgeFunctions
    Browser --> Realtime

    EdgeFunctions --> SMTP
    EdgeFunctions --> WhatsApp
    EdgeFunctions --> Shopify
    EdgeFunctions --> MetaAds
    EdgeFunctions --> OpenAI

    EdgeFunctions --> Database
```

---

## Cron Job Schedule

```mermaid
gantt
    title Daily Background Jobs UTC
    dateFormat HH:mm
    axisFormat %H:%M

    section Daily Jobs
    Reset SP Credits         :done, 00:00, 5m
    Recovery Check           :done, 09:00, 30m
    Notification Scheduler   :done, 10:00, 15m
    Installment Reminders    :done, 12:00, 20m
    Process Email Queue      :crit, 14:00, 1h
    Build Leaderboard        :done, 20:00, 10m
    Cleanup Inactive         :done, 23:00, 15m
```

---

## Support

For architecture questions or system design consultation:

- **Email**: [support@core47.ai](mailto:support@core47.ai)
- **Enterprise**: [enterprise@core47.ai](mailto:enterprise@core47.ai)

---

**Developed by Core47.ai** - © 2025 Core47.ai. All rights reserved.  
**Website**: [core47.ai](https://core47.ai) | **Support**: [support@core47.ai](mailto:support@core47.ai)
