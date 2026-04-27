import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  target_email: string;
  target_password: string;
  target_role: string;
  target_full_name?: string;
  target_metadata?: any;
}

// Secure password hashing using bcrypt-like approach
async function hashPassword(password: string): Promise<string> {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  
  // Combine password and salt
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltedPassword = new Uint8Array(passwordData.length + salt.length);
  saltedPassword.set(passwordData);
  saltedPassword.set(salt, passwordData.length);
  
  // Hash with SHA-256 (multiple rounds for security)
  let hash = await crypto.subtle.digest('SHA-256', saltedPassword);
  
  // Perform additional rounds for security (similar to bcrypt work factor)
  for (let i = 0; i < 1000; i++) {
    const combined = new Uint8Array(hash.byteLength + salt.length);
    combined.set(new Uint8Array(hash));
    combined.set(salt, hash.byteLength);
    hash = await crypto.subtle.digest('SHA-256', combined);
  }
  
  // Encode salt + hash as base64
  const result = new Uint8Array(salt.length + hash.byteLength);
  result.set(salt);
  result.set(new Uint8Array(hash), salt.length);
  
  return btoa(String.fromCharCode(...result));
}

// Input validation and sanitization
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: "Password must be at least 8 characters long" };
  }
  if (password.length > 128) {
    return { valid: false, message: "Password must be less than 128 characters" };
  }
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter, one lowercase letter, and one number" };
  }
  return { valid: true };
}

function sanitizeInput(input: string): string {
  // Remove potentially dangerous characters
  return input.replace(/[<>'"&]/g, '').trim();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    console.log('Secure user creation started');

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

    const requestData: CreateUserRequest = await req.json();
    
    // Input validation and sanitization
    if (!requestData.target_email || !requestData.target_password || !requestData.target_role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate email
    if (!validateEmail(requestData.target_email)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password
    const passwordValidation = validatePassword(requestData.target_password);
    if (!passwordValidation.valid) {
      return new Response(
        JSON.stringify({ error: passwordValidation.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize inputs
    const email = sanitizeInput(requestData.target_email.toLowerCase());
    const fullName = requestData.target_full_name ? sanitizeInput(requestData.target_full_name) : '';
    const role = sanitizeInput(requestData.target_role);

    // Validate role
    if (!['superadmin', 'admin', 'enrollment_manager', 'mentor', 'student'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check permissions using the existing function
    const { data: permissionCheck, error: permissionError } = await supabaseAdmin
      .rpc('create_user_with_role', {
        target_email: email,
        target_password: requestData.target_password,
        target_role: role,
        target_full_name: fullName,
        target_metadata: requestData.target_metadata || {}
      });

    if (permissionError || permissionCheck?.error) {
      return new Response(
        JSON.stringify({ error: permissionCheck?.error || permissionError?.message }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Hash password securely
    const passwordHash = await hashPassword(requestData.target_password);

    // Create user in auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: requestData.target_password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role
      }
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return new Response(
        JSON.stringify({ error: `Failed to create auth user: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user profile with secure password hash
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email,
        full_name: fullName,
        role,
        password_hash: passwordHash,
        status: 'active',
        is_temp_password: false,
        last_password_change: new Date().toISOString()
      })
      .select()
      .single();

    if (profileError) {
      console.error('Profile creation error:', profileError);
      // Cleanup auth user
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      return new Response(
        JSON.stringify({ error: `Failed to create user profile: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log successful creation
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        entity_type: 'user',
        entity_id: authUser.user.id,
        action: 'created',
        description: `Secure user creation: ${email} with role ${role}`,
        performed_by: authUser.user.id,
        data: {
          email,
          role,
          creation_method: 'secure_edge_function'
        }
      });

    console.log('Secure user creation completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: authUser.user.id,
          email,
          full_name: fullName,
          role,
          created_at: userProfile.created_at
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Secure user creation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

serve(handler);