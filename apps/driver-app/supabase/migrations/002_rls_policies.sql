-- SHINE CAB Driver App Row Level Security & Private Storage Policies

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Helper function: resolve authenticated driver's driver_id
CREATE OR REPLACE FUNCTION public.current_driver_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT driver_id FROM public.drivers WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Users: authenticated users read/upsert their own user record
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY users_insert_own ON public.users
  FOR INSERT WITH CHECK (user_id = auth.uid() AND role = 'driver');

CREATE POLICY users_update_own ON public.users
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND role = 'driver');

-- Drivers: read/update only own profile (cannot self-approve admin_approved or kyc_status)
CREATE POLICY drivers_select_own ON public.drivers
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY drivers_insert_own ON public.drivers
  FOR INSERT WITH CHECK (user_id = auth.uid() AND admin_approved = false AND account_status = 'pending_setup');

CREATE POLICY drivers_update_own ON public.drivers
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Vehicles: driver manages own vehicles
CREATE POLICY vehicles_select_own ON public.vehicles
  FOR SELECT USING (driver_id = public.current_driver_id());

CREATE POLICY vehicles_write_own ON public.vehicles
  FOR ALL USING (driver_id = public.current_driver_id())
  WITH CHECK (driver_id = public.current_driver_id());

-- Private KYC Documents: driver reads/uploads only own documents
CREATE POLICY kyc_docs_own ON public.driver_documents
  FOR ALL USING (driver_id = public.current_driver_id())
  WITH CHECK (driver_id = public.current_driver_id());

-- Driver GPS Locations
CREATE POLICY driver_locations_own ON public.driver_locations
  FOR ALL USING (driver_id = public.current_driver_id())
  WITH CHECK (driver_id = public.current_driver_id());

-- Rides: drivers only see offered rides matching their category (if approved & online) or rides assigned to them
CREATE POLICY rides_driver_read ON public.rides
  FOR SELECT USING (
    driver_id = public.current_driver_id()
    OR (
      status = 'offered'
      AND driver_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.drivers d
        JOIN public.vehicles v ON v.driver_id = d.driver_id AND v.is_active = true
        WHERE d.driver_id = public.current_driver_id()
          AND d.admin_approved = true
          AND d.account_status = 'active'
          AND d.is_online = true
          AND v.verification_status = 'verified'
          AND v.category = rides.vehicle_category
      )
    )
  );

-- Ride Events: drivers can read their own events and log decline events
CREATE POLICY ride_events_select_own ON public.ride_events
  FOR SELECT USING (actor_driver_id = public.current_driver_id());

CREATE POLICY ride_events_insert_own ON public.ride_events
  FOR INSERT WITH CHECK (actor_driver_id = public.current_driver_id());

-- Wallet & Payouts: strict read-only for drivers; mutations happen exclusively via Edge Functions
CREATE POLICY wallet_select_own ON public.wallet_accounts
  FOR SELECT USING (driver_id = public.current_driver_id());

CREATE POLICY wallet_tx_select_own ON public.wallet_transactions
  FOR SELECT USING (driver_id = public.current_driver_id());

CREATE POLICY payouts_select_own ON public.payouts
  FOR SELECT USING (driver_id = public.current_driver_id());

-- Guard trigger preventing drivers from modifying admin-only compliance columns directly
CREATE OR REPLACE FUNCTION public.prevent_driver_self_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' THEN
    IF NEW.admin_approved IS DISTINCT FROM OLD.admin_approved
      OR NEW.vehicle_verified IS DISTINCT FROM OLD.vehicle_verified
      OR NEW.partner_rider_id IS DISTINCT FROM OLD.partner_rider_id
      OR (NEW.kyc_status = 'approved' AND OLD.kyc_status <> 'approved')
      OR (NEW.account_status = 'active' AND OLD.account_status <> 'active') THEN
      RAISE EXCEPTION 'FORBIDDEN_COMPLIANCE_MUTATION';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_driver_self_approval ON public.drivers;
CREATE TRIGGER trg_prevent_driver_self_approval
  BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_driver_self_approval();

-- Ratings, Notifications, Support, SOS
CREATE POLICY ratings_select_own ON public.ratings
  FOR SELECT USING (driver_id = public.current_driver_id());

CREATE POLICY ratings_customer_select_own ON public.ratings
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY ratings_customer_insert_completed ON public.ratings
  FOR INSERT WITH CHECK (
    customer_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.rides r
      WHERE r.ride_id = ratings.ride_id
        AND r.customer_id = auth.uid()
        AND r.driver_id = ratings.driver_id
        AND r.status = 'completed'
    )
  );

CREATE POLICY notifications_own ON public.notifications
  FOR ALL USING (driver_id = public.current_driver_id())
  WITH CHECK (driver_id = public.current_driver_id());

CREATE POLICY support_tickets_own ON public.support_tickets
  FOR ALL USING (driver_id = public.current_driver_id())
  WITH CHECK (driver_id = public.current_driver_id());

CREATE POLICY sos_alerts_own ON public.sos_alerts
  FOR ALL USING (driver_id = public.current_driver_id())
  WITH CHECK (driver_id = public.current_driver_id());

-- Private Storage Bucket Policies for KYC documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY kyc_storage_driver_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = public.current_driver_id()::text
  );

CREATE POLICY kyc_storage_driver_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = public.current_driver_id()::text
  );

-- Driver Profile Photos Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-avatars', 'driver-avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY driver_avatars_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-avatars'
    AND (storage.foldername(name))[1] = public.current_driver_id()::text
  );

CREATE POLICY driver_avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'driver-avatars'
    AND (storage.foldername(name))[1] = public.current_driver_id()::text
  );

CREATE POLICY driver_avatars_public_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'driver-avatars');
