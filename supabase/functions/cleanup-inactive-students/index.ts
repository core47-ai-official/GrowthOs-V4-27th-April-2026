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
    console.log('Starting cleanup of inactive students...');

    // Calculate the date 2 weeks ago
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Find students who:
    // 1. Have LMS status 'inactive'
    // 2. Were created more than 2 weeks ago
    // 3. Have not made their first payment (no installment payments)
    const { data: inactiveStudents, error: fetchError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        email,
        created_at,
        lms_status
      `)
      .eq('role', 'student')
      .eq('lms_status', 'inactive')
      .lt('created_at', twoWeeksAgo.toISOString());

    if (fetchError) {
      console.error('Error fetching inactive students:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${inactiveStudents?.length || 0} potentially inactive students`);

    // Filter out students who have made at least one payment or have a valid extension
    const studentsToSuspend = [];
    
    for (const student of inactiveStudents || []) {
      // Check for payments
      const { data: payments, error: paymentError } = await supabase
        .from('installment_payments')
        .select('id')
        .eq('user_id', student.id)
        .limit(1);

      if (paymentError) {
        console.error(`Error checking payments for student ${student.id}:`, paymentError);
        continue;
      }

      // If payments found, skip this student
      if (payments && payments.length > 0) {
        console.log(`Student ${student.id} has payments, skipping`);
        continue;
      }

      // Get student record to find student_id for invoice check
      const { data: studentRecord } = await supabase
        .from('students')
        .select('id')
        .eq('user_id', student.id)
        .single();

      if (studentRecord) {
        // Check for invoices with valid extensions (extended_due_date in the future)
        const { data: invoicesWithExtension, error: invoiceError } = await supabase
          .from('invoices')
          .select('id, extended_due_date, due_date, installment_number')
          .eq('student_id', studentRecord.id)
          .eq('installment_number', 1) // First installment
          .not('status', 'eq', 'paid');

        if (invoiceError) {
          console.error(`Error checking invoices for student ${student.id}:`, invoiceError);
          continue;
        }

        // Check if there's an active extension
        const hasValidExtension = invoicesWithExtension?.some(invoice => {
          if (invoice.extended_due_date) {
            const extendedDate = new Date(invoice.extended_due_date);
            return extendedDate > today;
          }
          return false;
        });

        if (hasValidExtension) {
          console.log(`Student ${student.id} has valid fee extension, skipping`);
          continue;
        }

        // Check if the first invoice's effective due date (with extension) + 2 weeks has passed
        const firstInvoice = invoicesWithExtension?.find(inv => inv.installment_number === 1);
        if (firstInvoice) {
          const effectiveDueDate = new Date(firstInvoice.extended_due_date || firstInvoice.due_date);
          const suspensionThreshold = new Date(effectiveDueDate);
          suspensionThreshold.setDate(suspensionThreshold.getDate() + 14); // 2 weeks after due date

          if (today < suspensionThreshold) {
            console.log(`Student ${student.id} not past suspension threshold yet, skipping`);
            continue;
          }
        }
      }

      // Mark for suspension (NOT deletion — enrollments must be preserved)
      studentsToSuspend.push(student);
    }

    console.log(`${studentsToSuspend.length} students will be suspended`);

    let suspendedCount = 0;
    const suspendedStudents = [];

    // Suspend students instead of deleting them
    for (const student of studentsToSuspend) {
      try {
        // Log the action before it happens
        await supabase.from('admin_logs').insert({
          entity_type: 'user',
          entity_id: student.id,
          action: 'auto_suspended',
          description: `Student auto-suspended: inactive + unpaid first fee for 2+ weeks (enrollment preserved)`,
          data: {
            full_name: student.full_name,
            email: student.email,
            created_at: student.created_at,
            lms_status: student.lms_status
          }
        });

        // Suspend LMS access instead of deleting the user
        const { error: suspendError } = await supabase
          .from('users')
          .update({ 
            lms_status: 'suspended',
            updated_at: new Date().toISOString()
          })
          .eq('id', student.id);

        if (suspendError) {
          console.error(`Error suspending student ${student.id}:`, suspendError);
          continue;
        }

        // Send notification
        await supabase.from('notifications').insert({
          user_id: student.id,
          title: '⚠️ Account Suspended',
          message: 'Your account has been suspended due to inactivity and unpaid fees. Please contact support to restore access.',
          type: 'warning',
          is_read: false
        });

        suspendedStudents.push({
          id: student.id,
          name: student.full_name,
          email: student.email
        });
        
        suspendedCount++;
        console.log(`Suspended student: ${student.full_name} (${student.email})`);
      } catch (error) {
        console.error(`Failed to suspend student ${student.id}:`, error);
      }
    }

    console.log(`Cleanup complete. Suspended ${suspendedCount} inactive students (enrollments preserved).`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup complete. Suspended ${suspendedCount} inactive students (enrollments preserved).`,
        suspendedCount,
        suspendedStudents
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );

  } catch (error: any) {
    console.error('Error in cleanup function:', error);
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
