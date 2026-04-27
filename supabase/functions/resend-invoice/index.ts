import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'
import { Resend } from "npm:resend@2.0.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getCurrencySymbol(curr: string = 'USD'): string {
  const symbols: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: 'Rs'
  };
  return symbols[curr] || curr;
}

function sanitizeEmail(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return match ? match[1].trim() : trimmed;
}

async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
  cc?: string;
}): Promise<void> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const rawFromEmail = Deno.env.get('SMTP_FROM_EMAIL');
  const fromEmail = rawFromEmail ? sanitizeEmail(rawFromEmail) : '';
  const fromName = Deno.env.get('SMTP_FROM_NAME') || 'Growth OS';

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }
  if (!fromEmail) {
    throw new Error('SMTP_FROM_EMAIL is required');
  }

  const resend = new Resend(resendApiKey);
  const payload: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    to: [options.to],
    subject: options.subject,
    html: options.html,
  };
  if (options.cc) payload.cc = [options.cc];

  const { error } = await resend.emails.send(payload as any);
  if (error) {
    throw new Error(`Resend API error: ${(error as any).message}`);
  }
}

function generateInvoiceEmailHtml(params: {
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  companyPhone: string;
  studentName: string;
  studentEmail: string;
  studentId: string;
  installmentNumber: number;
  amount: number;
  currency: string;
  currencySymbol: string;
  dueDate: string;
  enrollmentName: string;
  invoiceNumber: string;
  loginUrl: string;
  paymentMethodsHtml: string;
  penaltyType?: string;
  penaltyAmount?: number;
}): string {
  const invoiceAmount = parseFloat(String(params.amount));
  const formattedAmount = invoiceAmount.toLocaleString();
  const today = new Date().toLocaleDateString();

  // Calculate penalty info for display
  let penaltyValue = 0;
  if (params.penaltyType === 'fixed' && (params.penaltyAmount || 0) > 0) {
    penaltyValue = params.penaltyAmount!;
  } else if (params.penaltyType === 'percentage' && (params.penaltyAmount || 0) > 0) {
    penaltyValue = (invoiceAmount * params.penaltyAmount!) / 100;
  }
  const formattedAfterOverdue = (invoiceAmount + penaltyValue).toLocaleString();
  const formattedPenaltyVal = penaltyValue.toLocaleString();

  const overdueWarningHtml = penaltyValue > 0 ? `
    <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin-top: 15px;">
      <p style="margin: 0 0 5px 0; color: #991b1b; font-size: 13px; font-weight: bold;">⚠️ If not paid by due date:</p>
      <p style="margin: 0; color: #991b1b; font-size: 13px;">
        Penalty: ${params.currencySymbol}${formattedPenaltyVal} ${params.penaltyType === 'percentage' ? '(' + params.penaltyAmount + '%)' : '(fixed)'}
      </p>
      <p style="margin: 5px 0 0 0; color: #dc2626; font-size: 15px; font-weight: bold;">
        Amount after overdue: ${params.currencySymbol}${formattedAfterOverdue}
      </p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Invoice ${params.invoiceNumber}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px 40px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; font-weight: bold;">INVOICE</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${params.companyName}</p>
        </div>
        
        <!-- Content -->
        <div style="padding: 40px;">
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear ${params.studentName},</p>
          
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your installment invoice has been generated. Please find the details below:</p>
          
          <!-- Invoice Details -->
          <div style="background-color: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
              <div>
                <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">Invoice To:</h3>
                <p style="margin: 0; font-weight: bold; color: #111827;">${params.studentName}</p>
                <p style="margin: 5px 0 0 0; color: #6b7280;">${params.studentEmail}</p>
              </div>
              <div style="text-align: right;">
                <p style="margin: 0; color: #6b7280;">Invoice #: <strong>${params.invoiceNumber}</strong></p>
                <p style="margin: 5px 0; color: #6b7280;">Date: <strong>${today}</strong></p>
                <p style="margin: 5px 0; color: #6b7280;">Due Date: <strong>${params.dueDate}</strong></p>
              </div>
            </div>
            
            <!-- Amount Due -->
            <div style="background-color: white; border-radius: 6px; padding: 20px; text-align: center; border: 2px solid #2563eb;">
              <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">AMOUNT DUE</p>
              <p style="margin: 0; font-size: 36px; font-weight: bold; color: #2563eb;">${params.currencySymbol}${formattedAmount}</p>
            </div>
          </div>
          
          <!-- Course Details -->
          <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin: 0 0 15px 0; color: #374151;">Course Details:</h3>
            <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #374151;">Course Installment Payment #${params.installmentNumber}</span>
                <span style="font-weight: bold; color: #111827;">${params.currencySymbol}${formattedAmount}</span>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: #2563eb;">
              <span>Total Amount Due:</span>
              <span>${params.currencySymbol}${formattedAmount}</span>
            </div>
            ${overdueWarningHtml}
          </div>
          </div>
          
          <!-- Payment Methods -->
          ${params.paymentMethodsHtml ? `
          <div style="margin: 25px 0;">
            <h3 style="margin: 0 0 20px 0; color: #374151;">Payment Methods:</h3>
            ${params.paymentMethodsHtml}
          </div>
          ` : ''}
          
          <!-- Action Button -->
          <div style="text-align: center; margin: 30px 0;">
            <a href="${params.loginUrl}" style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold; display: inline-block;">
              Access Learning Platform
            </a>
          </div>
          
          <!-- Footer Notes -->
          <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="margin: 0 0 10px 0; color: #92400e;">Important Notes:</h4>
            <ul style="margin: 0; padding-left: 20px; color: #92400e;">
              <li>Payment is due by ${params.dueDate}</li>
              <li>Access to courses may be restricted for overdue payments</li>
              <li>Contact support if you have any payment-related questions</li>
            </ul>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">If you have any questions about this invoice or need assistance with payment, please contact our support team.</p>
          
          <p style="color: #374151; font-size: 16px; margin-top: 30px;">Best regards,<br><strong>${params.companyName} Team</strong></p>
        </div>
        
        <!-- Footer -->
        <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">${params.companyName}</p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">${params.companyAddress}</p>
          <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">Email: ${params.companyEmail} | Phone: ${params.companyPhone}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('SMTP_FROM_EMAIL');

    console.log('[resend-invoice] ENV check:', {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      hasResendApiKey: !!resendApiKey,
      hasFromEmail: !!fromEmail,
    });

    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!fromEmail) {
      return new Response(
        JSON.stringify({ error: 'SMTP_FROM_EMAIL is not configured. Add it to Edge Function secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const { student_ids } = await req.json();

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'student_ids array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company settings
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('currency, company_name, contact_email, address, primary_phone, payment_methods, billing_email_cc, overdue_penalty_type, overdue_penalty_amount')
      .eq('id', 1)
      .single();

    const currency = companySettings?.currency || 'USD';
    const currencySymbol = getCurrencySymbol(currency);
    const companyName = companySettings?.company_name || 'The Learning Team';
    const companyEmail = companySettings?.contact_email || 'support@company.com';
    const companyAddress = companySettings?.address || '';
    const companyPhone = companySettings?.primary_phone || '';
    const paymentMethods = (companySettings?.payment_methods as any[]) || [];
    const penaltyType = companySettings?.overdue_penalty_type || '';
    const penaltyAmount = companySettings?.overdue_penalty_amount || 0;

    // Generate payment methods HTML
    const paymentMethodsHtml = paymentMethods.filter((pm: any) => pm.enabled).map((method: any) => `
      <div style="border-left: 3px solid #2563eb; padding-left: 15px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #1e40af;">${method.name}</h4>
        ${Object.entries(method.details).map(([key, value]) => `
          <p style="margin: 5px 0; font-size: 14px;"><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}:</strong> ${value}</p>
        `).join('')}
      </div>
    `).join('');

    // Get site URL for login link
    const siteUrl = Deno.env.get('SITE_URL') || Deno.env.get('VITE_SITE_URL') || 'https://growthos.idmpakistan.pk';

    // Get student records for the user IDs
    const { data: students, error: studentsErr } = await supabaseAdmin
      .from('students')
      .select('id, user_id, student_id, users!inner(full_name, email)')
      .in('user_id', student_ids);

    if (studentsErr) throw studentsErr;
    if (!students || students.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No student records found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const studentRecordIds = students.map((s: any) => s.id);

    // Get all unpaid invoices for these students, ordered by installment_number desc
    const { data: invoices, error: invErr } = await supabaseAdmin
      .from('invoices')
      .select('id, student_id, installment_number, amount, due_date, extended_due_date, status, course_id, pathway_id')
      .in('student_id', studentRecordIds)
      .neq('status', 'paid')
      .neq('status', 'scheduled')
      .order('installment_number', { ascending: false });

    if (invErr) throw invErr;

    // Group by student_id and take the latest (highest installment_number) unpaid invoice per student
    const latestPerStudent = new Map<string, any>();
    for (const inv of invoices || []) {
      if (!latestPerStudent.has(inv.student_id)) {
        latestPerStudent.set(inv.student_id, inv);
      }
    }

    // Build student lookup
    const studentMap = new Map<string, any>();
    for (const s of students) {
      studentMap.set(s.id, s);
    }

    // Fetch course and pathway names
    const courseIds = [...new Set([...latestPerStudent.values()].map((i: any) => i.course_id).filter(Boolean))];
    const pathwayIds = [...new Set([...latestPerStudent.values()].map((i: any) => i.pathway_id).filter(Boolean))];

    const courseMap = new Map<string, string>();
    const pathwayMap = new Map<string, string>();

    if (courseIds.length) {
      const { data: courses } = await supabaseAdmin.from('courses').select('id, title').in('id', courseIds);
      (courses || []).forEach((c: any) => courseMap.set(c.id, c.title));
    }
    if (pathwayIds.length) {
      const { data: pathways } = await supabaseAdmin.from('learning_pathways').select('id, name').in('id', pathwayIds);
      (pathways || []).forEach((p: any) => pathwayMap.set(p.id, p.name));
    }

    const billingCc = companySettings?.billing_email_cc || Deno.env.get('BILLING_EMAIL_CC');
    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const [studentId, invoice] of latestPerStudent) {
      const student = studentMap.get(studentId);
      if (!student) continue;

      const studentEmail = (student as any).users.email;
      const studentName = (student as any).users.full_name;
      const studentDisplayId = (student as any).student_id || studentId;
      const dueDate = new Date(invoice.extended_due_date || invoice.due_date).toLocaleDateString();
      const enrollmentName = invoice.course_id
        ? courseMap.get(invoice.course_id) || 'Course'
        : invoice.pathway_id
          ? pathwayMap.get(invoice.pathway_id) || 'Pathway'
          : 'Enrollment';
      const invoiceNumber = `INV-${studentDisplayId}-${invoice.installment_number}`;

      try {
        const html = generateInvoiceEmailHtml({
          companyName,
          companyEmail,
          companyAddress,
          companyPhone,
          studentName,
          studentEmail,
          studentId: studentDisplayId,
          installmentNumber: invoice.installment_number,
          amount: invoice.amount,
          currency,
          currencySymbol,
          dueDate,
          enrollmentName,
          invoiceNumber,
          loginUrl: siteUrl,
          paymentMethodsHtml,
          penaltyType,
          penaltyAmount,
        });

        await sendEmail({
          to: studentEmail,
          subject: `Invoice ${invoiceNumber} - Installment #${invoice.installment_number} for ${enrollmentName} - Due ${dueDate}`,
          html,
          ...(billingCc ? { cc: billingCc } : {}),
        });

        console.log(`[Resend] Sent invoice ${invoiceNumber} to ${studentEmail}, CC: ${billingCc || 'none'}`);
        sentCount++;
      } catch (emailError: any) {
        console.error(`[Resend FAILED] ${studentEmail}: ${emailError.message}`);
        errors.push(`${studentEmail}: ${emailError.message}`);
        failedCount++;
      }
    }

    const noInvoiceCount = students.length - latestPerStudent.size;

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        no_unpaid_invoice: noInvoiceCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Resent ${sentCount} invoice(s). ${failedCount} failed. ${noInvoiceCount} student(s) had no unpaid invoices.`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in resend-invoice:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to resend invoices', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
