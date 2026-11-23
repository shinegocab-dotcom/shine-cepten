// Supabase Edge Function: complete-ride
// Completes an active ride server-side, computes platform commission, updates wallet & driver ride counter.
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

  const { ride_id, driver_id, actual_distance_km } = await req.json();

  const { data: ownDriver } = await supabase
    .from('drivers')
    .select('driver_id, total_rides')
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

  if (error || !ride || ride.status !== 'in_progress' || !ride.pickup_otp_verified) {
    return new Response(JSON.stringify({ error: 'Ride must be in_progress with verified OTP' }), {
      status: 409,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const finalFare = Number(ride.estimated_fare_inr);
  const commission = Math.round(finalFare * 0.15 * 100) / 100;
  const driverNet = Math.round((finalFare - commission) * 100) / 100;

  const { data: completedRide, error: updateErr } = await supabase
    .from('rides')
    .update({
      status: 'completed',
      final_fare_inr: finalFare,
      commission_inr: commission,
      driver_net_inr: driverNet,
      estimated_distance_km: actual_distance_km ?? ride.estimated_distance_km,
      payment_status: ride.payment_mode === 'cash' ? 'paid' : ride.payment_status,
      completed_at: new Date().toISOString(),
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

  // Reconcile driver ride counter and wallet ledger
  await supabase
    .from('drivers')
    .update({ total_rides: (ownDriver.total_rides ?? 0) + 1 })
    .eq('driver_id', driver_id);

  const { data: existingWallet } = await supabase
    .from('wallet_accounts')
    .select('*')
    .eq('driver_id', driver_id)
    .maybeSingle();

  const currentAvail = Number(existingWallet?.available_balance_inr ?? 0);
  const currentDues = Number(existingWallet?.cash_commission_due_inr ?? 0);

  await supabase.from('wallet_accounts').upsert(
    {
      driver_id,
      available_balance_inr: ride.payment_mode === 'cash' ? currentAvail : currentAvail + driverNet,
      cash_commission_due_inr: ride.payment_mode === 'cash' ? currentDues + commission : currentDues,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'driver_id' }
  );

  await supabase.from('wallet_transactions').insert({
    driver_id,
    ride_id,
    tx_type: ride.payment_mode === 'cash' ? 'commission_due' : 'ride_earning',
    amount_inr: ride.payment_mode === 'cash' ? -commission : driverNet,
    description:
      ride.payment_mode === 'cash'
        ? `Cash trip commission due for ride ${ride_id}`
        : `Net trip earning credited for ride ${ride_id}`,
  });

  return new Response(JSON.stringify({ ride: completedRide }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
