import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller role (only superadmin/admin can reset other users)
    const { data: caller, error: callerErr } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerErr) {
      console.error('Role fetch error:', callerErr);
      return new Response(JSON.stringify({ error: 'Failed to verify role' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!['superadmin', 'admin'].includes(caller.role)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const target_user_id: string | undefined = body.target_user_id;
    const date: string = body.date || new Date().toISOString().split('T')[0];

    if (!target_user_id) {
      return new Response(JSON.stringify({ error: 'target_user_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Resetting SP credits for ${target_user_id} on ${date} by ${user.id}`);

    // Try to fetch existing record
    const { data: creditRecord, error: selectErr } = await supabase
      .from('success_partner_credits')
      .select('*')
      .eq('user_id', target_user_id)
      .eq('date', date)
      .maybeSingle();

    if (selectErr) {
      console.error('Select error:', selectErr);
      return new Response(JSON.stringify({ error: 'Failed to fetch credits' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const defaultDailyLimit = 10;

    if (!creditRecord) {
      const { data: inserted, error: insertErr } = await supabase
        .from('success_partner_credits')
        .insert({
          user_id: target_user_id,
          date,
          credits_used: 0,
          daily_limit: defaultDailyLimit,
        })
        .select()
        .single();

      if (insertErr) {
        console.error('Insert error:', insertErr);
        return new Response(JSON.stringify({ error: 'Failed to initialize credits' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, record: inserted }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('success_partner_credits')
      .update({ credits_used: 0 })
      .eq('user_id', target_user_id)
      .eq('date', date)
      .select()
      .single();

    if (updateErr) {
      console.error('Update error:', updateErr);
      return new Response(JSON.stringify({ error: 'Failed to reset credits' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, record: updated }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Unexpected error in admin-reset-sp-credits:', e);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});