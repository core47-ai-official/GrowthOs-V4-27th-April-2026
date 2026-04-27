import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { SMTPClient } from '../_shared/smtp-client.ts';

const FUNCTION_VERSION = '2.2.0'; // includes reset_password handler

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function generateSecurePassword(): string {
  const length = 12;
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

interface UpdateStudentRequest {
  user_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  resend_credentials?: boolean;
  reset_password?: string;
  // Access control settings
  enrollment_id?: string;
  batch_id?: string | null;
  drip_override?: boolean;
  drip_enabled?: boolean | null;
  sequential_override?: boolean;
  sequential_enabled?: boolean | null;
  // Discount settings
  discount_type?: 'none' | 'fixed' | 'percentage';
  discount_amount?: number;
  discount_percentage?: number;
}

serve(async (req) => {
  console.log(`update-student-details v${FUNCTION_VERSION} invoked`);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if user has permission (superadmin or admin)
    const { data: currentUser, error: roleError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || !currentUser) {
      throw new Error('Failed to verify user permissions');
    }

    if (!['superadmin', 'admin'].includes(currentUser.role)) {
      throw new Error('Insufficient permissions');
    }

    const body: UpdateStudentRequest = await req.json();
    const { 
      user_id, 
      full_name, 
      email, 
      phone, 
      resend_credentials,
      reset_password,
      enrollment_id,
      batch_id,
      drip_override,
      drip_enabled,
      sequential_override,
      sequential_enabled,
      discount_type,
      discount_amount,
      discount_percentage
    } = body;

    if (!user_id) {
      throw new Error('Missing required field: user_id');
    }

    // Handle simple password reset (resets auth password to stored value)
    if (reset_password) {
      console.log('Resetting password for user:', user_id);
      const { error: pwResetError } = await supabaseAdmin.auth.admin.updateUserById(
        user_id,
        { password: reset_password }
      );
      if (pwResetError) {
        throw new Error(`Failed to reset password: ${pwResetError.message}`);
      }
      console.log('Password reset successfully for user:', user_id);
      return new Response(
        JSON.stringify({ success: true, message: 'Password reset successfully', _version: FUNCTION_VERSION }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!full_name || !email) {
      throw new Error('Missing required fields');
    }

    // Get current student details
    const { data: existingUser, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('email, password_display')
      .eq('id', user_id)
      .single();

    if (fetchError || !existingUser) {
      throw new Error('Student not found');
    }

    const oldEmail = existingUser.email;
    const emailChanged = email !== oldEmail;

    // Update user in auth.users with email confirmation disabled
    console.log('Updating email in auth.users...');
    const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      { 
        email: email,
        email_confirm: false  // Critical: bypass email confirmation
      }
    );

    if (authUpdateError) {
      console.error('Failed to update auth.users email:', authUpdateError);
      throw new Error(`Failed to update auth user: ${authUpdateError.message}`);
    }
    console.log('✅ Successfully updated email in auth.users');

    // Update user in public.users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        full_name,
        email,
        phone: phone || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user_id);

    if (updateError) {
      throw new Error(`Failed to update user: ${updateError.message}`);
    }

    // Update enrollment access settings and discount if provided
    if (enrollment_id) {
      const enrollmentUpdate: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      // Batch assignment
      if (batch_id !== undefined) {
        enrollmentUpdate.batch_id = batch_id;
      }

      // Access settings
      if (drip_override !== undefined) {
        enrollmentUpdate.drip_override = drip_override;
        enrollmentUpdate.drip_enabled = drip_override ? drip_enabled : null;
      }
      
      if (sequential_override !== undefined) {
        enrollmentUpdate.sequential_override = sequential_override;
        enrollmentUpdate.sequential_enabled = sequential_override ? sequential_enabled : null;
      }

      // Discount settings
      if (discount_type !== undefined) {
        if (discount_type === 'none') {
          enrollmentUpdate.discount_amount = null;
          enrollmentUpdate.discount_percentage = null;
        } else if (discount_type === 'fixed') {
          enrollmentUpdate.discount_amount = discount_amount || 0;
          enrollmentUpdate.discount_percentage = null;
        } else if (discount_type === 'percentage') {
          enrollmentUpdate.discount_amount = null;
          enrollmentUpdate.discount_percentage = discount_percentage || 0;
        }
      }

      console.log('Updating enrollment:', { enrollment_id, ...enrollmentUpdate });
      
      const { error: enrollmentError } = await supabaseAdmin
        .from('course_enrollments')
        .update(enrollmentUpdate)
        .eq('id', enrollment_id);

      if (enrollmentError) {
        console.error('Failed to update enrollment:', enrollmentError);
        // Don't throw - this is non-critical
      } else {
        console.log('✅ Successfully updated enrollment settings');

        // If batch was assigned, notify student about missed session recordings
        if (batch_id) {
          try {
            // Get batch start date
            const { data: batchData } = await supabaseAdmin
              .from('batches')
              .select('start_date, name')
              .eq('id', batch_id)
              .single();

            if (batchData) {
              const now = new Date().toISOString();
              // Find past sessions for this batch that the student missed
              const { data: missedSessions } = await supabaseAdmin
                .from('success_sessions')
                .select('id, title, link, start_time')
                .eq('batch_id', batch_id)
                .lt('start_time', now)
                .not('link', 'is', null)
                .order('start_time', { ascending: true });

              if (missedSessions && missedSessions.length > 0) {
                console.log(`Found ${missedSessions.length} missed sessions for late-joining student`);

                // Build list of recording links for notification
                const sessionLinks = missedSessions
                  .filter(s => s.link && s.link.trim() !== '')
                  .map(s => ({
                    title: s.title,
                    link: s.link,
                    date: new Date(s.start_time).toLocaleDateString()
                  }));

                if (sessionLinks.length > 0) {
                  // Create in-app notification
                  const linksText = sessionLinks.map(s => `• ${s.title} (${s.date})`).join('\n');
                  await supabaseAdmin.from('notifications').insert({
                    user_id: user_id,
                    title: `📹 ${sessionLinks.length} Missed Session Recording${sessionLinks.length > 1 ? 's' : ''} Available`,
                    message: `You've been added to batch "${batchData.name}". Here are the recordings of sessions you missed:\n${linksText}\n\nVisit the Live Sessions page to watch them.`,
                    type: 'info',
                    is_read: false
                  });
                  console.log(`✅ Sent missed sessions notification to student ${user_id}`);

                  // Send email notification if SMTP is configured
                  const smtpHost = Deno.env.get('SMTP_HOST');
                  if (smtpHost) {
                    try {
                      const { data: companySettings } = await supabaseAdmin
                        .from('company_settings')
                        .select('company_name, lms_url')
                        .single();

                      const companyName = companySettings?.company_name || 'Growth OS';
                      const lmsUrl = companySettings?.lms_url || '';

                      const sessionListHtml = sessionLinks.map(s =>
                        `<tr>
                          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.title}</td>
                          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${s.date}</td>
                          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;"><a href="${s.link}" style="color:#4F46E5;">Watch Recording</a></td>
                        </tr>`
                      ).join('');

                      const smtpClient = SMTPClient.fromEnv();
                      await smtpClient.sendEmail({
                        to: email,
                        subject: `${companyName} - Missed Session Recordings Available`,
                        html: `
                          <!DOCTYPE html>
                          <html>
                            <head><meta charset="utf-8"></head>
                            <body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
                              <div style="max-width:600px;margin:0 auto;padding:20px;">
                                <div style="background-color:#4F46E5;color:white;padding:20px;text-align:center;border-radius:5px 5px 0 0;">
                                  <h1>${companyName}</h1>
                                </div>
                                <div style="background-color:#f9fafb;padding:30px;border-radius:0 0 5px 5px;">
                                  <h2>Missed Session Recordings</h2>
                                  <p>Hello ${full_name},</p>
                                  <p>You've been added to batch <strong>"${batchData.name}"</strong>. Here are the recordings of live sessions that took place before you joined:</p>
                                  <table style="width:100%;border-collapse:collapse;margin:20px 0;background:white;border-radius:5px;border:1px solid #e5e7eb;">
                                    <thead>
                                      <tr style="background:#f3f4f6;">
                                        <th style="padding:10px 12px;text-align:left;">Session</th>
                                        <th style="padding:10px 12px;text-align:left;">Date</th>
                                        <th style="padding:10px 12px;text-align:left;">Recording</th>
                                      </tr>
                                    </thead>
                                    <tbody>${sessionListHtml}</tbody>
                                  </table>
                                  <center>
                                    <a href="${lmsUrl}" style="display:inline-block;background-color:#4F46E5;color:white;padding:12px 30px;text-decoration:none;border-radius:5px;margin:20px 0;">Go to Platform</a>
                                  </center>
                                  <div style="text-align:center;color:#6b7280;margin-top:30px;font-size:14px;">
                                    <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                                  </div>
                                </div>
                              </div>
                            </body>
                          </html>
                        `,
                      });
                      console.log('✅ Missed sessions email sent to', email);
                    } catch (emailErr) {
                      console.error('Failed to send missed sessions email:', emailErr);
                    }
                  }
                }
              }
            }
          } catch (missedErr) {
            console.error('Error processing missed sessions notification:', missedErr);
            // Non-critical, don't throw
          }
        }
      }
    }

    // If email changed and credentials should be resent
    let emailSent = false;
    let emailError = null;
    let passwordRegenerated = false;
    
    // Pre-flight checks logging
    console.log('Email sending conditions check:', {
      emailChanged,
      resend_credentials,
      has_password_display: !!existingUser.password_display,
      old_email: oldEmail,
      new_email: email
    });

    // Verify SMTP configuration
    const smtpConfigured = !!(
      Deno.env.get('SMTP_HOST') &&
      Deno.env.get('SMTP_PORT') &&
      Deno.env.get('SMTP_USER') &&
      Deno.env.get('SMTP_PASSWORD') &&
      Deno.env.get('SMTP_FROM_EMAIL')
    );

    console.log('SMTP Configuration Status:', {
      configured: smtpConfigured,
      has_host: !!Deno.env.get('SMTP_HOST'),
      has_port: !!Deno.env.get('SMTP_PORT'),
      has_user: !!Deno.env.get('SMTP_USER'),
      has_password: !!Deno.env.get('SMTP_PASSWORD'),
      has_from_email: !!Deno.env.get('SMTP_FROM_EMAIL'),
      has_from_name: !!Deno.env.get('SMTP_FROM_NAME')
    });

    if (!smtpConfigured) {
      emailError = 'SMTP not configured in function secrets. Please configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, and SMTP_FROM_EMAIL.';
      console.error('SMTP Configuration Error:', emailError);
    }
    
    // Check if password needs to be generated
    let passwordToSend = existingUser.password_display;

    if (emailChanged && resend_credentials && !passwordToSend && smtpConfigured) {
      console.log('No password_display found, generating new password for user:', user_id);
      
      try {
        // Generate new password
        const newPassword = generateSecurePassword();
        
        // Update password in auth.users
        const { error: pwUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          user_id,
          { 
            password: newPassword,
            email_confirm: false
          }
        );
        
        if (pwUpdateError) {
          console.error('Failed to update password in auth.users:', pwUpdateError);
          emailError = `Failed to generate new password: ${pwUpdateError.message}`;
        } else {
          // Update password_display in public.users
          const { error: dbUpdateError } = await supabaseAdmin
            .from('users')
            .update({
              password_display: newPassword,
              is_temp_password: true,
              updated_at: new Date().toISOString()
            })
            .eq('id', user_id);
          
          if (dbUpdateError) {
            console.error('Failed to update password_display:', dbUpdateError);
            emailError = `Failed to store new password: ${dbUpdateError.message}`;
          } else {
            passwordToSend = newPassword;
            passwordRegenerated = true;
            console.log('✅ New password generated and stored successfully');
          }
        }
      } catch (error) {
        console.error('Error during password generation:', error);
        emailError = `Password generation failed: ${error.message}`;
      }
    }
    
    if (emailChanged && resend_credentials && passwordToSend && smtpConfigured) {
      console.log('Starting email sending process...');
      
      try {
        // Get company details
        console.log('Fetching company settings...');
        const { data: companySettings, error: companyError } = await supabaseAdmin
          .from('company_settings')
          .select('company_name, company_logo, lms_url, notification_email_cc')
          .single();

        if (companyError) {
          console.error('Error fetching company settings:', companyError);
        }

        const companyName = companySettings?.company_name || 'Growth OS';
        const loginUrl = companySettings?.lms_url || Deno.env.get('SUPABASE_URL') || '';

        console.log('Company settings retrieved:', { companyName, loginUrl });

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          throw new Error(`Invalid email format: ${email}`);
        }

        // Read CC email from function secrets
        const ccEmail = companySettings?.notification_email_cc || Deno.env.get('NOTIFICATION_EMAIL_CC');
        console.log('CC configuration:', { 
          has_cc: !!ccEmail, 
          cc_email: ccEmail ? '***@***.***' : 'none' 
        });

        console.log('Initializing SMTP client...');
        const smtpClient = SMTPClient.fromEnv();
        
        console.log('Sending email to:', email);
        await smtpClient.sendEmail({
          to: email,
          cc: ccEmail || undefined,
          subject: `${companyName} - Updated Login Credentials`,
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <style>
                  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                  .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                  .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                  .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
                  .credentials { background-color: white; padding: 20px; border-radius: 5px; margin: 20px 0; border: 1px solid #e5e7eb; }
                  .credential-row { margin: 10px 0; }
                  .label { font-weight: bold; color: #6b7280; }
                  .value { color: #111827; font-family: monospace; background-color: #f3f4f6; padding: 5px 10px; border-radius: 3px; display: inline-block; }
                  .button { display: inline-block; background-color: #4F46E5; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                  .footer { text-align: center; color: #6b7280; margin-top: 30px; font-size: 14px; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h1>${companyName}</h1>
                  </div>
                  <div class="content">
                    <h2>Your Email Has Been Updated</h2>
                    <p>Hello ${full_name},</p>
                    <p>Your email address has been updated by an administrator. Here are your login credentials for future reference:</p>
                    
                    <div class="credentials">
                      <div class="credential-row">
                        <span class="label">New Email:</span><br>
                        <span class="value">${email}</span>
                      </div>
                      <div class="credential-row">
                        <span class="label">Password:</span><br>
                        <span class="value">${passwordToSend}</span>
                      </div>
                    </div>
                    
                    <p>You can use these credentials to access your account:</p>
                    <center>
                      <a href="${loginUrl}" class="button">Login to Platform</a>
                    </center>
                    
                    <div class="footer">
                      <p>If you did not request this change, please contact support immediately.</p>
                      <p>&copy; ${new Date().getFullYear()} ${companyName}. All rights reserved.</p>
                    </div>
                  </div>
                </div>
              </body>
            </html>
          `,
        });

        console.log(`✅ Credentials email successfully sent to ${email}${ccEmail ? ' with CC to ' + ccEmail : ''}`);
        emailSent = true;
      } catch (error) {
        console.error('❌ Error sending credentials email:', error);
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        
        // Detailed error categorization
        let errorMessage = 'Failed to send email';
        if (error instanceof Error) {
          if (error.message.includes('Connection')) {
            errorMessage = `SMTP Connection Error: ${error.message}`;
          } else if (error.message.includes('Authentication') || error.message.includes('auth')) {
            errorMessage = `SMTP Authentication Error: ${error.message}`;
          } else if (error.message.includes('Invalid email')) {
            errorMessage = `Email Validation Error: ${error.message}`;
          } else {
            errorMessage = `SMTP Error: ${error.message}`;
          }
        }
        
        emailError = errorMessage;
        console.error('Categorized error:', emailError);
      }
    } else if (emailChanged && !resend_credentials) {
      console.log('Email changed but resend_credentials is false, skipping email send');
    } else if (!emailChanged) {
      console.log('Email not changed, skipping email send');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Student details updated successfully',
        email_sent: emailSent,
        email_error: emailError,
        password_regenerated: passwordRegenerated,
        enrollment_updated: !!enrollment_id
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Error updating student details:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});