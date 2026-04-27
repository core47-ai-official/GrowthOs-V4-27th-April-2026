import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";
import { SMTPClient } from "../_shared/smtp-client.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing email queue...');

    // Initialise email client (auto-detects Resend vs SMTP)
    const emailClient = SMTPClient.fromEnv();

    // Get pending emails from queue
    const { data: pendingEmails, error: fetchError } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('Error fetching pending emails:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingEmails?.length || 0} pending emails to process`);

    let processedCount = 0;
    let errorCount = 0;
    const processedEmails = [];

    for (const email of pendingEmails || []) {
      try {
        // Send via the configured provider (Resend or SMTP)
        await emailClient.sendEmail({
          to: email.recipient_email,
          subject: email.subject || 'Notification',
          html: email.html_content || email.body || '<p>No content</p>',
          ...(email.cc_email ? { cc: email.cc_email } : {}),
        });

        // Update email status to sent
        const { error: updateError } = await supabase
          .from('email_queue')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`Error updating email ${email.id}:`, updateError);
          errorCount++;
          continue;
        }

        processedEmails.push({
          id: email.id,
          recipient: email.recipient_email,
          type: email.email_type
        });

        processedCount++;
        console.log(`Processed email: ${email.email_type} to ${email.recipient_email}`);

      } catch (error) {
        console.error(`Failed to process email ${email.id}:`, error);

        const { error: retryError } = await supabase
          .from('email_queue')
          .update({
            retry_count: email.retry_count + 1,
            error_message: error.message,
            updated_at: new Date().toISOString(),
            status: email.retry_count >= 2 ? 'failed' : 'pending'
          })
          .eq('id', email.id);

        if (retryError) {
          console.error(`Error updating retry count for email ${email.id}:`, retryError);
        }

        errorCount++;
      }
    }

    console.log(`Email processing complete. Processed: ${processedCount}, Errors: ${errorCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} emails, ${errorCount} errors`,
        processedCount,
        errorCount,
        totalPending: pendingEmails?.length || 0,
        processedEmails
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in process-email-queue function:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
