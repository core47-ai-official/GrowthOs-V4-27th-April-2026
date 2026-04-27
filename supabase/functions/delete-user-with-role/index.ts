import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    
    // Verify the caller's token
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) {
      console.error('Authorization failed:', authError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { target_user_id } = await req.json()

    if (!target_user_id) {
      console.error('Missing target_user_id')
      return new Response(
        JSON.stringify({ error: 'Missing required field: target_user_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Starting deletion process for user:', target_user_id)

    // Get user info before deletion for logging and verification
    const { data: userToDelete, error: userFetchError } = await supabaseClient
      .from('users')
      .select('role, full_name, email')
      .eq('id', target_user_id)
      .single()

    if (userFetchError || !userToDelete) {
      console.error('User not found in public.users:', userFetchError)
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Found user to delete:', { 
      id: target_user_id, 
      email: userToDelete.email, 
      role: userToDelete.role 
    })

    // Check if user exists in auth.users before attempting deletion
    const { data: authUser, error: authCheckError } = await supabaseClient.auth.admin.getUserById(target_user_id)
    
    if (authCheckError || !authUser.user) {
      console.error('User not found in auth.users:', authCheckError)
      return new Response(
        JSON.stringify({ error: 'User not found in authentication system' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User found in auth.users, proceeding with cascade deletion of related records...')

    // **PHASE 1: Delete all related records in proper order BEFORE deleting auth user**
    const deletionSteps: string[] = []

    try {
      // Step 1: Get student record ID for invoice cleanup
      const { data: studentRecord } = await supabaseClient
        .from('students')
        .select('id')
        .eq('user_id', target_user_id)
        .maybeSingle()

      const studentId = studentRecord?.id
      deletionSteps.push(`Found student record: ${studentId || 'none'}`)

      // Step 2: Delete invoices (via student_id)
      if (studentId) {
        const { error: invoicesError } = await supabaseClient
          .from('invoices')
          .delete()
          .eq('student_id', studentId)
        if (invoicesError) throw new Error(`Failed to delete invoices: ${invoicesError.message}`)
        deletionSteps.push('✓ Deleted invoices')
      }

      // Step 2b: Delete installment_payments (via user_id)
      const { error: installmentsError } = await supabaseClient
        .from('installment_payments')
        .delete()
        .eq('user_id', target_user_id)
      if (installmentsError) throw new Error(`Failed to delete installment payments: ${installmentsError.message}`)
      deletionSteps.push('✓ Deleted installment_payments')

      // Step 3: Delete submissions (references user_id directly via student_id)
      const { error: submissionsError } = await supabaseClient
        .from('submissions')
        .delete()
        .eq('student_id', target_user_id)
      if (submissionsError) throw new Error(`Failed to delete submissions: ${submissionsError.message}`)
      deletionSteps.push('✓ Deleted submissions')

      // Step 4: Delete student record
      if (studentId) {
        const { error: studentError } = await supabaseClient
          .from('students')
          .delete()
          .eq('user_id', target_user_id)
        if (studentError) throw new Error(`Failed to delete student record: ${studentError.message}`)
        deletionSteps.push('✓ Deleted student record')
      }

      // Step 5: Delete user_activity_logs
      const { error: activityLogsError } = await supabaseClient
        .from('user_activity_logs')
        .delete()
        .eq('user_id', target_user_id)
      if (activityLogsError) throw new Error(`Failed to delete activity logs: ${activityLogsError.message}`)
      deletionSteps.push('✓ Deleted user_activity_logs')

      // Step 6: Delete user_badges
      const { error: badgesError } = await supabaseClient
        .from('user_badges')
        .delete()
        .eq('user_id', target_user_id)
      if (badgesError) throw new Error(`Failed to delete user badges: ${badgesError.message}`)
      deletionSteps.push('✓ Deleted user_badges')

      // Step 7: Delete user_unlocks
      const { error: unlocksError } = await supabaseClient
        .from('user_unlocks')
        .delete()
        .eq('user_id', target_user_id)
      if (unlocksError) throw new Error(`Failed to delete user unlocks: ${unlocksError.message}`)
      deletionSteps.push('✓ Deleted user_unlocks')

      // Step 8: Delete recording_views
      const { error: viewsError } = await supabaseClient
        .from('recording_views')
        .delete()
        .eq('user_id', target_user_id)
      if (viewsError) throw new Error(`Failed to delete recording views: ${viewsError.message}`)
      deletionSteps.push('✓ Deleted recording_views')

      // Step 9: Delete notifications
      const { error: notificationsError } = await supabaseClient
        .from('notifications')
        .delete()
        .eq('user_id', target_user_id)
      if (notificationsError) throw new Error(`Failed to delete notifications: ${notificationsError.message}`)
      deletionSteps.push('✓ Deleted notifications')

      // Step 10: Delete support_ticket_replies
      const { error: repliesError } = await supabaseClient
        .from('support_ticket_replies')
        .delete()
        .eq('user_id', target_user_id)
      if (repliesError) throw new Error(`Failed to delete support ticket replies: ${repliesError.message}`)
      deletionSteps.push('✓ Deleted support_ticket_replies')

      // Step 11: Delete support_tickets
      const { error: ticketsError } = await supabaseClient
        .from('support_tickets')
        .delete()
        .eq('user_id', target_user_id)
      if (ticketsError) throw new Error(`Failed to delete support tickets: ${ticketsError.message}`)
      deletionSteps.push('✓ Deleted support_tickets')

      // Step 12: Delete email_queue
      const { error: emailQueueError } = await supabaseClient
        .from('email_queue')
        .delete()
        .eq('user_id', target_user_id)
      if (emailQueueError) throw new Error(`Failed to delete email queue: ${emailQueueError.message}`)
      deletionSteps.push('✓ Deleted email_queue')

      // Step 13: Delete admin_logs where this user was the performer
      const { error: adminLogsError } = await supabaseClient
        .from('admin_logs')
        .delete()
        .eq('performed_by', target_user_id)
      if (adminLogsError) throw new Error(`Failed to delete admin logs: ${adminLogsError.message}`)
      deletionSteps.push('✓ Deleted admin_logs (performed_by)')

      // Step 14: Delete user_roles (CRITICAL for security)
      const { error: userRolesError } = await supabaseClient
        .from('user_roles')
        .delete()
        .eq('user_id', target_user_id)
      if (userRolesError) throw new Error(`Failed to delete user_roles: ${userRolesError.message}`)
      deletionSteps.push('✓ Deleted user_roles')

      // Step 15: Delete public.users profile
      const { error: publicUserError } = await supabaseClient
        .from('users')
        .delete()
        .eq('id', target_user_id)
      if (publicUserError) throw new Error(`Failed to delete public.users: ${publicUserError.message}`)
      deletionSteps.push('✓ Deleted public.users profile')

      console.log('All related records deleted successfully:', deletionSteps)

      // **PHASE 2: Now delete from auth.users as the final step**
      console.log('Deleting user from auth.users...')
      const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(target_user_id)

      if (authDeleteError) {
        console.error('Failed to delete auth user after cleaning up related records:', authDeleteError)
        throw new Error(`Failed to delete auth user: ${authDeleteError.message}`)
      }

      deletionSteps.push('✓ Deleted auth.users record')
      console.log('Auth user deleted successfully')

      // Verify auth deletion
      const { data: verifyAuthUser, error: verifyAuthError } = await supabaseClient.auth.admin.getUserById(target_user_id)
      
      if (!verifyAuthError && verifyAuthUser.user) {
        console.error('Auth user still exists after deletion attempt!')
        throw new Error('Auth user deletion verification failed - user still exists')
      }

      deletionSteps.push('✓ Verified auth user deletion')
      console.log('User deletion completed successfully - all records removed')

    } catch (cascadeError: any) {
      console.error('Cascading deletion failed:', cascadeError)
      console.error('Deletion steps completed:', deletionSteps)
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed during cascading deletion',
          message: cascadeError.message,
          completed_steps: deletionSteps,
          failed_at: cascadeError.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User successfully deleted from all systems',
        deleted_user: {
          id: target_user_id,
          email: userToDelete.email,
          role: userToDelete.role
        },
        deletion_steps: deletionSteps
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})