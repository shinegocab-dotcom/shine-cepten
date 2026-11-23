# SHINE CAB DRIVER — Future Backend Integration Guide

## 1. Connecting the Shared Supabase Project

1. Run SQL migrations in `apps/driver-app/supabase/migrations/` in order:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
2. Deploy Edge Functions from `apps/driver-app/supabase/functions/`:
   - `accept-ride`
   - `verify-pickup-otp`
   - `complete-ride`
   - `driver-approval`
3. Add client-safe environment variables to `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

> **Security Rule**: Never place `SUPABASE_SERVICE_ROLE_KEY`, Razorpay secret keys, or payout webhook secrets in frontend `.env` variables.

## 2. Optional Third-Party Adapter Configuration

| Integration | Adapter File | Required Frontend Env Vars | Server-Side Secret Location |
| :--- | :--- | :--- | :--- |
| **Google Maps** | `services/adapters/externalAdapters.ts` | `VITE_GOOGLE_MAPS_API_KEY` | Edge Function `compute-route` |
| **Firebase FCM** | `services/adapters/externalAdapters.ts` | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_VAPID_KEY` | Edge Function notification dispatcher |
| **Razorpay Dues** | `services/adapters/externalAdapters.ts` | `VITE_RAZORPAY_KEY_ID` | Edge Function `create-dues-order` (`RAZORPAY_KEY_SECRET`) |
| **SMS / OTP** | `services/driverBackendService.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase Auth Phone Provider |
| **Live GPS** | `services/adapters/locationAdapter.ts` | None (Browser `navigator.geolocation`) | Synced to `driver_locations` |
| **Bank Payouts** | `services/adapters/externalAdapters.ts` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Edge Function `request-driver-payout` |

## 3. Verification Checklist Before Production Release

- Confirm unapproved drivers cannot toggle `drivers.is_online = true` (enforced by both `canDriverGoOnline()` and the PostgreSQL `driver_online_requires_approval` constraint).
- Confirm KYC documents are stored in the private `kyc-documents` bucket with folder-scoped RLS policies.
- Confirm ride acceptance handles HTTP `409 RIDE_ALREADY_TAKEN` gracefully.
