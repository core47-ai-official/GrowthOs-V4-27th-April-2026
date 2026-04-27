import { supabase } from "@/integrations/supabase/client";

interface NotificationPayload {
  title: string;
  message: string;
  type: string;
  user_id: string;
  metadata?: any;
}

export const createNotification = async (payload: NotificationPayload) => {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: payload.user_id,
        type: payload.type,
        status: 'sent',
        payload: {
          title: payload.title,
          message: payload.message,
          ...payload.metadata
        },
        channel: 'in_app',
        sent_at: new Date().toISOString()
      });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

export const notifyMentorOfAssignmentSubmission = async (
  mentorId: string,
  studentName: string,
  assignmentTitle: string,
  submissionId: string
) => {
  return createNotification({
    title: "New Assignment Submission",
    message: `${studentName} has submitted "${assignmentTitle}"`,
    type: "assignment_submission",
    user_id: mentorId,
    metadata: {
      submission_id: submissionId,
      student_name: studentName,
      assignment_title: assignmentTitle
    }
  });
};

export const notifyMentorOfSuccessSessionScheduled = async (
  mentorId: string,
  sessionTitle: string,
  sessionDate: string,
  sessionId: string
) => {
  return createNotification({
    title: "Success Session Scheduled",
    message: `You have been assigned to host "${sessionTitle}" on ${new Date(sessionDate).toLocaleDateString()}`,
    type: "success_session",
    user_id: mentorId,
    metadata: {
      session_id: sessionId,
      session_title: sessionTitle,
      session_date: sessionDate
    }
  });
};

export const notifyMentorOfStudentProgress = async (
  mentorId: string,
  studentName: string,
  progressType: string,
  details: string
) => {
  return createNotification({
    title: "Student Progress Update",
    message: `${studentName} - ${progressType}: ${details}`,
    type: "student_progress",
    user_id: mentorId,
    metadata: {
      student_name: studentName,
      progress_type: progressType,
      details
    }
  });
};