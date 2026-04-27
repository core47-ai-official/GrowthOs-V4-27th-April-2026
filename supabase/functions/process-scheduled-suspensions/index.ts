import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (_req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Fetch all active scheduled suspensions where the date has arrived
    const { data: dueSuspensions, error: fetchError } = await supabase
      .from("scheduled_suspensions")
      .select("*, users!inner(full_name, email, lms_status)")
      .eq("status", "active")
      .lte("schedule_suspend_date", today.toISOString());

    if (fetchError) {
      console.error("Error fetching scheduled suspensions:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), { status: 500 });
    }

    let suspended = 0;
    let skipped = 0;

    for (const entry of dueSuspensions || []) {
      // IDEMPOTENCY: Atomically claim this scheduled suspension. If another concurrent run
      // already executed it, claimedRows will be empty and we skip all side-effects (suspend + notify).
      const { data: claimedRows, error: claimError } = await supabase
        .from("scheduled_suspensions")
        .update({ status: "executed", executed_at: new Date().toISOString() })
        .eq("id", entry.id)
        .eq("status", "active")
        .select("id");

      if (claimError) {
        console.error(`Failed to claim scheduled suspension ${entry.id}:`, claimError);
        continue;
      }
      if (!claimedRows || claimedRows.length === 0) {
        console.log(`[Skip] Scheduled suspension ${entry.id} already executed by another run`);
        continue;
      }

      // Skip suspending if user is already suspended (still mark this row executed above)
      if (entry.users?.lms_status === "suspended") {
        console.log(`[Skip Suspend] User ${entry.user_id} already suspended; suspension entry marked executed`);
        skipped++;
        continue;
      }

      // Atomic suspend — only flips inactive→suspended, prevents duplicate logs/notifications
      const { data: suspendedUserRows, error: suspendError } = await supabase
        .from("users")
        .update({
          lms_status: "suspended",
          updated_at: new Date().toISOString(),
        })
        .eq("id", entry.user_id)
        .neq("lms_status", "suspended")
        .select("id");

      if (suspendError) {
        console.error(`Error suspending user ${entry.user_id}:`, suspendError);
        continue;
      }

      if (!suspendedUserRows || suspendedUserRows.length === 0) {
        console.log(`[Skip Suspend] User ${entry.user_id} was suspended between fetch and update`);
        skipped++;
        continue;
      }

      // Log to user_activity_logs
      await supabase.from("user_activity_logs").insert({
        user_id: entry.user_id,
        activity_type: "lms_suspended",
        occurred_at: new Date().toISOString(),
        metadata: {
          suspension_note: entry.reason || "Scheduled suspension executed",
          auto_unsuspend_date: entry.auto_unsuspend_date || null,
          scheduled: true,
          scheduled_suspension_id: entry.id,
        },
      });

      // Log to admin_logs
      await supabase.from("admin_logs").insert({
        performed_by: entry.created_by,
        entity_type: "user",
        entity_id: entry.user_id,
        action: "lms_suspended",
        description: `Scheduled suspension executed for ${entry.users?.full_name || "Unknown"}`,
        data: {
          target_user_id: entry.user_id,
          suspension_note: entry.reason || "Scheduled suspension executed",
          auto_unsuspend_date: entry.auto_unsuspend_date || null,
          scheduled: true,
          scheduled_suspension_id: entry.id,
          timestamp: new Date().toISOString(),
        },
      });

      // Send notification to student
      try {
        await supabase.rpc("create_notification", {
          p_user_id: entry.user_id,
          p_type: "lms_suspended",
          p_title: "LMS Access Suspended",
          p_message: `Your learning platform access has been suspended.${entry.reason ? ` Reason: ${entry.reason}` : ""} Please contact support if you have questions.`,
          p_metadata: {
            scheduled: true,
            reason: entry.reason,
            auto_unsuspend_date: entry.auto_unsuspend_date,
          },
        });
      } catch (notifError) {
        console.error(`Notification error for ${entry.user_id}:`, notifError);
      }

      // Notify admins
      try {
        const { data: adminUsers } = await supabase
          .from("users")
          .select("id")
          .in("role", ["admin", "superadmin"]);

        for (const admin of adminUsers || []) {
          await supabase.rpc("create_notification", {
            p_user_id: admin.id,
            p_type: "financial",
            p_title: "Scheduled Suspension Executed",
            p_message: `${entry.users?.full_name || "Student"} has been automatically suspended as scheduled.${entry.reason ? ` Reason: ${entry.reason}` : ""}`,
            p_metadata: {
              student_id: entry.user_id,
              scheduled_suspension_id: entry.id,
            },
          });
        }
      } catch (adminNotifError) {
        console.error("Admin notification error:", adminNotifError);
      }

      suspended++;
      console.log(`Suspended user ${entry.users?.full_name} (${entry.user_id}) via scheduled suspension`);
    }

    console.log(`Processed scheduled suspensions: ${suspended} suspended, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: (dueSuspensions || []).length,
        suspended,
        skipped,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scheduled suspension processing error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
