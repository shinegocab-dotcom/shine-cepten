# SHINE CAB DRIVER — Architecture Overview

## Folder Layout (`apps/driver-app/`)

- `branding/` — Original SVG logos (`shine-cab-driver-logo-light.svg`, `shine-cab-driver-logo-dark.svg`, `shine-cab-driver-icon.svg`), React `BrandLogo`, and shared design tokens.
- `contracts/` — Shared TypeScript interfaces (`types.ts`, `api.ts`, `integrations.ts`) and pure workflow validators (`validators.ts`).
- `services/` — Null-safe Supabase client (`supabaseClient.ts`), environment readiness detector (`config.ts`), backend contract implementation (`driverBackendService.ts`), and modular adapters (`adapters/locationAdapter.ts`, `adapters/externalAdapters.ts`).
- `state/` — `DriverAppContext.tsx` managing navigation stack, light/dark theme, active/completed ride state, real GPS capture, and backend data synchronization.
- `components/` — Responsive `AppShell`, `OnlineToggle`, `UiPrimitives`, and `screenDirectory.ts`.
- `screens/` — All 28 screens grouped by domain (`AuthOnboardingScreens`, `KycOnboardingScreens`, `DispatchScreens`, `ActiveTripScreens`, `FinanceHistoryScreens`, `AccountSafetyScreens`).
- `supabase/` — Shared PostgreSQL schema (`001_initial_schema.sql`), RLS & private bucket policies (`002_rls_policies.sql`), and Deno Edge Functions (`accept-ride`, `verify-pickup-otp`, `complete-ride`, `driver-approval`).
- `docs/` — API documentation, backend integration guide, and architecture reference.
- `tests/` — Deterministic Node/TSX workflow & fail-closed contract tests.
