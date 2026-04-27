import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreditsResponse {
  credits_used: number;
  daily_limit: number;
  credits_remaining: number;
  can_send_message: boolean;
  date: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's JWT
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
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const defaultDailyLimit = 10;

    if (req.method === 'GET') {
      // Get current credit status
      const { data: creditRecord, error } = await supabaseClient
        .from('success_partner_credits')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error fetching credits:', error);
        return new Response(JSON.stringify({ error: 'Failed to fetch credits' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // If no record exists for today, create one
      if (!creditRecord) {
        const { data: newRecord, error: insertError } = await supabaseClient
          .from('success_partner_credits')
          .insert({
            user_id: user.id,
            date: today,
            credits_used: 0,
            daily_limit: defaultDailyLimit,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error creating credit record:', insertError);
          return new Response(JSON.stringify({ error: 'Failed to initialize credits' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const response: CreditsResponse = {
          credits_used: 0,
          daily_limit: defaultDailyLimit,
          credits_remaining: defaultDailyLimit,
          can_send_message: true,
          date: today,
        };

        return new Response(JSON.stringify(response), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response: CreditsResponse = {
        credits_used: creditRecord.credits_used,
        daily_limit: creditRecord.daily_limit,
        credits_remaining: creditRecord.daily_limit - creditRecord.credits_used,
        can_send_message: creditRecord.credits_used < creditRecord.daily_limit,
        date: today,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method === 'POST') {
      // Increment credit usage (called after successful AI response)
      const { data: creditRecord, error: fetchError } = await supabaseClient
        .from('success_partner_credits')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .single();

      if (fetchError) {
        console.error('Error fetching credits for increment:', fetchError);
        return new Response(JSON.stringify({ error: 'Failed to fetch credits' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Check if user can send message
      if (creditRecord.credits_used >= creditRecord.daily_limit) {
        return new Response(JSON.stringify({ error: 'Daily credit limit reached' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Increment credits_used
      const { data: updatedRecord, error: updateError } = await supabaseClient
        .from('success_partner_credits')
        .update({ credits_used: creditRecord.credits_used + 1 })
        .eq('user_id', user.id)
        .eq('date', today)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating credits:', updateError);
        return new Response(JSON.stringify({ error: 'Failed to update credits' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const response: CreditsResponse = {
        credits_used: updatedRecord.credits_used,
        daily_limit: updatedRecord.daily_limit,
        credits_remaining: updatedRecord.daily_limit - updatedRecord.credits_used,
        can_send_message: updatedRecord.credits_used < updatedRecord.daily_limit,
        date: today,
      };

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error in success-partner-credits function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});