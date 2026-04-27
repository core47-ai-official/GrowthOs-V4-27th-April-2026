import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.55.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CreateMemberRequest {
  email: string;
  full_name: string;
  role: string;
  temp_password: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log("Create team member function called");

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Create a Supabase client with service role key for admin operations
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

    const { email, full_name, role, temp_password }: CreateMemberRequest = await req.json();

    // Generate LMS password for students
    const generateSecurePassword = (): string => {
      const length = Math.floor(Math.random() * 5) + 8; // 8-12 characters
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      const numbers = '0123456789';
      const special = '!@#$%^&*';
      
      // Ensure at least one character from each type
      let password = '';
      password += uppercase[Math.floor(Math.random() * uppercase.length)];
      password += lowercase[Math.floor(Math.random() * lowercase.length)];
      password += numbers[Math.floor(Math.random() * numbers.length)];
      password += special[Math.floor(Math.random() * special.length)];
      
      // Fill the rest randomly
      const allChars = uppercase + lowercase + numbers + special;
      for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
      }
      
      // Shuffle the password
      return password.split('').sort(() => Math.random() - 0.5).join('');
    };

    const lmsPassword = role === 'student' ? generateSecurePassword() : null;

    console.log(`Welcome email handler fired - Creating ${role} user: ${email}`);

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('Invalid email format:', email);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid email format. Please provide a valid email address.'
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUser.users.find(user => user.email === email);
    
    if (userExists) {
      console.log('User already exists with email:', email);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `A user with email ${email} already exists. Please use a different email address.`
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    // Create auth user with admin client
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: temp_password,
      email_confirm: true,
      user_metadata: {
        full_name
      }
    });

    if (authError) {
      console.error('Auth creation error:', authError);
      
      // Handle specific auth errors with user-friendly messages
      let errorMessage = 'Failed to create user account';
      if (authError.message.includes('already been registered')) {
        errorMessage = `A user with email ${email} already exists. Please use a different email address.`;
      } else if (authError.message.includes('password')) {
        errorMessage = 'Password does not meet requirements';
      }
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      });
    }

    console.log('Auth user created successfully:', authData.user.id);

    // Get current user for created_by field
    const authHeader = req.headers.get('Authorization');
    let createdBy = null;
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      createdBy = user?.id;
    }

    // Insert user profile in the users table
    const userInsertData: any = {
      id: authData.user.id,
      full_name,
      email,
      role,
      status: 'Active',
      password_display: temp_password, // Store for credential viewing
      password_hash: temp_password, // Store password hash
      created_by: createdBy // Set who created this user
    };

    // Add LMS credentials for students
    if (role === 'student' && lmsPassword) {
      userInsertData.lms_user_id = email;
      userInsertData.lms_password = lmsPassword;
      userInsertData.lms_status = 'inactive'; // Inactive until first payment
    }

    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert(userInsertData);

    if (insertError) {
      console.error('User profile insert error:', insertError);
      throw insertError;
    }

    console.log('User profile updated successfully');

    // Log successful user creation for email trigger debugging
    console.log('Team member created successfully:', {
      userId: authData.user.id,
      email: email,
      role: role,
      fullName: full_name
    });

    const responseData: any = { 
      success: true, 
      message: "Team member created successfully",
      user_id: authData.user.id 
    };

    // Include LMS password in response for students
    if (role === 'student' && lmsPassword) {
      responseData.lmsPassword = lmsPassword;
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in create-team-member function:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);