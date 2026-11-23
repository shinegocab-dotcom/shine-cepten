# SHINE CAB DRIVER — API & Ecosystem Contract Documentation

## 1. Shared Identifiers Across SHINE CAB Apps

All three applications (**Customer App**, **Driver App**, and **Super Admin Panel**) share the exact same PostgreSQL primary keys:

| Identifier | Table | Usage |
| :--- | :--- | :--- |
| `user_id` | `public.users` | Mirrors `auth.users(id)` across Customer, Driver, and Admin roles |
| `driver_id` | `public.drivers` | Assigned to partner records, vehicles, KYC docs, rides, wallet, and payouts |
| `vehicle_id` | `public.vehicles` | Identifies Bike, Auto, or Cab associated with a ride |
| `customer_id` | `public.users` | Links the requesting rider on `public.rides` |
| `ride_id` | `public.rides` | Single authoritative ride entity subscribed to by Customer and Driver apps |

## 2. Driver Authentication & Onboarding Endpoints

- **Send Mobile OTP**: `supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })`
- **Verify Mobile OTP**: `supabase.auth.verifyOtp({ phone, token, type: 'sms' })`
- **Upsert Driver Personal Details**: `UPSERT public.drivers` on `user_id` (`profile_completed = true`)
- **Upsert Vehicle**: `UPSERT public.vehicles` on `(driver_id, registration_number)`
- **Upload Private KYC Document**: `supabase.storage.from('kyc-documents').upload('<driver_id>/<doc_type>_<ts>', file)` followed by `UPSERT public.driver_documents`
- **Submit KYC for Review**: Updates `drivers.documents_uploaded = true`, `kyc_status = 'under_review'`, `account_status = 'pending_approval'`

## 3. Edge Functions (Server-Side Authoritative Transitions)

### `POST /functions/v1/driver-approval` (Super Admin Panel Only)
- Validates `profile_completed`, `documents_uploaded`, and active `vehicles` record.
- Sets `vehicles.verification_status = 'verified'`, `drivers.vehicle_verified = true`, `kyc_status = 'approved'`, `admin_approved = true`, `account_status = 'active'`.

### `POST /functions/v1/accept-ride`
- Calls SQL RPC `public.accept_ride_atomic(p_ride_id, p_driver_id)`.
- Atomically updates `rides` where `status = 'offered' AND driver_id IS NULL`.
- Returns `200 OK` to the winning driver and `409 Conflict (RIDE_ALREADY_TAKEN)` to any competing driver.

### `POST /functions/v1/verify-pickup-otp`
- Verifies SHA-256 hash of `ride_id:otp_code` against `rides.pickup_otp_hash`.
- Transitions ride to `status = 'in_progress'`, `pickup_otp_verified = true`, and records `started_at`.

### `POST /functions/v1/complete-ride`
- Requires `status = 'in_progress'` and `pickup_otp_verified = true`.
- Calculates `final_fare_inr`, `commission_inr`, and `driver_net_inr` server-side and marks `status = 'completed'`.
