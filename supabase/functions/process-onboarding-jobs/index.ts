import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.55.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing onboarding jobs...');

    // Get pending onboarding jobs (students who haven't completed onboarding)
    const { data: pendingStudents, error: fetchError } = await supabase
      .from('students')
      .select(`
        id,
        user_id,
        onboarding_completed,
        created_at,
        users!inner(
          id,
          email,
          full_name,
          status,
          lms_status
        )
      `)
      .eq('onboarding_completed', false)
      .eq('users.status', 'active')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching pending students:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${pendingStudents?.length || 0} students with pending onboarding`);

    let processedCount = 0;
    const processedStudents = [];

    // Process each student
    for (const student of pendingStudents || []) {
      try {
        // Check if student has completed questionnaire responses
        const { data: responses, error: responseError } = await supabase
          .from('onboarding_responses')
          .select('id')
          .eq('user_id', student.user_id);

        if (responseError) {
          console.error(`Error checking responses for student ${student.id}:`, responseError);
          continue;
        }

        // If student has responses, we can process their onboarding
        if (responses && responses.length > 0) {
          // Create notification for admins about completed onboarding
          const { error: notificationError } = await supabase
            .from('notifications')
            .insert({
              type: 'onboarding_completed',
              channel: 'system',
              status: 'sent',
              sent_at: new Date().toISOString(),
              payload: {
                title: 'Student Onboarding Completed',
                message: `${student.users.full_name} has completed their onboarding questionnaire`,
                student_id: student.id,
                user_id: student.user_id
              },
              user_id: student.user_id
            });

          if (notificationError) {
            console.error(`Error creating notification for student ${student.id}:`, notificationError);
          }

          processedStudents.push({
            id: student.id,
            name: student.users.full_name,
            email: student.users.email,
            responses_count: responses.length
          });
          
          processedCount++;
          console.log(`Processed onboarding for student: ${student.users.full_name}`);
        }
      } catch (error) {
        console.error(`Failed to process student ${student.id}:`, error);
      }
    }

    console.log(`Onboarding processing complete. Processed ${processedCount} students.`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${processedCount} onboarding jobs`,
        processedCount,
        totalPending: pendingStudents?.length || 0,
        processedStudents
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in process-onboarding-jobs function:', error);
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