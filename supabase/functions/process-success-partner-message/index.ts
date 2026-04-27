import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BusinessContext {
  shopify?: any;
  metaAds?: any;
  currency?: string;
  dateRangeDays?: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      message, 
      conversationHistory, 
      businessContext,
      studentName,
      dateRangeDays 
    } = await req.json();

    if (!message || !message.trim()) {
      return new Response(
        JSON.stringify({ error: 'Message is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[SUCCESS PARTNER] Processing message for user:', user.id, 'Message length:', message.trim().length);

    // Save user message first
    const { data: insertedMessage, error: userMsgError } = await supabaseClient
      .from('success_partner_messages')
      .insert({
        user_id: user.id,
        role: 'user',
        content: message.trim(),
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
      })
      .select('*')
      .single();

    if (userMsgError) {
      console.error('[SUCCESS PARTNER] Failed to save user message:', userMsgError);
    } else {
      console.log('[SUCCESS PARTNER] User message saved to database');
    }

    // Removed aggressive duplicate detection - now relying on frontend to prevent double-sends
    // The previous logic was blocking legitimate messages with same content within 3s window
    console.log('[SUCCESS PARTNER] Message saved, proceeding to webhook call...');
    
    console.log('[SUCCESS PARTNER] Starting background processing...');

    // Start background processing with enhanced error handling
    const processInBackground = async () => {
      const MAX_RETRIES = 2;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          console.log(`[SUCCESS PARTNER] Processing attempt ${attempt + 1}/${MAX_RETRIES + 1}...`);
          
          const webhookUrl = Deno.env.get('SUCCESS_PARTNER_WEBHOOK_URL');
          if (!webhookUrl) {
            console.error('[SUCCESS PARTNER] ERROR: SUCCESS_PARTNER_WEBHOOK_URL not configured');
            throw new Error('SUCCESS_PARTNER_WEBHOOK_URL not configured');
          }
          
          console.log('[SUCCESS PARTNER] Webhook URL configured, length:', webhookUrl.length);

          // Validate input data
          if (!message || typeof message !== 'string') {
            throw new Error('Invalid message format');
          }

          const payload = {
            message: message.trim(),
            studentId: user.id,
            studentName: studentName || user.email?.split('@')[0] || 'Student',
            timestamp: new Date().toISOString(),
            conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
            businessContext: typeof businessContext === 'object' ? businessContext : {}
          };

          console.log('[SUCCESS PARTNER] Calling webhook, payload size:', JSON.stringify(payload).length, 'bytes');

          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.error('[SUCCESS PARTNER] Webhook timeout after 55s');
            controller.abort();
          }, 55000); // 55s timeout

          console.log('[SUCCESS PARTNER] Sending request to webhook...');
          const startTime = Date.now();
          
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Supabase-Edge-Function/1.0'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          console.log('[SUCCESS PARTNER] Webhook responded in', duration, 'ms with status:', response.status);

          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[SUCCESS PARTNER] Webhook error:', response.status, errorText);
            throw new Error(`Webhook error ${response.status}: ${errorText}`);
          }

          const responseText = await response.text();
          console.log('[SUCCESS PARTNER] Raw webhook response:', responseText.substring(0, 200));
          
          const data = JSON.parse(responseText);
          console.log('[SUCCESS PARTNER] Parsed response type:', typeof data, 'Keys:', Object.keys(data || {}));

          // Enhanced AI response parsing with validation
          let aiResponse = "";
          
          if (!data) {
            throw new Error('Empty webhook response');
          }

          if (typeof data === 'object') {
            // Try different response formats
            if (data.reply) {
              if (Array.isArray(data.reply) && data.reply.length > 0) {
                const firstReply = data.reply[0];
                aiResponse = firstReply?.output || firstReply?.message || firstReply?.content || String(firstReply);
              } else if (typeof data.reply === 'object') {
                aiResponse = data.reply.output || data.reply.message || data.reply.content || String(data.reply);
              } else if (typeof data.reply === 'string') {
                aiResponse = data.reply;
              }
            } else if (data.output) {
              aiResponse = String(data.output);
            } else if (data.message) {
              aiResponse = data.message;
            } else if (data.text || data.content) {
              aiResponse = data.text || data.content;
            } else {
              // Fallback: stringify the whole response
              aiResponse = JSON.stringify(data);
            }
          } else if (typeof data === 'string') {
            aiResponse = data;
          }

          // Final validation
          aiResponse = String(aiResponse).trim();
          if (!aiResponse || aiResponse === 'undefined' || aiResponse === 'null' || aiResponse === '{}') {
            console.error('[SUCCESS PARTNER] Invalid AI response after parsing:', aiResponse);
            throw new Error('Invalid AI response format - empty or invalid content');
          }

          console.log('[SUCCESS PARTNER] Parsed AI response length:', aiResponse.length, 'First 100 chars:', aiResponse.substring(0, 100));

          // Save AI response to database
          const { error: insertError } = await supabaseClient
            .from('success_partner_messages')
            .insert({
              user_id: user.id,
              role: 'assistant',
              content: aiResponse,
              timestamp: new Date().toISOString(),
              date: new Date().toISOString().split('T')[0]
            });

          if (insertError) {
            console.error('Failed to save AI response:', insertError);
            throw insertError;
          }

          console.log('[SUCCESS PARTNER] AI response saved successfully to database');

          // Update credits
          try {
            const today = new Date().toISOString().split('T')[0];
            const { data: creditData, error: creditFetchError } = await supabaseClient
              .from('success_partner_credits')
              .select('*')
              .eq('user_id', user.id)
              .eq('date', today)
              .single();

            if (creditFetchError && creditFetchError.code !== 'PGRST116') {
              console.error('Error fetching credits:', creditFetchError);
            } else if (creditData) {
              const { error: updateError } = await supabaseClient
                .from('success_partner_credits')
                .update({ credits_used: creditData.credits_used + 1 })
                .eq('id', creditData.id);

              if (updateError) {
                console.error('Error updating credits:', updateError);
              } else {
                console.log('Credits updated successfully');
              }
            }
          } catch (creditError) {
            console.error('Credit update failed:', creditError);
            // Don't fail the whole operation if credit update fails
          }

          // Success - break retry loop
          console.log('[SUCCESS PARTNER] ✅ Message processing completed successfully');
          return;

        } catch (error) {
          lastError = error as Error;
          console.error(`[SUCCESS PARTNER] ❌ Attempt ${attempt + 1} failed:`, error.message);
          console.error('[SUCCESS PARTNER] Error stack:', error.stack);
          
          // If this was the last attempt, save error message
          if (attempt === MAX_RETRIES) {
            console.error('[SUCCESS PARTNER] All retry attempts exhausted');
            break;
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = 1000 * (attempt + 1);
          console.log(`[SUCCESS PARTNER] Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // All attempts failed - save error message to database
      console.error('[SUCCESS PARTNER] Background processing FAILED after all retries:', lastError?.message);
      console.error('[SUCCESS PARTNER] Last error stack:', lastError?.stack);
      
      try {
        const errorMessage = lastError?.message?.includes('timeout') 
          ? "⚠️ The AI service is taking too long to respond. Please try again in a moment."
          : lastError?.message?.includes('not configured')
          ? "⚠️ The AI service is not properly configured. Please contact support."
          : "⚠️ I'm having trouble connecting to my services right now. Please try asking again in a moment.";
          
        await supabaseClient
          .from('success_partner_messages')
          .insert({
            user_id: user.id,
            role: 'assistant',
            content: errorMessage,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().split('T')[0]
          });
        console.log('[SUCCESS PARTNER] Fallback error message saved to database');
      } catch (fallbackError) {
        console.error('[SUCCESS PARTNER] Failed to save fallback message:', fallbackError);
      }
    };

    // Start processing in background
    EdgeRuntime.waitUntil(processInBackground());

    // Return immediately to client
    return new Response(
      JSON.stringify({ 
        status: 'processing', 
        message: 'Your message is being processed. The response will appear shortly.' 
      }),
      { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Request handling error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
