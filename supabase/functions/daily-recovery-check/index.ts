import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting daily recovery check...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Step 1: Get all currently tracked students (pending or sent status)
    const { data: trackedStudents, error: trackedError } = await supabaseClient
      .rpc('get_tracked_inactive_students');

    if (trackedError) {
      console.error('Error fetching tracked students:', trackedError);
      throw trackedError;
    }

    console.log(`Found ${trackedStudents?.length || 0} tracked students to check`);

    let recovered = 0;
    let stillInactive = 0;

    // Step 2: Check each tracked student to see if they've logged in
    for (const student of trackedStudents || []) {
      const { data: hasLoggedIn, error: loginError } = await supabaseClient
        .rpc('has_student_logged_in_since', {
          p_user_id: student.user_id,
          p_since_date: student.message_sent_at
        });

      if (loginError) {
        console.error(`Error checking login for student ${student.user_id}:`, loginError);
        continue;
      }

      if (hasLoggedIn) {
        // Student has logged in! Mark as recovered
        console.log(`Student ${student.full_name} has logged in - marking as recovered`);
        await supabaseClient.rpc('mark_student_recovered', {
          p_recovery_message_id: student.recovery_message_id
        });
        recovered++;
      } else {
        // Still inactive, update last check date
        console.log(`Student ${student.full_name} still inactive - updating check date`);
        await supabaseClient
          .from('student_recovery_messages')
          .update({
            last_check_date: new Date().toISOString().split('T')[0],
            last_login_check: new Date().toISOString()
          })
          .eq('id', student.recovery_message_id);
        stillInactive++;
      }
    }

    // Step 3: Find NEW inactive students (not currently tracked)
    const { data: inactiveStudents, error: inactiveError } = await supabaseClient
      .rpc('get_inactive_students', { days_threshold: 3 });

    if (inactiveError) {
      console.error('Error fetching inactive students:', inactiveError);
      throw inactiveError;
    }

    console.log(`Found ${inactiveStudents?.length || 0} inactive students`);

    let newlyTracked = 0;

    // Step 4: Create records for newly inactive students
    for (const student of inactiveStudents || []) {
      // Check if this student is already being tracked
      const { data: existing, error: existingError } = await supabaseClient
        .from('student_recovery_messages')
        .select('id, recovery_cycle, message_status')
        .eq('user_id', student.user_id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (existingError) {
        console.error(`Error checking existing record for ${student.user_id}:`, existingError);
        continue;
      }

      // Only create new record if:
      // - No existing record, OR
      // - Latest record is 'recovered' (student went inactive again)
      if (!existing || existing.length === 0 || existing[0].message_status === 'recovered') {
        const nextCycle = existing && existing.length > 0 ? (existing[0].recovery_cycle + 1) : 1;
        console.log(`Creating recovery record for ${student.full_name} (cycle ${nextCycle})`);
        
        await supabaseClient.rpc('create_recovery_record', {
          p_user_id: student.user_id,
          p_days_inactive: student.days_inactive,
          p_recovery_cycle: nextCycle
        });
        newlyTracked++;
      }
    }

    // Step 5: Log summary to database
    const { error: logError } = await supabaseClient
      .from('student_recovery_checks')
      .insert({
        check_date: new Date().toISOString().split('T')[0],
        students_checked: trackedStudents?.length || 0,
        newly_inactive: newlyTracked,
        recovered: recovered,
        still_inactive: stillInactive,
        check_completed_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging check summary:', logError);
    }

    const summary = {
      checked: trackedStudents?.length || 0,
      recovered,
      stillInactive,
      newlyTracked
    };

    console.log('Daily recovery check completed:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in daily recovery check:', error);
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
