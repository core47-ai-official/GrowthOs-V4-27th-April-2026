import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';
import { SMTPClient } from '../_shared/smtp-client.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateTeamMemberRequest {
  email: string;
  full_name: string;
  role: string;
}

interface CreateTeamMemberResponse {
  success: boolean;
  data?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    generated_password: string;
    created_at: string;
  };
  error?: string;
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
    console.log('Enhanced team member creation started');

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
    const { email, full_name, role }: CreateTeamMemberRequest = await req.json();
    console.log('Request data:', { email, full_name, role });

    // Generate password
    const generatedPassword = generateSecurePassword();
    
    // Hash the password for database storage
    const passwordHash = await hashPassword(generatedPassword);

    // Validate input
    if (!email || !full_name || !role) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate role
    if (!['admin', 'mentor', 'enrollment_manager', 'support_member'].includes(role)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid role for team member' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ success: false, error: 'User with this email already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user profile in public.users
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        role,
        password_hash: passwordHash,
        password_display: generatedPassword,
        status: 'active',
        is_temp_password: true
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

    // Create role entry in user_roles table (CRITICAL for security)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authUser.user.id,
        role: role
      });

    if (roleError) {
      console.error('Role creation error:', roleError);
      // Cleanup if role creation fails
      await supabaseAdmin.from('users').delete().eq('id', authUser.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ success: false, error: `Failed to create user role: ${roleError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add to email queue for credential delivery
    const { error: emailQueueError } = await supabaseAdmin
      .from('email_queue')
      .insert({
        user_id: authUser.user.id,
        email_type: 'team_member_credentials',
        recipient_email: email,
        recipient_name: full_name,
        credentials: {
          login_password: generatedPassword,
          role: role
        }
      });

    if (emailQueueError) {
      console.error('Email queue error:', emailQueueError);
      // Continue anyway - email can be sent manually
    }

    // Get LMS URL from company settings
    const { data: companySettings } = await supabaseAdmin
      .from('company_settings')
      .select('lms_url, notification_email_cc')
      .eq('id', 1)
      .single();
    
    const loginUrl = companySettings?.lms_url || 'https://growthos.core47.ai';

    // Send welcome email with credentials via SMTP
    try {
      const smtpClient = SMTPClient.fromEnv();
      
      const notificationCc = companySettings?.notification_email_cc || Deno.env.get('NOTIFICATION_EMAIL_CC');
      await smtpClient.sendEmail({
        to: email,
        subject: 'Welcome to Growth OS - Your Login Credentials',
        ...(notificationCc ? { cc: notificationCc } : {}),
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome to Growth OS, ${full_name}!</h2>
            
            <p>Your ${role} account has been created successfully. Here are your login credentials:</p>
            
            <div style="background-color: #e8f4fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Login Credentials</h3>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Password:</strong> ${generatedPassword}</p>
              <p><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${loginUrl}" 
                 style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; display: inline-block;">
                Access Your Dashboard
              </a>
            </div>
            
            <p>Please keep these credentials secure. You can change your password after logging in.</p>
            
            <p>If you have any questions, please contact the system administrator.</p>
            
            <p>Best regards,<br>Growth OS Team</p>
          </div>
        `,
      });

      console.log('Email sent successfully via SMTP to:', email);

      // Update email queue status
      await supabaseAdmin
        .from('email_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('user_id', authUser.user.id)
        .eq('email_type', 'team_member_credentials');
        
    } catch (emailError) {
      console.error('SMTP email sending error:', emailError);
      // Update email queue with error
      await supabaseAdmin
        .from('email_queue')
        .update({ 
          status: 'failed', 
          error_message: emailError instanceof Error ? emailError.message : 'Unknown SMTP error'
        })
        .eq('user_id', authUser.user.id)
        .eq('email_type', 'team_member_credentials');
    }

    const response: CreateTeamMemberResponse = {
      success: true,
      data: {
        id: authUser.user.id,
        email,
        full_name,
        role,
        generated_password: generatedPassword,
        created_at: userProfile.created_at
      }
    };

    console.log('Enhanced team member creation completed successfully');

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Unexpected error in enhanced team member creation:', error);
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

serve(handler);