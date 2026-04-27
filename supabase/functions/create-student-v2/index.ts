import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.55.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CreateStudentRequest {
  email: string
  password: string
  full_name: string
  phone?: string
  address?: string
  mentor_id?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const requestData: CreateStudentRequest = await req.json()
    
    console.log('Creating student with data:', {
      email: requestData.email,
      full_name: requestData.full_name,
      phone: requestData.phone,
      mentor_id: requestData.mentor_id
    })

    // Call the database function
    const { data, error } = await supabase.rpc('create_student_complete', {
      p_email: requestData.email,
      p_password: requestData.password,
      p_full_name: requestData.full_name,
      p_phone: requestData.phone || null,
      p_address: requestData.address || null,
      p_mentor_id: requestData.mentor_id || null
    })

    if (error) {
      console.error('Database function error:', error)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database operation failed',
          details: error.message 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Student creation result:', data)

    // Check if the function returned an error
    if (data && !data.success) {
      return new Response(
        JSON.stringify(data),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    return new Response(
      JSON.stringify(data),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Unexpected error occurred',
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})