import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { SMTPClient } from '../_shared/smtp-client.ts';
// Note: PDF generation removed to avoid Deno file system restrictions

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateEnhancedStudentRequest {
  email: string;
  full_name: string;
  phone: string;
  installment_count: number;
  course_id?: string;
  pathway_id?: string;
  batch_id?: string;
  total_fee_amount?: number;
  discount_amount?: number;
  discount_percentage?: number;
  // Access control overrides
  drip_override?: boolean;
  drip_enabled?: boolean;
  sequential_override?: boolean;
  sequential_enabled?: boolean;
}

interface CreateEnhancedStudentResponse {
  success: boolean;
  data?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    student_id: string;
    lms_credentials: {
      lms_user_id: string;
      lms_password: string;
    };
    generated_password: string;
    created_at: string;
  };
  email_sent?: boolean;
  email_error?: string;
  error?: string;
}

interface CompanyDetails {
  company_name: string;
  address: string;
  contact_email: string;
  primary_phone: string;
}

function generateSecurePassword(): string {
  const length = 12;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return password;
}

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Enhanced student creation started');

    // Email secret diagnostic logging (values not logged for security)
    const emailDiag = {
      RESEND_API_KEY: Deno.env.get('RESEND_API_KEY') ? 'configured' : 'not set',
      SMTP_FROM_EMAIL: Deno.env.get('SMTP_FROM_EMAIL') ? 'configured' : 'not set',
      SMTP_FROM_NAME: Deno.env.get('SMTP_FROM_NAME') ? 'configured' : 'not set',
      SMTP_HOST: Deno.env.get('SMTP_HOST') ? 'configured' : 'not set',
      SMTP_USER: Deno.env.get('SMTP_USER') ? 'configured' : 'not set',
      provider: Deno.env.get('RESEND_API_KEY') ? 'resend' : (Deno.env.get('SMTP_HOST') ? 'smtp' : 'none'),
    };
    console.log('Email config check:', JSON.stringify(emailDiag));

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse request body
    const { 
      email, 
      full_name, 
      phone, 
      installment_count,
      course_id,
      pathway_id,
      batch_id,
      total_fee_amount,
      discount_amount = 0,
      discount_percentage = 0,
      drip_override = false,
      drip_enabled,
      sequential_override = false,
      sequential_enabled
    }: CreateEnhancedStudentRequest = await req.json();
    console.log('Request data:', { email, full_name, phone, installment_count, course_id, pathway_id, batch_id, total_fee_amount, discount_amount, discount_percentage, drip_override, drip_enabled, sequential_override, sequential_enabled });

    // Generate passwords
    const loginPassword = generateSecurePassword();
    const lmsPassword = generateSecurePassword();
    const passwordHash = await hashPassword(loginPassword);
    const lmsUserId = email; // LMS user ID is the email

    // Validate input
    if (!email || !full_name || !phone || !installment_count) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize phone to E.164 format
    let sanitizedPhone = phone.trim().replace(/[^\d+]/g, '');
    // Ensure only one + at start
    if (sanitizedPhone.indexOf('+') > 0) {
      sanitizedPhone = sanitizedPhone.replace(/\+/g, '');
    }
    // Convert 92xxxxxxxxxx to +92xxxxxxxxxx
    if (sanitizedPhone.startsWith('92') && !sanitizedPhone.startsWith('+')) {
      sanitizedPhone = '+' + sanitizedPhone;
    }
    // Validate E.164 format: +[1-9][digits]{1-14}
    if (!/^\+?[1-9]\d{1,14}$/.test(sanitizedPhone)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid phone format. Please use E.164 format (e.g., +923001234567)',
          error_code: 'INVALID_PHONE_FORMAT'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Phone sanitized:', { original: phone, sanitized: sanitizedPhone });

    // Check if email already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'A student with this email address already exists in the system',
          error_code: 'EMAIL_EXISTS'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if phone number already exists
    const { data: existingPhone } = await supabaseAdmin
      .from('users')
      .select('id, email, full_name')
      .eq('phone', sanitizedPhone)
      .maybeSingle();

    if (existingPhone) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `A student with this phone number already exists (${existingPhone.email})`,
          error_code: 'PHONE_EXISTS'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: loginPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role: 'student'
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the current user who is creating this student and validate discount permissions
    const authHeader = req.headers.get('authorization');
    let createdBy = null;
    let creatorRole = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.replace('Bearer ', '');
        console.log('Auth token received:', token ? 'Present' : 'Missing');
        
        // Use admin client to validate the token
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
        if (userError) {
          console.log('Error getting user from token:', userError);
        } else {
          createdBy = user?.id || null;
          console.log('Student being created by user:', createdBy);
          
          // Get creator's role for discount validation
          if (createdBy) {
            const { data: userData } = await supabaseAdmin
              .from('users')
              .select('role')
              .eq('id', createdBy)
              .single();
            creatorRole = userData?.role || null;
            console.log('Creator role:', creatorRole);
          }
        }
      } catch (error) {
        console.log('Could not determine creator:', error);
      }
    } else {
      console.log('No authorization header found or invalid format');
    }

    // Validate discount permissions
    if ((discount_amount > 0 || discount_percentage > 0) && !['admin', 'superadmin'].includes(creatorRole || '')) {
      console.error('Unauthorized discount attempt by role:', creatorRole);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Only admins and superadmins can apply discounts to student fees' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user profile in public.users
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        phone: sanitizedPhone,
        role: 'student',
        password_display: loginPassword,
        original_password: loginPassword,
        password_hash: passwordHash,
        lms_user_id: lmsUserId,
        status: 'active',
        lms_status: 'inactive',
        is_temp_password: true,
        created_by: createdBy
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Cleanup auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create user profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user role entry (required for role-based queries)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: 'student'
      });

    if (roleError) {
      console.error('User role creation error:', roleError);
      // Cleanup on failure
      await supabaseAdmin.from('users').delete().eq('id', authUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create user role: ${roleError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the selected course or pathway price
    let baseFeeAmount = 0;
    let selectedCourseId: string | null = course_id || null;
    let selectedPathwayId: string | null = pathway_id || null;
    
    if (course_id) {
      // Use specific course
      const { data: course } = await supabaseAdmin
        .from('courses')
        .select('id, price, title')
        .eq('id', course_id)
        .single();
      
      if (course) {
        baseFeeAmount = course.price || 0;
        console.log('Using selected course:', { id: course.id, title: course.title, price: baseFeeAmount });
      }
    } else if (pathway_id) {
      // Use specific pathway
      const { data: pathway } = await supabaseAdmin
        .from('learning_pathways')
        .select('id, price, name')
        .eq('id', pathway_id)
        .single();
      
      if (pathway) {
        baseFeeAmount = pathway.price || 0;
        console.log('Using selected pathway:', { id: pathway.id, name: pathway.name, price: baseFeeAmount });
      }
    } else if (total_fee_amount !== undefined) {
      // Use provided total fee amount
      baseFeeAmount = total_fee_amount;
    } else {
      // Fallback to company settings original_fee_amount
      const { data: companySettings } = await supabaseAdmin
        .from('company_settings')
        .select('original_fee_amount')
        .eq('id', 1)
        .single();
      
      if (companySettings) {
        baseFeeAmount = companySettings.original_fee_amount || 0;
      }
    }

    // Calculate final fee with discount
    let finalFeeAmount = baseFeeAmount;
    if (discount_percentage > 0) {
      finalFeeAmount = finalFeeAmount * (1 - discount_percentage / 100);
    } else if (discount_amount > 0) {
      finalFeeAmount = finalFeeAmount - discount_amount;
    }
    finalFeeAmount = Math.max(0, finalFeeAmount); // Allow 0 fee for 100% discount

    console.log('Fee calculation:', {
      base: baseFeeAmount,
      discount_amount,
      discount_percentage,
      final: finalFeeAmount
    });

    // Create student record with discount info
    const { data: studentRecord, error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        user_id: authUser.user.id,
        installment_count,
        lms_username: lmsUserId,
        discount_amount: discount_amount || 0,
        discount_percentage: discount_percentage || 0,
        final_fee_amount: finalFeeAmount,
        fees_cleared: finalFeeAmount === 0 // Auto-clear fees for 100% discount
      })
      .select()
      .single();

    if (studentError) {
      console.error('Student record creation error:', studentError);
      // Cleanup on failure
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create student record: ${studentError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Student record created:', {
      student_id: studentRecord.student_id,
      final_fee: finalFeeAmount,
      fees_cleared: finalFeeAmount === 0
    });

    // Enroll student in selected course or pathway
    try {
      const hasFee = finalFeeAmount > 0;
      
      if (selectedCourseId) {
        const { error: enrollError } = await supabaseAdmin
          .from('course_enrollments')
          .insert({
            student_id: studentRecord.id,
            course_id: selectedCourseId,
            pathway_id: null,
            batch_id: batch_id || null,
            enrollment_source: 'direct',
            status: 'active',
            progress_percentage: 0,
            total_amount: hasFee ? finalFeeAmount : 0,
            amount_paid: 0,
            payment_status: hasFee ? 'pending' : 'waived',
            // Access control overrides
            drip_override: drip_override || false,
            drip_enabled: drip_override ? (drip_enabled ?? null) : null,
            sequential_override: sequential_override || false,
            sequential_enabled: sequential_override ? (sequential_enabled ?? null) : null,
            discount_amount: discount_amount || null,
            discount_percentage: discount_percentage || null
          });

        if (enrollError) {
          console.error('Course enrollment error (non-fatal):', enrollError);
        } else {
          console.log('Student enrolled in course:', selectedCourseId, 'with batch:', batch_id || 'none');
        }
      } else if (selectedPathwayId) {
        // For pathway, get the first course and enroll with pathway_id
        const { data: pathwayCourses } = await supabaseAdmin
          .from('pathway_courses')
          .select('course_id')
          .eq('pathway_id', selectedPathwayId)
          .order('step_number')
          .limit(1);
        
        const firstCourseId = pathwayCourses?.[0]?.course_id || null;
        
        const { error: enrollError } = await supabaseAdmin
          .from('course_enrollments')
          .insert({
            student_id: studentRecord.id,
            course_id: firstCourseId,
            pathway_id: selectedPathwayId,
            batch_id: batch_id || null,
            enrollment_source: 'pathway',
            status: 'active',
            progress_percentage: 0,
            total_amount: hasFee ? finalFeeAmount : 0,
            amount_paid: 0,
            payment_status: hasFee ? 'pending' : 'waived',
            // Access control overrides
            drip_override: drip_override || false,
            drip_enabled: drip_override ? (drip_enabled ?? null) : null,
            sequential_override: sequential_override || false,
            sequential_enabled: sequential_override ? (sequential_enabled ?? null) : null,
            discount_amount: discount_amount || null,
            discount_percentage: discount_percentage || null
          });

        if (enrollError) {
          console.error('Pathway enrollment error (non-fatal):', enrollError);
        } else {
          console.log('Student enrolled in pathway:', selectedPathwayId, 'with batch:', batch_id || 'none');
        }
      } else {
        // Fallback: Auto-enroll in default course
        const { data: defaultCourse } = await supabaseAdmin
          .from('courses')
          .select('id, price')
          .eq('is_active', true)
          .order('sequence_order', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (defaultCourse) {
          selectedCourseId = defaultCourse.id;
          
          const { error: enrollError } = await supabaseAdmin
            .from('course_enrollments')
            .insert({
              student_id: studentRecord.id,
              course_id: defaultCourse.id,
              status: 'active',
              progress_percentage: 0,
              total_amount: hasFee ? finalFeeAmount : 0,
              amount_paid: 0,
              payment_status: hasFee ? 'pending' : 'waived'
            });

          if (enrollError) {
            console.error('Default course enrollment error (non-fatal):', enrollError);
          } else {
            console.log('Student auto-enrolled in default course:', defaultCourse.id);
          }
        }
      }
    } catch (enrollError) {
      console.error('Enrollment failed (non-fatal):', enrollError);
    }

    // Notify late-joining batch students about missed session recordings
    if (batch_id) {
      try {
        const { data: batchData } = await supabaseAdmin
          .from('batches').select('start_date, name').eq('id', batch_id).single();

        if (batchData) {
          const now = new Date().toISOString();
          const { data: missedSessions } = await supabaseAdmin
            .from('success_sessions')
            .select('id, title, link, start_time')
            .eq('batch_id', batch_id)
            .lt('start_time', now)
            .not('link', 'is', null)
            .order('start_time', { ascending: true });

          const sessionLinks = (missedSessions || [])
            .filter(s => s.link && s.link.trim() !== '')
            .map(s => ({ title: s.title, link: s.link, date: new Date(s.start_time).toLocaleDateString() }));

          if (sessionLinks.length > 0) {
            const linksText = sessionLinks.map(s => `• ${s.title} (${s.date})`).join('\n');
            await supabaseAdmin.from('notifications').insert({
              user_id: authUser.user.id,
              title: `📹 ${sessionLinks.length} Missed Session Recording${sessionLinks.length > 1 ? 's' : ''} Available`,
              message: `You've been added to batch "${batchData.name}". Here are the recordings of sessions you missed:\n${linksText}\n\nVisit the Live Sessions page to watch them.`,
              type: 'info',
              is_read: false
            });
            console.log(`✅ Sent missed sessions notification for ${sessionLinks.length} sessions`);
          }
        }
      } catch (missedErr) {
        console.error('Error processing missed sessions notification:', missedErr);
      }
    }

    // Queue email for credential delivery (non-blocking)
    supabaseAdmin
      .from('email_queue')
      .insert({
        user_id: authUser.user.id,
        email_type: 'student_credentials',
        recipient_email: email,
        recipient_name: full_name,
        credentials: {
          login_password: loginPassword,
          lms_user_id: lmsUserId,
          lms_password: lmsPassword,
          student_id: studentRecord.student_id
        }
      })
      .then(({ error: emailQueueError }) => {
        if (emailQueueError) {
          console.error('Email queue error:', emailQueueError);
        }
      });

    // Get company settings including currency and company details
    const { data: companyDetailsData } = await supabaseAdmin
      .from('company_settings')
      .select('lms_url, currency, company_name, address, contact_email, primary_phone, payment_methods, billing_email_cc, notification_email_cc')
      .eq('id', 1)
      .single();
    
    const loginUrl = companyDetailsData?.lms_url || 'https://growthos.core47.ai';
    const currency = companyDetailsData?.currency || 'USD';
    const companyDetails: CompanyDetails = {
      company_name: companyDetailsData?.company_name || 'Your Company',
      address: companyDetailsData?.address || '',
      contact_email: companyDetailsData?.contact_email || '',
      primary_phone: companyDetailsData?.primary_phone || ''
    };

    // Handle installment creation based on final fee
    if (finalFeeAmount === 0) {
      console.log('100% discount applied - no invoices will be created');
      
      // Log discount application for audit purposes
      await supabaseAdmin.from('admin_logs').insert({
        entity_type: 'student',
        entity_id: studentRecord.id,
        action: 'discount_applied',
        description: `100% discount applied - total fee: ${currency} 0.00`,
        performed_by: createdBy,
        data: {
          target_user_id: userId,
          original_amount: baseFeeAmount,
          discount_amount: discount_amount || 0,
          discount_percentage: discount_percentage || 0,
          final_amount: 0,
          student_email: email,
          student_name: full_name,
          fees_cleared: true
        }
      });
      console.log('100% discount logged - student has immediate access');
    } else {
      // Create ALL installments for students with fees (fast operation)
      try {
        const { data: installmentSettings } = await supabaseAdmin
          .from('company_settings')
          .select('invoice_overdue_days, invoice_send_gap_days')
          .single();

        // Fetch batch start_date if batch_id is provided
        let batchStartDate: Date | null = null;
        if (batch_id) {
          const { data: batchData } = await supabaseAdmin
            .from('batches')
            .select('start_date')
            .eq('id', batch_id)
            .single();
          if (batchData?.start_date) {
            batchStartDate = new Date(batchData.start_date);
            console.log(`Batch start date: ${batchStartDate.toISOString()}`);
          }
        }

        if (installmentSettings) {
          const installmentAmount = finalFeeAmount / installment_count;
          const intervalDays = installmentSettings.invoice_send_gap_days || 30;
          const overdueDays = installmentSettings.invoice_overdue_days || 5;
          
          // Create all installments with course_id/pathway_id link
          const installments = [];
          for (let i = 1; i <= installment_count; i++) {
            let issueDate: Date;
            let dueDate: Date;

            if (i === 1) {
              // 1st installment: issued immediately
              issueDate = new Date();
              dueDate = new Date(issueDate);
              dueDate.setDate(dueDate.getDate() + overdueDays);
            } else if (batchStartDate) {
              // Batch-enrolled: 2nd+ installments anchored to batch start date + (i-1)*intervalDays
              issueDate = new Date(batchStartDate);
              issueDate.setDate(issueDate.getDate() + ((i - 1) * intervalDays));
              dueDate = new Date(issueDate);
              dueDate.setDate(dueDate.getDate() + overdueDays);
            } else {
              // Non-batch: use company settings interval
              issueDate = new Date();
              issueDate.setDate(issueDate.getDate() + ((i - 1) * intervalDays));
              dueDate = new Date(issueDate);
              dueDate.setDate(dueDate.getDate() + overdueDays);
            }

            installments.push({
              student_id: studentRecord.id,
              course_id: selectedCourseId,
              pathway_id: selectedPathwayId,
              amount: installmentAmount,
              installment_number: i,
              issue_date: issueDate.toISOString(),
              due_date: dueDate.toISOString(),
              status: i === 1 ? 'pending' : 'scheduled'
            });
          }

          const { error: installmentError } = await supabaseAdmin
            .from('invoices')
            .insert(installments);

          if (installmentError) {
            console.error('Error creating installments:', installmentError);
          } else {
            console.log(`All ${installment_count} installments created successfully`);
            
            // Log discount application if applied
            if (discount_amount > 0 || discount_percentage > 0) {
              await supabaseAdmin.from('admin_logs').insert({
                entity_type: 'student',
                entity_id: studentRecord.id,
                action: 'discount_applied',
                description: `Discount applied: ${discount_percentage > 0 ? discount_percentage + '%' : currency + ' ' + discount_amount}`,
                performed_by: createdBy,
                data: {
                  target_user_id: userId,
                  original_amount: baseFeeAmount,
                  discount_amount: discount_amount || 0,
                  discount_percentage: discount_percentage || 0,
                  final_amount: finalFeeAmount,
                  student_email: email,
                  student_name: full_name
                }
              });
              console.log('Discount application logged to admin_logs');
            }
          }
        }
        
        console.log('Installment creation completed successfully');
      } catch (invoiceError) {
        console.error('Invoice creation error:', invoiceError);
        // Continue anyway - invoices can be created manually
      }
    }

    // ── Send welcome email INLINE (before response) so failures are visible ──
    let emailSent = false;
    let emailError: string | undefined;

    try {
      const smtpClient = SMTPClient.fromEnv();
      const notificationCc = companyDetailsData?.notification_email_cc || Deno.env.get('NOTIFICATION_EMAIL_CC');
      
      await smtpClient.sendEmail({
        to: email,
        subject: 'Welcome to Growth OS - Your LMS Access Credentials',
        ...(notificationCc ? { cc: notificationCc } : {}),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Growth OS, ${full_name}!</h2>
            
            <p>Your student account has been created successfully. Here are your login credentials:</p>
            
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>LMS Access Credentials</h3>
              <p><strong>Student ID:</strong> ${studentRecord.student_id}</p>
              <p><strong>Installments:</strong> ${installment_count} installment${installment_count > 1 ? 's' : ''}</p>
              <p><strong>User ID:</strong> ${email}</p>
              <p><strong>Current Password:</strong> ${loginPassword}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background-color: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Start Your Learning Journey
              </a>
            </div>
            
            <p>Please keep these credentials secure. You can change your password after logging in.</p>
            
            <p>If you have any questions, please contact our support team.</p>
            
            <p>Best regards,<br>Growth OS Team</p>
          </div>
        `,
      });

      emailSent = true;
      console.log('Welcome email sent successfully to:', email);

      await supabaseAdmin
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('user_id', authUser.user.id)
        .eq('email_type', 'student_credentials');

    } catch (welcomeEmailErr) {
      emailSent = false;
      emailError = welcomeEmailErr instanceof Error ? welcomeEmailErr.message : 'Unknown email error';
      console.error('Welcome email FAILED:', emailError);

      await supabaseAdmin
        .from('email_queue')
        .update({ 
          status: 'failed', 
          error_message: emailError
        })
        .eq('user_id', authUser.user.id)
        .eq('email_type', 'student_credentials');
    }

    // ── Send invoice email in background (non-critical) ──
    const sendInvoiceInBackground = async () => {
      try {
        const { data: invoiceSettings } = await supabaseAdmin
          .from('company_settings')
          .select('original_fee_amount, invoice_overdue_days, invoice_send_gap_days, payment_methods, currency, overdue_penalty_type, overdue_penalty_amount')
          .single();

        if (invoiceSettings) {
          const { data: firstInvoice } = await supabaseAdmin
            .from('invoices')
            .select('*')
            .eq('student_id', studentRecord.id)
            .eq('installment_number', 1)
            .maybeSingle();

          if (firstInvoice) {
            await sendFirstInvoiceEmail({
              installment_number: firstInvoice.installment_number,
              amount: firstInvoice.amount,
              due_date: firstInvoice.due_date,
              student_email: email,
              student_name: full_name
            }, loginUrl, currency, companyDetails, invoiceSettings?.payment_methods || [], invoiceSettings?.overdue_penalty_type || '', invoiceSettings?.overdue_penalty_amount || 0);
            console.log('First invoice email sent successfully');
          }
        }
      } catch (error) {
        console.error('Background invoice email error:', error);
      }
    };

    // Invoice email stays in background (non-blocking)
    EdgeRuntime.waitUntil(sendInvoiceInBackground());

    const response: CreateEnhancedStudentResponse = {
      success: true,
      data: {
        id: authUser.user.id,
        email,
        full_name,
        role: 'student',
        student_id: studentRecord.student_id || '',
        lms_credentials: {
          lms_user_id: lmsUserId,
          lms_password: lmsPassword
        },
        generated_password: loginPassword,
        created_at: userProfile.created_at
      },
      email_sent: emailSent,
      email_error: emailError,
    };

    console.log('Enhanced student creation completed successfully');

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in enhanced student creation:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
};

async function sendFirstInvoiceEmail(invoice: any, loginUrl: string, currency: string, companyDetails: CompanyDetails, paymentMethods: any[], penaltyType: string = '', penaltyAmount: number = 0) {
  try {
    const smtpClient = SMTPClient.fromEnv();
    const studentEmail = invoice.student_email;
    const studentName = invoice.student_name;
    const dueDate = new Date(invoice.due_date).toLocaleDateString();
    
    // Get currency symbol
    const getCurrencySymbol = (curr: string = 'USD') => {
      const symbols: { [key: string]: string } = {
        USD: '$', EUR: '€', GBP: '£', INR: '₹', CAD: 'C$', AUD: 'A$', PKR: 'Rs'
      };
      return symbols[curr] || curr;
    };
    
    const currencySymbol = getCurrencySymbol(currency);

    // Calculate penalty info
    const invoiceAmount = parseFloat(String(invoice.amount));
    let penaltyValue = 0;
    if (penaltyType === 'fixed' && penaltyAmount > 0) {
      penaltyValue = penaltyAmount;
    } else if (penaltyType === 'percentage' && penaltyAmount > 0) {
      penaltyValue = (invoiceAmount * penaltyAmount) / 100;
    }
    const formattedAfterOverdue = (invoiceAmount + penaltyValue).toLocaleString();
    const formattedPenaltyVal = penaltyValue.toLocaleString();

    const overdueWarningHtml = penaltyValue > 0 ? `
      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 15px; margin-top: 15px;">
        <p style="margin: 0 0 5px 0; color: #991b1b; font-size: 13px; font-weight: bold;">⚠️ If not paid by due date:</p>
        <p style="margin: 0; color: #991b1b; font-size: 13px;">
          Penalty: ${currencySymbol}${formattedPenaltyVal} ${penaltyType === 'percentage' ? '(' + penaltyAmount + '%)' : '(fixed)'}
        </p>
        <p style="margin: 5px 0 0 0; color: #dc2626; font-size: 15px; font-weight: bold;">
          Amount after overdue: ${currencySymbol}${formattedAfterOverdue}
        </p>
      </div>
    ` : '';
    
    // Generate payment methods HTML
    const paymentMethodsHtml = paymentMethods.filter((pm: any) => pm.enabled).map((method: any) => `
      <div style="border-left: 3px solid #2563eb; padding-left: 15px; margin-bottom: 15px;">
        <h4 style="margin: 0 0 10px 0; color: #1e40af;">${method.name}</h4>
        ${Object.entries(method.details).map(([key, value]) => `
          <p style="margin: 5px 0; font-size: 14px;"><strong>${key.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}:</strong> ${value}</p>
        `).join('')}
      </div>
    `).join('');
    
    const billingCc = companyDetailsData?.billing_email_cc || Deno.env.get('BILLING_EMAIL_CC');
    await smtpClient.sendEmail({
      to: studentEmail,
      subject: `Invoice #${invoice.installment_number.toString().padStart(3, '0')} - Payment Due ${dueDate}`,
      ...(billingCc ? { cc: billingCc } : {}),
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Invoice #${invoice.installment_number.toString().padStart(3, '0')}</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold;">INVOICE</h1>
              <p style="margin: 10px 0 0 0; opacity: 0.9;">${companyDetails.company_name}</p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">Dear ${studentName},</p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6;">Your installment invoice has been generated. Please find the details below:</p>
              
              <!-- Invoice Details -->
              <div style="background-color: #f0f9ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 25px; margin: 25px 0;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                  <div>
                    <h3 style="margin: 0 0 15px 0; color: #1e40af; font-size: 18px;">Invoice To:</h3>
                    <p style="margin: 0; font-weight: bold; color: #111827;">${studentName}</p>
                    <p style="margin: 5px 0 0 0; color: #6b7280;">${studentEmail}</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="margin: 0; color: #6b7280;">Invoice #: <strong>INV-${invoice.installment_number.toString().padStart(3, '0')}</strong></p>
                    <p style="margin: 5px 0; color: #6b7280;">Date: <strong>${new Date().toLocaleDateString()}</strong></p>
                    <p style="margin: 5px 0; color: #6b7280;">Due Date: <strong>${dueDate}</strong></p>
                  </div>
                </div>
                
                <!-- Amount Due -->
                <div style="background-color: white; border-radius: 6px; padding: 20px; text-align: center; border: 2px solid #2563eb;">
                  <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">AMOUNT DUE</p>
                  <p style="margin: 0; font-size: 36px; font-weight: bold; color: #2563eb;">${currencySymbol}${parseFloat(invoice.amount).toLocaleString()}</p>
                </div>
              </div>
              
              <!-- Course Details -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 15px 0; color: #374151;">Course Details:</h3>
                <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 10px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #374151;">Course Installment Payment #${invoice.installment_number}</span>
                    <span style="font-weight: bold; color: #111827;">${currencySymbol}${parseFloat(invoice.amount).toLocaleString()}</span>
                  </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-weight: bold; color: #2563eb;">
                  <span>Total Amount Due:</span>
                  <span>${currencySymbol}${parseFloat(invoice.amount).toLocaleString()}</span>
                </div>
                ${overdueWarningHtml}
              </div>
              
              <!-- Payment Methods -->
              ${paymentMethodsHtml ? `
              <div style="margin: 25px 0;">
                <h3 style="margin: 0 0 20px 0; color: #374151;">Payment Methods:</h3>
                ${paymentMethodsHtml}
              </div>
              ` : ''}
              
              <!-- Action Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="background: linear-gradient(135deg, #2563eb, #7c3aed); color: white; text-decoration: none; padding: 15px 30px; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Access Learning Platform
                </a>
              </div>
              
              <!-- Footer Notes -->
              <div style="background-color: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h4 style="margin: 0 0 10px 0; color: #92400e;">Important Notes:</h4>
                <ul style="margin: 0; padding-left: 20px; color: #92400e;">
                  <li>Payment is due by ${dueDate}</li>
                  <li>Access to courses may be restricted for overdue payments</li>
                  <li>Contact support if you have any payment-related questions</li>
                </ul>
              </div>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">If you have any questions about this invoice or need assistance with payment, please contact our support team.</p>
              
              <p style="color: #374151; font-size: 16px; margin-top: 30px;">Best regards,<br><strong>${companyDetails.company_name} Team</strong></p>
            </div>
            
            <!-- Footer -->
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">${companyDetails.company_name}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">${companyDetails.address}</p>
              <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 12px;">Email: ${companyDetails.contact_email} | Phone: ${companyDetails.primary_phone}</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log(`First invoice email sent successfully to ${studentEmail} for installment ${invoice.installment_number}`);
  } catch (error) {
    console.error('Error sending first invoice email:', error);
    throw error;
  }
};

serve(handler);