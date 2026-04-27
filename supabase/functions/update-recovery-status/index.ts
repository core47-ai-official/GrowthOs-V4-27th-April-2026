import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateStatusRequest {
  recovery_message_id: string;
  status: 'sent' | 'failed';
  message_content?: string;
  meta_message_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: UpdateStatusRequest = await req.json();
    
    if (!body.recovery_message_id || !body.status) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: recovery_message_id and status are required' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    if (!['sent', 'failed'].includes(body.status)) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid status. Must be "sent" or "failed"' 
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('Updating recovery status:', {
      recovery_message_id: body.recovery_message_id,
      status: body.status
    });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if record exists
    const { data: existing, error: checkError } = await supabaseClient
      .from('student_recovery_messages')
      .select('id, user_id, message_status')
      .eq('id', body.recovery_message_id)
      .single();

    if (checkError || !existing) {
      console.error('Recovery record not found:', checkError);
      return new Response(
        JSON.stringify({ 
          error: 'Recovery record not found' 
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Build update object
    const updateData: any = {
      message_status: body.status,
      updated_at: new Date().toISOString()
    };

    if (body.message_content) {
      updateData.message_content = body.message_content;
    }

    // Update the record
    const { data, error } = await supabaseClient
      .from('student_recovery_messages')
      .update(updateData)
      .eq('id', body.recovery_message_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating recovery status:', error);
      throw error;
    }

    console.log('Successfully updated recovery status');

    return new Response(
      JSON.stringify({
        success: true,
        data,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in update-recovery-status:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
