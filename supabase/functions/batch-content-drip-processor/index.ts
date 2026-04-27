import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TimelineItem {
  id: string;
  batch_id: string;
  type: "RECORDING" | "LIVE_SESSION";
  title: string;
  description: string | null;
  drip_offset_days: number;
  recording_id: string | null;
  assignment_id: string | null;
  meeting_link: string | null;
  start_datetime: string | null;
  notification_sent_at: string | null;
  batch: {
    id: string;
    name: string;
    start_date: string | null;
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const functionUrl = `${supabaseUrl}/functions/v1/send-batch-content-notification`;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting batch content drip processor...");

    // Get all timeline items that haven't been notified yet
    const { data: pendingItems, error: fetchError } = await supabase
      .from("batch_timeline_items")
      .select(`
        id,
        batch_id,
        type,
        title,
        description,
        drip_offset_days,
        recording_id,
        assignment_id,
        meeting_link,
        start_datetime,
        notification_sent_at,
        batch:batches!batch_id (
          id,
          name,
          start_date
        )
      `)
      .is("notification_sent_at", null);

    if (fetchError) {
      console.error("Error fetching pending items:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch pending items" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!pendingItems || pendingItems.length === 0) {
      console.log("No pending items to process");
      return new Response(
        JSON.stringify({ message: "No pending items", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingItems.length} pending items to check`);

    const now = new Date();
    now.setHours(0, 0, 0, 0); // Start of today

    let processedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const item of pendingItems as TimelineItem[]) {
      try {
        // Skip if batch doesn't have a start date
        if (!item.batch?.start_date) {
          console.log(`Skipping item ${item.id}: batch has no start date`);
          skippedCount++;
          continue;
        }

        // Calculate the deploy date
        const batchStartDate = new Date(item.batch.start_date);
        batchStartDate.setHours(0, 0, 0, 0);
        
        const deployDate = new Date(batchStartDate);
        deployDate.setDate(deployDate.getDate() + item.drip_offset_days);

        console.log(`Item ${item.id}: batch start=${batchStartDate.toISOString()}, drip=${item.drip_offset_days}, deploy=${deployDate.toISOString()}, now=${now.toISOString()}`);

        // Check if deploy date has been reached
        if (deployDate > now) {
          console.log(`Skipping item ${item.id}: deploy date not yet reached`);
          skippedCount++;
          continue;
        }

        console.log(`Processing item ${item.id}: ${item.type} - ${item.title}`);

        // Call the notification function
        const notificationPayload = {
          batch_id: item.batch_id,
          item_type: item.type,
          item_id: item.recording_id || item.assignment_id || item.id,
          title: item.title,
          description: item.description,
          meeting_link: item.meeting_link,
          start_datetime: item.start_datetime,
          timeline_item_id: item.id,
        };

        const response = await fetch(functionUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify(notificationPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Notification function failed: ${errorText}`);
        }

        const result = await response.json();
        console.log(`Notification result for item ${item.id}:`, result);

        processedCount++;
      } catch (error: any) {
        console.error(`Error processing item ${item.id}:`, error);
        errors.push(`${item.id}: ${error.message}`);
      }
    }

    console.log(`Drip processor complete: ${processedCount} processed, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in batch-content-drip-processor:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
