import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[check-access-expiry] Starting access expiry check...');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();

    // Find enrollments where access has expired but status is still active
    const { data: expiredEnrollments, error: fetchError } = await supabase
      .from('course_enrollments')
      .select('id, student_id, course_id, access_expires_at, students!inner(user_id)')
      .lt('access_expires_at', now)
      .eq('status', 'active');

    if (fetchError) {
      console.error('[check-access-expiry] Error fetching expired enrollments:', fetchError);
      throw fetchError;
    }

    console.log(`[check-access-expiry] Found ${expiredEnrollments?.length || 0} expired enrollments`);

    if (!expiredEnrollments || expiredEnrollments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No expired enrollments found',
          processed: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // IMPORTANT: Do NOT change enrollment status automatically.
    // Only suspend LMS access so the student can't access content,
    // but keep the enrollment record intact for admin to manage manually.
    const affectedUserIds = [...new Set(expiredEnrollments.map(e => (e.students as any).user_id))];

    for (const userId of affectedUserIds) {
      const { error: suspendError } = await supabase
        .from('users')
        .update({ lms_status: 'suspended', updated_at: now })
        .eq('id', userId);

      if (suspendError) {
        console.error(`[check-access-expiry] Error suspending LMS for user ${userId}:`, suspendError);
      } else {
        console.log(`[check-access-expiry] Suspended LMS access for user ${userId}`);
      }

      // Log the suspension
      await supabase.from('admin_logs').insert({
        entity_type: 'user',
        entity_id: userId,
        action: 'lms_suspended',
        description: 'LMS suspended due to expired access duration (enrollment preserved)',
        data: { reason: 'access_expiry', checked_at: now }
      });
    }

    // Create notifications for affected students
    const notifications = expiredEnrollments.map(enrollment => ({
      user_id: (enrollment.students as any).user_id,
      type: 'access_expired',
      channel: 'in_app',
      status: 'sent',
      payload: {
        title: 'Course Access Expired',
        message: 'Your course access period has ended. Your LMS access has been suspended. Please contact support to renew.',
        metadata: {
          course_id: enrollment.course_id,
          expired_at: enrollment.access_expires_at
        }
      }
    }));

    if (notifications.length > 0) {
      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);
      
      if (notifError) {
        console.warn('[check-access-expiry] Error creating notifications (non-critical):', notifError);
      } else {
        console.log(`[check-access-expiry] Created ${notifications.length} notifications`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Suspended LMS for ${affectedUserIds.length} users with ${expiredEnrollments.length} expired enrollments (enrollments preserved)`,
        processed: expiredEnrollments.length,
        usersSuspended: affectedUserIds.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[check-access-expiry] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
