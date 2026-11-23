# SHINE CAPTAIN Security Specification (Payload-First Security TDD)

## 1. Data Invariants
1. **Identity Integrity (`drivers`, `wallet_accounts`, `driver_locations`, `vehicles`, `driver_documents`)**: Every driver-owned document must match `request.auth.uid` for creation/ownership. Drivers cannot self-approve (`admin_approved: true`, `kyc_status: 'approved'`, `account_status: 'active'`, `vehicle_verified: true`, `partner_rider_id`) — only Admins can grant approval.
2. **PII Isolation (`drivers`, `wallet_accounts`)**: Personal phone numbers, emails, DOBs, emergency contacts, bank accounts, and UPI IDs are readable only by the owning driver or an Admin (`isOwner(driverId) || isAdmin()`). Live map telemetry lives in non-PII `driver_locations`.
3. **Atomic Dispatch & Ride State Machine (`rides`)**:
   - Rides transition strictly forward (`searching/offered/requested -> accepted -> arrived -> in_progress -> completed | cancelled`).
   - Only a ride with `driver_id == null` and `status in ['searching', 'offered', 'requested']` can be claimed by a driver (`driver_id == request.auth.uid`), preventing double-claims.
   - `in_progress` requires `pickup_otp_verified == true` and matching `pickup_otp` if set on the ride document.
   - `completed` and `cancelled` are **terminal states** locked against any non-admin client mutations.
4. **Master Gate Chat Integrity (`ride_messages`)**: A chat message cannot exist without an existing parent `/rides/{ride_id}` document where the sender is the ride's `driver_id`, `customer_id`, or an Admin.
5. **Temporal Integrity & Size Bounds**: Every string and Data URL (`file_url <= 800000` chars) enforces strict `.size()` bounds, IDs enforce `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and server timestamps (`request.time`) are enforced on create/update timestamp fields.
6. **Admin Authentication Guard**: Bootstrapped admin (`ma94646445@gmail.com`) requires `request.auth.token.email_verified == true`, or membership in `/admins/{uid}`.

## 2. The "Dirty Dozen" Attack Payloads
1. **Self-Approval Escalation (`drivers`)**: Driver updates their own profile with `{"admin_approved": true, "kyc_status": "approved", "account_status": "active", "partner_rider_id": "FAKE-999"}`. -> **PERMISSION_DENIED**
2. **Shadow Ghost Field Injection (`drivers`)**: Driver creates profile with undocumented `"isAdmin": true` ghost field. -> **PERMISSION_DENIED**
3. **Cross-Driver PII Read (`drivers/{otherId}`)**: Authenticated Driver A attempts `get()` on Driver B's profile document. -> **PERMISSION_DENIED**
4. **Blanket Unscoped List Scraping (`drivers`, `driver_documents`, `wallet_accounts`)**: Driver attempts unscoped collection `list()` without owner constraint. -> **PERMISSION_DENIED**
5. **ID Poisoning (`driver_documents`)**: Client tries to write a document with a 300-character or `../` poisoned path variable ID. -> **PERMISSION_DENIED**
6. **Stolen Ride Hijack (`rides`)**: Driver B tries to overwrite `driver_id` on a ride already `'accepted'` by Driver A. -> **PERMISSION_DENIED**
7. **OTP Bypass State Shortcut (`rides`)**: Driver tries to update an `'accepted'` ride directly to `'in_progress'` with `pickup_otp_verified: false` or wrong `pickup_otp`. -> **PERMISSION_DENIED**
8. **Terminal Ride Tampering (`rides`)**: Driver attempts to modify `final_fare_inr` or `status` on a ride whose status is already `'completed'`. -> **PERMISSION_DENIED**
9. **Orphaned / Unauthorized Chat (`ride_messages`)**: Driver C tries to post a message referencing a non-existent `ride_id` or a ride belonging to Driver A. -> **PERMISSION_DENIED**
10. **Denial-of-Wallet Oversized String (`driver_documents`)**: Client writes a >1MB junk string into `file_name` or `file_url`. -> **PERMISSION_DENIED**
11. **Terminal Payout Manipulation (`payouts`)**: Driver tries to update a `'settled'` payout status back to `'initiated'` or inflate `amount_inr`. -> **PERMISSION_DENIED**
12. **Unverified Admin Spoof (`admins` / `drivers`)**: Attacker signs in with matching admin email where `email_verified == false` and tries an admin update. -> **PERMISSION_DENIED**
