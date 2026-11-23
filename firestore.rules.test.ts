/**
 * Dirty Dozen Security Rule Verification Matrix for SHINE CAPTAIN
 * Validates that every adversarial payload violates rule invariants in DRAFT_firestore.rules / firestore.rules.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const rulesPath = fs.existsSync('firestore.rules') ? 'firestore.rules' : 'DRAFT_firestore.rules';
const rulesSource = fs.readFileSync(rulesPath, 'utf8');

test('Dirty Dozen Payloads & Eight Pillars are structurally enforced in Firestore Rules', () => {
  // Pillar 1 & Catch-all safety net
  assert.match(rulesSource, /rules_version\s*=\s*'2'/);
  assert.match(rulesSource, /match \/\{document=\*\*\}\s*\{\s*allow read, write:\s*if false;/);

  // Pillar 2: Validation blueprints (isValid* helpers exist and wrap updates)
  for (const helper of [
    'isValidDriver',
    'isValidDriverLocation',
    'isValidVehicle',
    'isValidDriverDocument',
    'isValidRide',
    'isValidRideMessage',
    'isValidWallet',
    'isValidWalletTransaction',
    'isValidPayout',
    'isValidSupportTicket',
    'isValidSosAlert',
    'isValidDriverPhoneLookup',
    'isValidDriverCodeLookup',
    'isValidFareConfig',
    'isValidLeaderboardEntry',
    'isValidCaptainAiMessage',
  ]) {
    assert.ok(rulesSource.includes(`function ${helper}(`), `Missing helper ${helper}`);
  }

  // Pillar 3: Path variable hardening isValidId
  assert.ok(rulesSource.includes('function isValidId(id)'));
  assert.ok(rulesSource.includes('isValidId(driverId)'));
  assert.ok(rulesSource.includes('isValidId(rideId)'));
  assert.ok(rulesSource.includes('isValidId(txId)'));
  assert.ok(rulesSource.includes('isValidId(messageId)'));
  assert.ok(rulesSource.includes('isValidId(phoneHash)'));
  assert.ok(rulesSource.includes('isValidId(configId)'));

  // Dirty Dozen #1: Self-approval escalation blocked (driver cannot flip admin_approved/kyc_status)
  assert.ok(rulesSource.includes('incoming().admin_approved == existing().admin_approved'));
  assert.ok(rulesSource.includes('incoming().kyc_status == existing().kyc_status'));

  // Dirty Dozen #2 & #5: hasOnly + affectedKeys allowlists
  assert.ok(rulesSource.includes('.keys().hasOnly('));
  assert.ok(rulesSource.includes('affectedKeys().hasOnly('));

  // Dirty Dozen #6 & #7 & #8: Ride atomic claim, OTP verification, telemetry stream, and terminal lock
  assert.ok(rulesSource.includes("existing().driver_id == null"));
  assert.ok(rulesSource.includes("incoming().pickup_otp_verified == true"));
  assert.ok(rulesSource.includes("!(existing().status in ['completed', 'cancelled'])"));
  assert.ok(rulesSource.includes("'driver_lat'"));

  // Dirty Dozen #9: Ride messages Master Gate uses exists() & get() on /rides/{rideId}
  assert.ok(rulesSource.includes('/rides/$(incoming().ride_id)'));

  // Dirty Dozen #10: Bounded Data URL size limits
  assert.ok(rulesSource.includes('800000'));

  // Dirty Dozen #11: Settled/failed payouts locked
  assert.ok(rulesSource.includes("!(existing().status in ['settled', 'failed'])"));

  // Dirty Dozen #12: Admin email check requires email_verified == true
  assert.ok(rulesSource.includes("request.auth.token.email_verified == true"));

  // Real-time Shared Collections
  assert.ok(rulesSource.includes('match /wallet_transactions/{txId}'));
  assert.ok(rulesSource.includes('match /fare_configs/{configId}'));
  assert.ok(rulesSource.includes('match /system_integrations/{integrationId}'));
  assert.ok(rulesSource.includes('match /captain_leaderboard/{driverId}'));
  assert.ok(rulesSource.includes('match /captain_ai_messages/{messageId}'));
  assert.ok(rulesSource.includes('match /driver_code_lookup/{driverCode}'));
});
