import { supabase } from "@/integrations/supabase/client";

export interface ActivityLogData {
  user_id: string;
  activity_type: string;
  metadata?: any;
  reference_id?: string;
}

export interface AdminLogData {
  performed_by?: string | null; // WHO did it (null = system)
  target_user_id?: string | null; // WHO it was done TO
  entity_type: string;
  entity_id?: string | null;
  action: string;
  description: string;
  data?: any;
}

/**
 * Log to admin_logs — the unified activity log table.
 * Used for ALL actions: student self-actions, admin actions on students, and system actions.
 */
export const logToAdminLogs = async (logData: AdminLogData) => {
  try {
    const { error } = await supabase
      .from('admin_logs')
      .insert([{
        performed_by: logData.performed_by || null,
        entity_type: logData.entity_type,
        entity_id: logData.entity_id || null,
        action: logData.action,
        description: logData.description,
        data: {
          ...logData.data,
          target_user_id: logData.target_user_id || null,
          timestamp: new Date().toISOString()
        }
      }] as any);

    if (error) {
      console.warn('Failed to log to admin_logs:', error);
    }
  } catch (error) {
    console.warn('Admin log error:', error);
  }
};

/**
 * Log a user's own activity (login, video watched, etc.)
 * Also mirrors to admin_logs for unified querying.
 */
export const logUserActivity = async (activityData: ActivityLogData) => {
  try {
    // Insert into user_activity_logs (legacy, keep for backward compat)
    const { error } = await supabase
      .from('user_activity_logs')
      .insert([{
        user_id: activityData.user_id,
        activity_type: activityData.activity_type,
        metadata: activityData.metadata,
        reference_id: activityData.reference_id,
        occurred_at: new Date().toISOString()
      }]);

    if (error) {
      console.warn('Failed to log activity:', error);
    }

    // Mirror to admin_logs for unified view
    await logToAdminLogs({
      performed_by: activityData.user_id,
      target_user_id: activityData.user_id,
      entity_type: 'user',
      entity_id: activityData.reference_id || activityData.user_id,
      action: activityData.activity_type,
      description: activityData.activity_type.replace(/_/g, ' '),
      data: activityData.metadata
    });
  } catch (error) {
    console.warn('Activity logging error:', error);
  }
};

/**
 * Log an admin/mentor/system action performed ON a student.
 * This is the primary function for cross-user logging.
 */
export const logAdminAction = async (params: {
  performedBy: string | null; // admin/mentor user ID, or null for system
  targetUserId: string; // the student being acted on
  entityType: string;
  entityId?: string;
  action: string;
  description: string;
  data?: any;
}) => {
  await logToAdminLogs({
    performed_by: params.performedBy,
    target_user_id: params.targetUserId,
    entity_type: params.entityType,
    entity_id: params.entityId || params.targetUserId,
    action: params.action,
    description: params.description,
    data: params.data
  });
};

// Common activity types for consistency
export const ACTIVITY_TYPES = {
  LOGIN: 'login',
  LOGOUT: 'logout',
  ONBOARDING_COMPLETED: 'onboarding_completed',
  PAGE_VISIT: 'page_visit',
  VIDEO_WATCHED: 'video_watched',
  ASSIGNMENT_SUBMITTED: 'assignment_submitted',
  ASSIGNMENT_VIEWED: 'assignment_viewed',
  ASSIGNMENT_REVIEWED: 'assignment_reviewed',
  PROFILE_UPDATED: 'profile_updated',
  PASSWORD_CHANGED: 'password_changed',
  LEADERBOARD_VIEWED: 'leaderboard_viewed',
  MODULE_COMPLETED: 'module_completed',
  MODULE_STARTED: 'module_started',
  SUPPORT_TICKET_CREATED: 'support_ticket_created',
  SUPPORT_TICKET_REPLIED: 'support_ticket_replied',
  SESSION_ATTENDED: 'session_attended',
  CERTIFICATE_DOWNLOADED: 'certificate_downloaded',
  USER_CREATED: 'user_created',
  USER_UPDATED: 'user_updated',
  USER_DELETED: 'user_deleted',
  CONTENT_CREATED: 'content_created',
  CONTENT_UPDATED: 'content_updated',
  CONTENT_DELETED: 'content_deleted',
  ROLE_CHANGED: 'role_changed',
  SETTINGS_UPDATED: 'settings_updated',
  ASSIGNMENT_APPROVED: 'assignment_approved',
  ASSIGNMENT_DECLINED: 'assignment_declined',
  RECORDING_UNLOCKED: 'recording_unlocked',
  SUCCESS_SESSION_SCHEDULED: 'success_session_scheduled',
  SUCCESS_SESSION_ATTENDED: 'success_session_attended',
  LMS_STATUS_CHANGED: 'lms_status_changed',
  LMS_SUSPENDED: 'lms_suspended',
  LMS_ACTIVATED: 'lms_activated',
  RECORDING_CREATED: 'recording_created',
  RECORDING_UPDATED: 'recording_updated',
  RECORDING_DELETED: 'recording_deleted',
  MODULE_CREATED: 'module_created',
  MODULE_UPDATED: 'module_updated',
  MODULE_DELETED: 'module_deleted',
  COURSE_CREATED: 'course_created',
  COURSE_UPDATED: 'course_updated',
  PATHWAY_CREATED: 'pathway_created',
  PATHWAY_UPDATED: 'pathway_updated',
  BATCH_CREATED: 'batch_created',
  STUDENT_ENROLLED_IN_BATCH: 'student_enrolled_in_batch',
  INVOICE_PAID: 'invoice_paid',
  INVOICE_CREATED: 'invoice_created',
  INVOICE_RESENT: 'invoice_resent',
  DRIP_CONTENT_TOGGLED: 'drip_content_toggled',
  MENTOR_ASSIGNED: 'mentor_assigned',
  MENTOR_REMOVED: 'mentor_removed',
} as const;

// Helper function to log specific activities with common patterns
export const logActivity = {
  login: (userId: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.LOGIN,
    metadata: { timestamp: new Date().toISOString() }
  }),

  logout: (userId: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.LOGOUT,
    metadata: { timestamp: new Date().toISOString() }
  }),

  pageVisit: (userId: string, page: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.PAGE_VISIT,
    metadata: { page, timestamp: new Date().toISOString() }
  }),

  videoWatched: (userId: string, videoId: string, duration?: number) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.VIDEO_WATCHED,
    reference_id: videoId,
    metadata: { videoId, duration, timestamp: new Date().toISOString() }
  }),

  assignmentSubmitted: (userId: string, assignmentId: string, submissionType: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.ASSIGNMENT_SUBMITTED,
    reference_id: assignmentId,
    metadata: { assignmentId, submissionType, timestamp: new Date().toISOString() }
  }),

  moduleCompleted: (userId: string, moduleId: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.MODULE_COMPLETED,
    reference_id: moduleId,
    metadata: { moduleId, timestamp: new Date().toISOString() }
  }),

  supportTicketCreated: (userId: string, ticketId: string, type: string) => logUserActivity({
    user_id: userId,
    activity_type: ACTIVITY_TYPES.SUPPORT_TICKET_CREATED,
    reference_id: ticketId,
    metadata: { ticketId, type, timestamp: new Date().toISOString() }
  }),

  userAction: (userId: string, action: string, target: string, targetId?: string) => logUserActivity({
    user_id: userId,
    activity_type: action,
    reference_id: targetId,
    metadata: { action, target, targetId, timestamp: new Date().toISOString() }
  })
} as const;
