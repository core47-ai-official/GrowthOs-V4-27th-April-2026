import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { SMTPClient } from "../_shared/smtp-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id, recording_id } = await req.json();

    if (!user_id || !recording_id) {
      throw new Error('Missing user_id or recording_id');
    }

    console.log(`Processing unlock notification for user ${user_id}, recording ${recording_id}`);

    // Get student details
    const { data: student, error: studentError } = await supabase
      .from('users')
      .select('email, full_name')
      .eq('id', user_id)
      .single();

    if (studentError || !student) {
      console.error('Could not find student:', studentError);
      throw new Error('Student not found');
    }

    // Get recording/lesson details
    const { data: lesson, error: lessonError } = await supabase
      .from('available_lessons')
      .select('recording_title, module, assignment_id, description')
      .eq('id', recording_id)
      .single();

    if (lessonError || !lesson) {
      console.error('Could not find lesson:', lessonError);
      throw new Error('Lesson not found');
    }

    // Get module name if available
    let moduleName = '';
    if (lesson.module) {
      const { data: mod } = await supabase
        .from('modules')
        .select('title')
        .eq('id', lesson.module)
        .single();
      moduleName = mod?.title || '';
    }

    // Get company settings for branding
    const { data: settings } = await supabase
      .from('company_settings')
      .select('company_name, site_url, logo_url, notification_email_cc')
      .limit(1)
      .single();

    const companyName = settings?.company_name || 'Learning Platform';
    const siteUrl = settings?.site_url || Deno.env.get('SITE_URL') || '';
    const logoUrl = settings?.logo_url || '';
    const recordingTitle = lesson.recording_title || 'New Content';
    const hasAssignment = !!lesson.assignment_id;

    const subject = `🔓 New Content Unlocked: ${recordingTitle}`;

    const htmlContent = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        ${logoUrl ? `<tr><td style="padding:30px 40px 10px;text-align:center;"><img src="${logoUrl}" alt="${companyName}" style="max-height:50px;"></td></tr>` : ''}
        <tr><td style="padding:20px 40px 10px;">
          <h1 style="color:#1a1a2e;font-size:22px;margin:0;">New Content Unlocked! 🎉</h1>
        </td></tr>
        <tr><td style="padding:10px 40px;">
          <p style="color:#4a4a68;font-size:15px;line-height:1.6;margin:0;">
            Hi <strong>${student.full_name}</strong>,
          </p>
          <p style="color:#4a4a68;font-size:15px;line-height:1.6;">
            Great news! A new lesson has been unlocked for you:
          </p>
          <div style="background:#f0f4ff;border-left:4px solid #4f46e5;padding:16px 20px;border-radius:0 8px 8px 0;margin:16px 0;">
            <p style="margin:0;font-size:16px;font-weight:bold;color:#1a1a2e;">${recordingTitle}</p>
            ${moduleName ? `<p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Module: ${moduleName}</p>` : ''}
          </div>
          ${hasAssignment ? `
          <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 20px;border-radius:0 8px 8px 0;margin:16px 0;">
            <p style="margin:0;font-size:14px;color:#92400e;">📝 <strong>Assignment Available</strong> — This lesson includes an assignment. Complete it to unlock the next lesson.</p>
          </div>` : ''}
          ${siteUrl ? `
          <div style="text-align:center;margin:28px 0;">
            <a href="${siteUrl}" style="background-color:#4f46e5;color:#ffffff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
              Start Learning →
            </a>
          </div>` : ''}
          <p style="color:#9ca3af;font-size:13px;margin-top:24px;">
            Keep up the great work! Every lesson completed brings you closer to your goals.
          </p>
        </td></tr>
        <tr><td style="padding:20px 40px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;text-align:center;">
            ${companyName} • This is an automated notification
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    // Get notification CC
    const notificationCc = settings?.notification_email_cc || Deno.env.get('NOTIFICATION_EMAIL_CC') || '';

    // Try to send directly first, fall back to queue
    try {
      const emailClient = SMTPClient.fromEnv();
      await emailClient.sendEmail({
        to: student.email,
        subject,
        html: htmlContent,
        ...(notificationCc ? { cc: notificationCc } : {}),
      });
      console.log(`Unlock notification sent directly to ${student.email}`);
    } catch (sendError) {
      console.warn('Direct send failed, queuing email:', sendError.message);
      // Fall back to email queue
      await supabase.from('email_queue').insert({
        user_id,
        recipient_email: student.email,
        recipient_name: student.full_name,
        email_type: 'content_unlocked',
        status: 'pending',
        subject,
        html_content: htmlContent,
        cc_email: notificationCc || null,
        credentials: { recording_title: recordingTitle, has_assignment: hasAssignment },
      });
      console.log(`Unlock notification queued for ${student.email}`);
    }

    // Also create in-app notification
    await supabase.from('notifications').insert({
      user_id,
      title: `New Content Unlocked: ${recordingTitle}`,
      message: `${recordingTitle} is now available${hasAssignment ? ' with an assignment' : ''}. Start learning!`,
      type: 'content',
      action_url: siteUrl ? `${siteUrl}/videos` : '/videos',
    });

    return new Response(
      JSON.stringify({ success: true, message: `Notification sent to ${student.email}` }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('Error in notify-content-unlocked:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});
