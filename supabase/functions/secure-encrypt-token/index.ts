import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Secure AES-256-GCM encryption
async function generateKey(): Promise<CryptoKey> {
  const encryptionSecret = Deno.env.get('ENCRYPTION_SECRET');
  
  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET environment variable is not configured. Please add it in Supabase Edge Functions secrets.');
  }
  
  // Use a consistent key derivation from environment
  const keyMaterial = new TextEncoder().encode(encryptionSecret);
  
  // Hash the key material to ensure it's 256 bits
  const keyHash = await crypto.subtle.digest('SHA-256', keyMaterial);
  
  return await crypto.subtle.importKey(
    'raw',
    keyHash,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(text: string): Promise<string> {
  const key = await generateKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const encodedText = new TextEncoder().encode(text);

  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    encodedText
  );

  // Combine IV and encrypted data, then base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode(...combined));
}

async function decrypt(encryptedText: string): Promise<string> {
  try {
    const key = await generateKey();
    const combined = Uint8Array.from(atob(encryptedText), c => c.charCodeAt(0));
    
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encrypted
    );

    return new TextDecoder().decode(decrypted);
  } catch (error) {
    throw new Error('Decryption failed - data may be corrupted or key is incorrect');
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, data } = await req.json()

    // Validate input
    if (!action || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing action or data parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'encrypt') {
      const encrypted = await encrypt(data);
      
      // Log encryption for audit purposes (without sensitive data)
      console.log('Token encrypted successfully', { 
        timestamp: new Date().toISOString(),
        dataLength: data.length 
      });
      
      return new Response(
        JSON.stringify({ encrypted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'decrypt') {
      const decrypted = await decrypt(data);
      
      // Log decryption for audit purposes (without sensitive data)
      console.log('Token decrypted successfully', { 
        timestamp: new Date().toISOString() 
      });
      
      return new Response(
        JSON.stringify({ decrypted }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "encrypt" or "decrypt".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Encryption service error:', error);
    return new Response(
      JSON.stringify({ error: 'Encryption service error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})