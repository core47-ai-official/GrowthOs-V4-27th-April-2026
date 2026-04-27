import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Get live sessions needing reminders
    const { data: sessions, error } = await supabase
      .from('batch_timeline_items')
      .select(`
        *,
        batch:batches(id, name, course_id)
      `)
      .eq('type', 'LIVE_SESSION')
      .eq('session_status', 'scheduled')
      .not('start_datetime', 'is', null);

    if (error) throw error;

    const results = { sent_24h: 0, sent_1h: 0, sent_start: 0 };

    for (const session of sessions || []) {
      const startTime = new Date(session.start_datetime);
      
      // Get batch students
      const { data: enrollments } = await supabase
        .from('course_enrollments')
        .select('student_id, students(user_id, users(email, full_name))')
        .eq('batch_id', session.batch_id);

      if (!enrollments?.length) continue;

      // 24 hour reminder
      if (!session.reminder_24h_sent_at && 
          startTime > now && 
          startTime <= twentyFourHoursFromNow) {
        
        for (const enrollment of enrollments) {
          const user = (enrollment as any).students?.users;
          if (!user?.email) continue;

          await supabase.from('notifications').insert({
            user_id: (enrollment as any).students?.user_id,
            type: 'live_session_reminder',
            status: 'sent',
            channel: 'in_app',
            payload: {
              title: 'Live Session Tomorrow',
              message: `"${session.title}" starts tomorrow. Don't miss it!`,
              session_id: session.id
            }
          });
        }

        await supabase
          .from('batch_timeline_items')
          .update({ reminder_24h_sent_at: now.toISOString() })
          .eq('id', session.id);
        
        results.sent_24h++;
      }

      // 1 hour reminder
      if (!session.reminder_1h_sent_at && 
          startTime > now && 
          startTime <= oneHourFromNow) {
        
        for (const enrollment of enrollments) {
          const user = (enrollment as any).students?.users;
          if (!user?.email) continue;

          await supabase.from('notifications').insert({
            user_id: (enrollment as any).students?.user_id,
            type: 'live_session_reminder',
            status: 'sent',
            channel: 'in_app',
            payload: {
              title: 'Live Session Starting Soon',
              message: `"${session.title}" starts in 1 hour. Get ready!`,
              session_id: session.id
            }
          });
        }

        await supabase
          .from('batch_timeline_items')
          .update({ reminder_1h_sent_at: now.toISOString() })
          .eq('id', session.id);
        
        results.sent_1h++;
      }

      // Start time reminder (within 5 minutes of start)
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
      if (!session.reminder_start_sent_at && 
          startTime > now && 
          startTime <= fiveMinutesFromNow) {
        
        for (const enrollment of enrollments) {
          await supabase.from('notifications').insert({
            user_id: (enrollment as any).students?.user_id,
            type: 'live_session_starting',
            status: 'sent',
            channel: 'in_app',
            payload: {
              title: 'Live Session Starting Now!',
              message: `"${session.title}" is starting now. Join now!`,
              session_id: session.id,
              meeting_link: session.meeting_link
            }
          });
        }

        await supabase
          .from('batch_timeline_items')
          .update({ reminder_start_sent_at: now.toISOString() })
          .eq('id', session.id);
        
        results.sent_start++;
      }
    }

    // ── Auto-update success_sessions status ──
    // Mark upcoming → live (start_time has passed)
    const { data: toLive } = await supabase
      .from('success_sessions')
      .update({ status: 'live' })
      .eq('status', 'upcoming')
      .lte('start_time', now.toISOString())
      .select('id');

    // Mark live → completed (end_time has passed, fallback start_time + 1hr)
    const { data: liveSessions } = await supabase
      .from('success_sessions')
      .select('id, start_time, end_time')
      .eq('status', 'live');

    let completedCount = 0;
    if (liveSessions?.length) {
      const toComplete = liveSessions.filter(s => {
        const start = new Date(s.start_time);
        const end = s.end_time ? new Date(s.end_time) : new Date(start.getTime() + 60 * 60 * 1000);
        return now >= end;
      });
      if (toComplete.length > 0) {
        const ids = toComplete.map(s => s.id);
        await supabase
          .from('success_sessions')
          .update({ status: 'completed' })
          .in('id', ids);
        completedCount = toComplete.length;
      }
    }

    (results as any).sessions_made_live = toLive?.length || 0;
    (results as any).sessions_completed = completedCount;
    return new Response(JSON.stringify({ success: true, results }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in live-session-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
