-- SHINE CAB Ecosystem Shared PostgreSQL Schema
-- Connects: Customer App, Driver App, Super Admin Panel

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Shared Users table (mirrors auth.users with ecosystem role)
CREATE TABLE IF NOT EXISTS public.users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'driver', 'admin')),
  phone TEXT UNIQUE NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Drivers table (shared driver_id across Customer, Driver & Admin apps)
CREATE TABLE IF NOT EXISTS public.drivers (
  driver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT NOT NULL,
  date_of_birth DATE,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  avatar_url TEXT,
  profile_completed BOOLEAN NOT NULL DEFAULT false,
  documents_uploaded BOOLEAN NOT NULL DEFAULT false,
  vehicle_verified BOOLEAN NOT NULL DEFAULT false,
  kyc_status TEXT NOT NULL DEFAULT 'not_submitted'
    CHECK (kyc_status IN ('not_submitted', 'pending', 'under_review', 'approved', 'rejected')),
  kyc_rejection_reason TEXT,
  admin_approved BOOLEAN NOT NULL DEFAULT false,
  account_status TEXT NOT NULL DEFAULT 'pending_setup'
    CHECK (account_status IN ('pending_setup', 'pending_approval', 'active', 'suspended', 'rejected')),
  partner_rider_id TEXT UNIQUE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  active_vehicle_id UUID,
  rating_average NUMERIC(3,2),
  total_rides INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT driver_online_requires_approval CHECK (
    is_online = false OR (
      profile_completed = true AND
      documents_uploaded = true AND
      vehicle_verified = true AND
      kyc_status = 'approved' AND
      admin_approved = true AND
      account_status = 'active'
    )
  )
);

-- 3. Vehicles table (Bike / Auto / Cab)
CREATE TABLE IF NOT EXISTS public.vehicles (
  vehicle_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bike', 'auto', 'cab')),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  color TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  permit_number TEXT,
  insurance_expiry DATE,
  rc_expiry DATE,
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, registration_number)
);

-- 4. Private KYC Documents table
CREATE TABLE IF NOT EXISTS public.driver_documents (
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (
    document_type IN (
      'driving_license',
      'vehicle_rc',
      'vehicle_insurance',
      'vehicle_permit',
      'vehicle_puc',
      'vehicle_photo',
      'aadhaar_or_national_id',
      'pan_card',
      'driver_selfie'
    )
  ),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (status IN ('not_uploaded', 'pending_review', 'verified', 'rejected')),
  rejection_reason TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (driver_id, document_type)
);

-- 5. Live Driver GPS Locations
CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION,
  speed_kmh INTEGER,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Shared Rides table (Customer creates -> Driver accepts atomically)
CREATE TABLE IF NOT EXISTS public.rides (
  ride_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.users(user_id),
  driver_id UUID REFERENCES public.drivers(driver_id),
  vehicle_id UUID REFERENCES public.vehicles(vehicle_id),
  vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('bike', 'auto', 'cab')),
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'offered', 'accepted', 'arriving', 'arrived', 'in_progress', 'completed', 'cancelled')),
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  estimated_distance_km NUMERIC(8,2) NOT NULL,
  estimated_duration_min INTEGER NOT NULL,
  estimated_fare_inr NUMERIC(10,2) NOT NULL,
  final_fare_inr NUMERIC(10,2),
  commission_inr NUMERIC(10,2),
  driver_net_inr NUMERIC(10,2),
  payment_mode TEXT NOT NULL DEFAULT 'cash' CHECK (payment_mode IN ('cash', 'online_upi', 'card', 'wallet')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  pickup_otp_hash TEXT NOT NULL,
  pickup_otp_verified BOOLEAN NOT NULL DEFAULT false,
  offer_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- 7. Ride Events Audit Trail
CREATE TABLE IF NOT EXISTS public.ride_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(ride_id) ON DELETE CASCADE,
  actor_driver_id UUID REFERENCES public.drivers(driver_id),
  event_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Driver Wallet & Payouts
CREATE TABLE IF NOT EXISTS public.wallet_accounts (
  wallet_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID UNIQUE NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  available_balance_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  pending_settlement_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_commission_due_inr NUMERIC(12,2) NOT NULL DEFAULT 0,
  bank_account_verified BOOLEAN NOT NULL DEFAULT false,
  bank_account_masked TEXT,
  upi_id TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payouts (
  payout_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  amount_inr NUMERIC(12,2) NOT NULL CHECK (amount_inr > 0),
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'processing', 'settled', 'failed')),
  provider_reference TEXT,
  destination_label TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);

-- 9. Ratings, Notifications, Support & Emergency SOS
CREATE TABLE IF NOT EXISTS public.ratings (
  rating_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID UNIQUE NOT NULL REFERENCES public.rides(ride_id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.users(user_id),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id),
  stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment TEXT,
  feedback_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automatically recalculate drivers.rating_average whenever a customer submits/updates a rating
CREATE OR REPLACE FUNCTION public.sync_driver_rating_average()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id UUID;
BEGIN
  v_driver_id := COALESCE(NEW.driver_id, OLD.driver_id);
  UPDATE public.drivers
  SET
    rating_average = (
      SELECT ROUND(AVG(stars)::numeric, 2)
      FROM public.ratings
      WHERE driver_id = v_driver_id
    ),
    updated_at = now()
  WHERE driver_id = v_driver_id;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_driver_rating_average ON public.ratings;
CREATE TRIGGER trg_sync_driver_rating_average
  AFTER INSERT OR UPDATE OR DELETE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.sync_driver_rating_average();

CREATE TABLE IF NOT EXISTS public.notifications (
  notification_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('kyc', 'ride', 'payout', 'system', 'safety')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_tickets (
  ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  ride_id UUID REFERENCES public.rides(ride_id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sos_alerts (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  ride_id UUID REFERENCES public.rides(ride_id),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  status TEXT NOT NULL DEFAULT 'triggered' CHECK (status IN ('triggered', 'acknowledged', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atomic Ride Acceptance RPC (prevents race condition when multiple drivers tap Accept)
CREATE OR REPLACE FUNCTION public.accept_ride_atomic(
  p_ride_id UUID,
  p_driver_id UUID
)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver public.drivers;
  v_vehicle public.vehicles;
  v_ride public.rides;
BEGIN
  SELECT * INTO v_driver FROM public.drivers WHERE driver_id = p_driver_id;
  IF NOT FOUND OR v_driver.admin_approved = false OR v_driver.account_status <> 'active' OR v_driver.is_online = false THEN
    RAISE EXCEPTION 'DRIVER_NOT_ELIGIBLE';
  END IF;

  SELECT * INTO v_vehicle FROM public.vehicles
  WHERE driver_id = p_driver_id AND is_active = true AND verification_status = 'verified'
  LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'VEHICLE_NOT_VERIFIED';
  END IF;

  UPDATE public.rides
  SET
    driver_id = p_driver_id,
    vehicle_id = v_vehicle.vehicle_id,
    status = 'accepted'
  WHERE ride_id = p_ride_id
    AND status = 'offered'
    AND driver_id IS NULL
    AND vehicle_category = v_vehicle.category
  RETURNING * INTO v_ride;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'RIDE_ALREADY_TAKEN';
  END IF;

  INSERT INTO public.ride_events (ride_id, actor_driver_id, event_type)
  VALUES (p_ride_id, p_driver_id, 'ride_accepted_atomically');

  RETURN v_ride;
END;
$$;

-- 10. Wallet Transactions Audit Ledger
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  tx_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(driver_id) ON DELETE CASCADE,
  ride_id UUID REFERENCES public.rides(ride_id) ON DELETE SET NULL,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('ride_earning', 'commission_due', 'payout_debit', 'dues_settlement')),
  amount_inr NUMERIC(12,2) NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Driver Earnings Summary RPC (daily / weekly / monthly)
CREATE OR REPLACE FUNCTION public.get_driver_earnings_summary(
  p_driver_id UUID,
  p_period TEXT DEFAULT 'daily'
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_start TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF p_period = 'weekly' THEN
    v_start := date_trunc('week', now());
  ELSIF p_period = 'monthly' THEN
    v_start := date_trunc('month', now());
  ELSE
    v_start := date_trunc('day', now());
  END IF;

  SELECT jsonb_build_object(
    'period', CASE WHEN p_period IN ('daily', 'weekly', 'monthly') THEN p_period ELSE 'daily' END,
    'gross_fare_inr', COALESCE(SUM(final_fare_inr), 0),
    'platform_commission_inr', COALESCE(SUM(commission_inr), 0),
    'net_earnings_inr', COALESCE(SUM(driver_net_inr), 0),
    'cash_collected_inr', COALESCE(SUM(CASE WHEN payment_mode = 'cash' THEN final_fare_inr ELSE 0 END), 0),
    'online_payments_inr', COALESCE(SUM(CASE WHEN payment_mode <> 'cash' THEN final_fare_inr ELSE 0 END), 0),
    'completed_rides', COUNT(*),
    'online_hours', ROUND(COALESCE(SUM(estimated_duration_min), 0)::numeric / 60.0, 2),
    'currency', 'INR'
  )
  INTO v_result
  FROM public.rides
  WHERE driver_id = p_driver_id
    AND status = 'completed'
    AND completed_at >= v_start;

  RETURN v_result;
END;
$$;
