/**
 * Common type definitions to replace 'any' types throughout the app
 */

export interface User {
  id: string;
  email: string;
  role: 'student' | 'admin' | 'mentor' | 'superadmin' | 'enrollment_manager' | 'support_member';
  full_name?: string;
  created_at?: string;
  avatar_url?: string;
  student_id?: string;
  mentor_id?: string;
  shopify_credentials?: string;
  meta_ads_credentials?: string;
  dream_goal_summary?: string;
  onboarding_done?: boolean;
  fees_overdue?: boolean;
  fees_due_date?: string;
  status?: string;
  lms_status?: string;
  lms_user_id?: string;
  last_active_at?: string;
  password_display?: string;
  password_hash?: string;
  is_temp_password?: boolean;
}

// Legacy interfaces for backward compatibility
export interface Student extends User {
  role: 'student';
  student_id?: string;
  phone?: string;
  fees_structure?: any;
  fees_overdue?: boolean;
  installment_count?: number;
  last_invoice_date?: string;
}

export interface Admin extends User {
  role: 'admin' | 'superadmin';
}

export interface TeamMember extends User {
  role: 'student' | 'admin' | 'mentor' | 'superadmin' | 'enrollment_manager' | 'support_member';
  lms_user_id?: string;
  last_active_at?: string;
}

export interface PendingInvoice {
  amount: number;
  invoice_number: string;
  due_date?: string;
  status?: 'pending' | 'paid' | 'overdue';
}

export interface Assignment {
  assignment_id: string;
  assignment_title: string;
  assignment_description?: string;
  sequence_order: number;
  due_date?: string;
  due_days_after_unlock?: number;
  status?: string;
  assigned_by?: string;
  mentor_id?: string;
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  user_id: string;
  assignment_id: string;
  text_response?: string;
  file_url?: string;
  external_link?: string;
  submission_type: 'text' | 'file' | 'link';
  status: 'submitted' | 'accepted' | 'rejected';
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  reviewed_note?: string;
  score?: number;
  feedback?: string;
  result?: string;
  mentor?: string;
  updated_at: string;
}

export interface Module {
  id: string;
  title: string;
  description?: string;
  order?: number;
  tenant_id?: string;
}

export interface Lesson {
  id: string;
  recording_title: string;
  recording_url?: string;
  duration_min?: number;
  sequence_order?: number;
  module: string;
  notes?: string;
  uploaded_at: string;
  uploaded_by?: string;
  batch_id?: string;
  assignment_id?: string;
  last_assignment_completed?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  channel: string;
  status: 'sent' | 'delivered' | 'failed' | 'read';
  sent_at?: string;
  payload?: {
    title: string;
    message: string;
    metadata?: Record<string, any>;
  };
  error_message?: string;
}

export interface StudentFormData {
  full_name: string;
  email: string;
  phone: string;
  installments: number;
  company_id?: string;
  course_id?: string;
}

export interface Integration {
  userId: string;
  shopify_domain?: string;
  shopify_token?: string;
  shopify_connected: boolean;
  meta_token?: string;
  meta_connected: boolean;
}

export interface CompanySettings {
  id: number;
  company_name: string;
  company_email?: string;
  company_logo?: string;
  contact_email: string;
  primary_phone: string;
  secondary_phone?: string;
  address: string;
  branding?: CompanyBranding;
  questionnaire?: QuestionnaireQuestion[];
  installment_plans?: number[];
  maximum_installment_count: number;
  original_fee_amount: number;
  currency: string;
  enable_student_signin: boolean;
  invoice_send_gap_days: number;
  invoice_overdue_days: number;
  invoice_from_email?: string;
  invoice_from_name?: string;
  invoice_notes?: string;
  lms_from_email?: string;
  lms_from_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyBranding {
  logo_url?: string;
  favicon_url?: string;
  header_logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
}

export interface QuestionnaireQuestion {
  id: string;
  text: string;
  order: number;
  answerType: 'singleLine' | 'multiLine' | 'singleSelect' | 'multiSelect' | 'file';
  options?: string[];
  required?: boolean;
}

export interface ActivityLog {
  id: string;
  user_id: string;
  activity_type: string;
  occurred_at: string;
  reference_id?: string;
  metadata?: Record<string, any>;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  title: string;
  description: string;
  type: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  created_at: string;
  updated_at: string;
}

export interface TicketReply {
  id: string;
  ticket_id: string;
  user_id: string;
  message: string;
  is_staff: boolean;
  created_at: string;
}

export interface InstallmentPayment {
  id: string;
  installment_number: number;
  amount: number;
  status?: 'pending' | 'paid' | 'overdue' | 'cancelled';
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string | null;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Form types
export interface FormErrors {
  [field: string]: string;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// State types
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

export interface AsyncState<T> extends LoadingState {
  data?: T;
}

// Event types
export interface UserActivityEvent {
  action: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Database operation types
export interface DatabaseError {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
}

export interface DatabaseResponse<T = any> {
  data: T | null;
  error: DatabaseError | null;
  count?: number;
  status?: number;
  statusText?: string;
}