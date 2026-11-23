// Supabase Edge Function: verify-pickup-otp
// Validates the 4-digit customer pickup OTP server-side before transitioning ride to in_progress.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { ride_id, driver_id, otp_code } = await req.json();

  const { data: ownDriver } = await supabase
    .from('drivers')
    .select('driver_id')
    .eq('driver_id', driver_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!ownDriver) {
    return new Response(JSON.stringify({ error: 'Forbidden: driver mismatch' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: ride, error } = await supabase
    .from('rides')
    .select('*')
    .eq('ride_id', ride_id)
    .eq('driver_id', driver_id)
    .single();

  if (error || !ride) {
    return new Response(JSON.stringify({ error: 'Ride not found for driver' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (ride.status !== 'arrived' && ride.status !== 'accepted') {
    return new Response(JSON.stringify({ error: 'INVALID_STATE_TRANSITION' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const expectedHash = await sha256Hex(`${ride_id}:${otp_code}`);
  if (expectedHash !== ride.pickup_otp_hash) {
    return new Response(JSON.stringify({ error: 'INVALID_OTP' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: updated, error: updateErr } = await supabase
    .from('rides')
    .update({
      pickup_otp_verified: true,
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('ride_id', ride_id)
    .select('*')
    .single();

  if (updateErr) {
    return new Response(JSON.stringify({ error: updateErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ride: updated }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
