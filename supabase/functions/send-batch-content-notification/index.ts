import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "../_shared/smtp-client.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationRequest {
  batch_id: string;
  item_type: "RECORDING" | "LIVE_SESSION" | "ASSIGNMENT";
  item_id: string;
  title: string;
  description?: string;
  meeting_link?: string;
  start_datetime?: string;
  timeline_item_id?: string;
}

interface Student {
  id: string;
  email: string;
  full_name: string;
}

function generateEmailHTML(
  studentName: string,
  itemType: string,
  title: string,
  description: string | undefined,
  meetingLink: string | undefined,
  startDatetime: string | undefined,
  lmsUrl: string
): string {
  const firstName = studentName?.split(" ")[0] || "Student";

  if (itemType === "RECORDING") {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Recording Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 60px; height: 60px; background-color: #10b981; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 28px;">🎬</span>
        </div>
        <h1 style="color: #1f2937; font-size: 24px; margin: 0;">New Recording Available!</h1>
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${firstName},
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        A new recording is now available in your course!
      </p>
      
      <div style="background-color: #f0fdf4; border-left: 4px solid #10b981; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <h2 style="color: #166534; font-size: 18px; margin: 0 0 10px 0;">📹 ${title}</h2>
        ${description ? `<p style="color: #4b5563; font-size: 14px; margin: 0;">${description}</p>` : ""}
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Login to start watching now.
      </p>
      
      <div style="text-align: center;">
        <a href="${lmsUrl}" style="display: inline-block; background-color: #10b981; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          Start Learning
        </a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 40px;">
        Keep up the great work! 🚀
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  if (itemType === "LIVE_SESSION") {
    const formattedDate = startDatetime
      ? new Date(startDatetime).toLocaleString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          timeZoneName: "short",
        })
      : "To be announced";

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Session Scheduled</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 60px; height: 60px; background-color: #8b5cf6; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 28px;">📅</span>
        </div>
        <h1 style="color: #1f2937; font-size: 24px; margin: 0;">Live Session Scheduled!</h1>
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${firstName},
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        A live session has been scheduled for your batch!
      </p>
      
      <div style="background-color: #f5f3ff; border-left: 4px solid #8b5cf6; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <h2 style="color: #5b21b6; font-size: 18px; margin: 0 0 15px 0;">🎯 ${title}</h2>
        <p style="color: #4b5563; font-size: 14px; margin: 0 0 10px 0;">
          <strong>📆 Date & Time:</strong> ${formattedDate}
        </p>
        ${meetingLink ? `<p style="color: #4b5563; font-size: 14px; margin: 0;"><strong>🔗 Meeting Link:</strong> <a href="${meetingLink}" style="color: #8b5cf6;">${meetingLink}</a></p>` : ""}
        ${description ? `<p style="color: #6b7280; font-size: 14px; margin-top: 10px;">${description}</p>` : ""}
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Mark your calendar and join on time.
      </p>
      
      <div style="text-align: center;">
        <a href="${lmsUrl}" style="display: inline-block; background-color: #8b5cf6; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          View Details
        </a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 40px;">
        See you there! 🎉
      </p>
    </div>
  </div>
</body>
</html>`;
  }

  // ASSIGNMENT
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Assignment Available</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <div style="background-color: #ffffff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="width: 60px; height: 60px; background-color: #f59e0b; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 28px;">📝</span>
        </div>
        <h1 style="color: #1f2937; font-size: 24px; margin: 0;">New Assignment Available!</h1>
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        Hi ${firstName},
      </p>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
        A new assignment has been unlocked for you!
      </p>
      
      <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
        <h2 style="color: #b45309; font-size: 18px; margin: 0 0 10px 0;">✍️ ${title}</h2>
        ${description ? `<p style="color: #4b5563; font-size: 14px; margin: 0;">${description}</p>` : ""}
      </div>
      
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">
        Complete this before the next recording unlocks.
      </p>
      
      <div style="text-align: center;">
        <a href="${lmsUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          View Assignment
        </a>
      </div>
      
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 40px;">
        You've got this! 💪
      </p>
    </div>
  </div>
</body>
</html>`;
}

function getEmailSubject(itemType: string, title: string): string {
  switch (itemType) {
    case "RECORDING":
      return `New Recording Available: ${title}`;
    case "LIVE_SESSION":
      return `Live Session Scheduled: ${title}`;
    case "ASSIGNMENT":
      return `New Assignment Available: ${title}`;
    default:
      return `New Content Available: ${title}`;
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lmsUrl = Deno.env.get("LMS_URL") || "https://growthos-final.lovable.app";
    const notificationCcSecret = Deno.env.get("NOTIFICATION_EMAIL_CC");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch notification CC from company settings, fall back to secret
    const { data: ccSettings } = await supabase
      .from('company_settings')
      .select('notification_email_cc')
      .eq('id', 1)
      .single();
    const notificationCc = ccSettings?.notification_email_cc || notificationCcSecret;

    const body: NotificationRequest = await req.json();
    const {
      batch_id,
      item_type,
      item_id,
      title,
      description,
      meeting_link,
      start_datetime,
      timeline_item_id,
    } = body;

    // Validate required fields
    if (!batch_id || !item_type || !item_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: batch_id, item_type, item_id, title" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing notification for batch ${batch_id}, type: ${item_type}, title: ${title}`);

    // Get batch details
    const { data: batch, error: batchError } = await supabase
      .from("batches")
      .select("id, name, start_date")
      .eq("id", batch_id)
      .single();

    if (batchError || !batch) {
      console.error("Batch not found:", batchError);
      return new Response(
        JSON.stringify({ error: "Batch not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get enrolled students for this batch
    const { data: enrollments, error: enrollmentError } = await supabase
      .from("course_enrollments")
      .select(`
        user_id,
        users:user_id (
          id,
          email,
          full_name
        )
      `)
      .eq("batch_id", batch_id)
      .eq("status", "active");

    if (enrollmentError) {
      console.error("Error fetching enrollments:", enrollmentError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch enrolled students" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!enrollments || enrollments.length === 0) {
      console.log("No students enrolled in this batch");
      return new Response(
        JSON.stringify({ message: "No students enrolled in batch", sent: 0, failed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract unique students
    const students: Student[] = enrollments
      .filter((e: any) => e.users?.email)
      .map((e: any) => ({
        id: e.users.id,
        email: e.users.email,
        full_name: e.users.full_name || "Student",
      }));

    console.log(`Sending notifications to ${students.length} students`);

    // Initialize SMTP client
    let smtpClient: SMTPClient | null = null;
    try {
      smtpClient = SMTPClient.fromEnv();
    } catch (error) {
      console.error("SMTP not configured, will queue emails:", error);
    }

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const student of students) {
      try {
        const emailHtml = generateEmailHTML(
          student.full_name,
          item_type,
          title,
          description,
          meeting_link,
          start_datetime,
          lmsUrl
        );
        const subject = getEmailSubject(item_type, title);

        if (smtpClient) {
          // Send directly via SMTP
          await smtpClient.sendEmail({
            to: student.email,
            subject,
            html: emailHtml,
            cc: notificationCc,
          });
          console.log(`Email sent to ${student.email}`);
        } else {
          // Queue email for later processing
          await supabase.from("email_queue").insert({
            recipient_email: student.email,
            subject,
            html_content: emailHtml,
            cc_email: notificationCc,
            status: "pending",
          });
          console.log(`Email queued for ${student.email}`);
        }

        // Create in-app notification
        await supabase.from("notifications").insert({
          user_id: student.id,
          title: subject,
          message: `${title}${description ? `: ${description.substring(0, 100)}...` : ""}`,
          type: "content",
          action_url: lmsUrl,
        });

        sentCount++;
      } catch (error: any) {
        console.error(`Failed to notify ${student.email}:`, error);
        errors.push(`${student.email}: ${error.message}`);
        failedCount++;
      }
    }

    // Update timeline item notification_sent_at if provided
    if (timeline_item_id) {
      await supabase
        .from("batch_timeline_items")
        .update({ notification_sent_at: new Date().toISOString() })
        .eq("id", timeline_item_id);
    }

    console.log(`Notification complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-batch-content-notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
