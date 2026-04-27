/**
 * Type definitions for database query results
 * Issue 2: Type safety improvements - proper interfaces instead of any
 */

export interface UserDataResult {
  dream_goal_summary: string | null;
  shopify_credentials: string | null;
  meta_ads_credentials: string | null;
  lms_status: string | null;
}

export interface UserStatusResult {
  status: string;
}

export interface StudentDataResult {
  id?: string;
  answers_json: any; // JSON type from Supabase
  goal_brief: string | null;
}

export interface RecordingRatingResult {
  id: string;
  recording_id: string;
  student_id: string;
  rating: number;
  feedback: string | null;
  lesson_title: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModuleResult {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface SuccessSessionResult {
  id: string;
  title: string;
  description: string;
  mentor_id: string;
  start_time: string;
  end_time: string;
  link: string;
  status: string;
}

export interface UserBasicResult {
  full_name: string;
  email: string;
}

export interface UserWithRoleResult {
  full_name: string;
  role: string;
}

export interface CreatedUserResult {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}