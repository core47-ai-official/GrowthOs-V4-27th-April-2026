import { supabase } from '@/integrations/supabase/client';
import { AtRiskStudent } from '@/hooks/useAtRiskStudents';

/**
 * Compose a reason-specific, direct message for at-risk student outreach.
 */
export function composeOutreachMessage(student: AtRiskStudent, channel: 'email' | 'whatsapp'): { subject: string; body: string } {
  const firstName = (student.name || 'there').split(' ')[0];
  const reasonLines = student.reasons.map(r => `• ${r.label}: ${r.detail}`).join('\n');

  const subject = `Checking in on your progress, ${firstName}`;

  if (channel === 'email') {
    const body =
`Hi ${firstName},

We noticed a few things on your account that suggest you might need some support to stay on track:

${reasonLines}

We're here to help. Could you reply to let us know what's blocking you, or schedule a quick call with your mentor?

If anything is unclear or you've hit a roadblock, we'd love to hear about it so we can get you back on track.

Best regards,
Your Success Team`;
    return { subject, body };
  }

  // WhatsApp - shorter format, single line breaks
  const body =
`Hi ${firstName}, checking in from your team. We noticed:
${reasonLines}

Can we help you get back on track? Reply here or let us know a good time to chat.`;
  return { subject, body };
}

/**
 * Build a wa.me deep link. Strips non-digit chars from phone.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Build a mailto: link with subject + body.
 */
export function buildMailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Notify a mentor about an at-risk student: in-app notification + queued email.
 */
export async function notifyMentorOfAtRiskStudent(args: {
  mentorId: string;
  mentorEmail: string;
  mentorName: string;
  student: AtRiskStudent;
  triggeredBy: string;
}): Promise<{ success: boolean; error?: string }> {
  const { mentorId, mentorEmail, mentorName, student, triggeredBy } = args;
  const reasonLines = student.reasons.map(r => `• ${r.label}: ${r.detail}`).join('\n');
  const daysAtRisk = student.days_at_risk ?? 0;

  try {
    // 1. In-app notification
    await supabase.from('notifications').insert({
      user_id: mentorId,
      type: 'at_risk_student',
      status: 'sent',
      channel: 'in_app',
      sent_at: new Date().toISOString(),
      payload: {
        title: `At-Risk Student: ${student.name}`,
        message: `${student.name} has been flagged at-risk for ${daysAtRisk} day${daysAtRisk === 1 ? '' : 's'}. Issues: ${student.reasons.map(r => r.label).join(', ')}`,
        student_id: student.user_id,
        student_name: student.name,
        student_email: student.email,
        severity: student.severity,
        reasons: student.reasons.map(r => r.type),
      },
    });

    // 2. Email via existing email_queue
    const subject = `[At-Risk Alert] ${student.name} needs your attention`;
    const emailBody =
`Hi ${mentorName.split(' ')[0] || 'there'},

One of your students has been flagged as at-risk and could use a check-in.

Student: ${student.name}
Email: ${student.email}
${student.phone ? `Phone: ${student.phone}` : ''}
${student.batch_name ? `Batch: ${student.batch_name}` : ''}
Days at-risk: ${daysAtRisk}
Severity: ${student.severity === 'critical' ? 'Critical' : 'Warning'}

Reasons flagged:
${reasonLines}

Please reach out to ${student.name.split(' ')[0]} when you can to help them get back on track.

Best regards,
Growth OS Team`;

    await supabase.from('email_queue').insert({
      user_id: mentorId,
      recipient_email: mentorEmail,
      recipient_name: mentorName,
      email_type: 'at_risk_mentor_alert',
      status: 'pending',
      credentials: {
        subject,
        body: emailBody,
        student_id: student.user_id,
        student_name: student.name,
      },
    });

    // 3. Audit log
    await supabase.from('user_activity_logs').insert({
      user_id: student.user_id,
      activity_type: 'at_risk_mentor_notified',
      occurred_at: new Date().toISOString(),
      metadata: {
        mentor_id: mentorId,
        mentor_email: mentorEmail,
        triggered_by: triggeredBy,
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to notify mentor' };
  }
}
