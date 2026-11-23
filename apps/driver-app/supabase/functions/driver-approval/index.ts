// Supabase Edge Function: driver-approval (Super Admin Panel only)
// Verifies profile, documents, and vehicle before enabling admin_approved + active status.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

  const { data: adminUser } = await supabase
    .from('users')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (adminUser?.role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Forbidden: Super Admin role required' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { driver_id, decision, rejection_reason } = await req.json();
  if (!driver_id || (decision !== 'approve' && decision !== 'reject')) {
    return new Response(JSON.stringify({ error: 'Invalid approval payload' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (decision === 'reject') {
    const { data, error } = await supabase
      .from('drivers')
      .update({
        admin_approved: false,
        kyc_status: 'rejected',
        kyc_rejection_reason: rejection_reason || 'KYC verification declined by administrator.',
        account_status: 'rejected',
        is_online: false,
      })
      .eq('driver_id', driver_id)
      .select('*')
      .single();
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ driver: data }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: driver } = await supabase.from('drivers').select('*').eq('driver_id', driver_id).single();
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('driver_id', driver_id)
    .eq('is_active', true)
    .maybeSingle();

  if (!driver?.profile_completed || !driver?.documents_uploaded || !vehicle) {
    return new Response(
      JSON.stringify({ error: 'Driver profile, KYC documents, and vehicle must be completed before approval.' }),
      { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  await supabase.from('vehicles').update({ verification_status: 'verified' }).eq('vehicle_id', vehicle.vehicle_id);
  await supabase
    .from('driver_documents')
    .update({ status: 'verified' })
    .eq('driver_id', driver_id);

  const partnerRiderId =
    driver.partner_rider_id ||
    `SC-DRV-${String(driver_id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  const { data: approvedDriver, error } = await supabase
    .from('drivers')
    .update({
      vehicle_verified: true,
      kyc_status: 'approved',
      kyc_rejection_reason: null,
      admin_approved: true,
      account_status: 'active',
      active_vehicle_id: vehicle.vehicle_id,
      partner_rider_id: partnerRiderId,
    })
    .eq('driver_id', driver_id)
    .select('*')
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ driver: approvedDriver }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
