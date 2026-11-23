import assert from 'node:assert/strict';
import test from 'node:test';
import { SCREEN_DIRECTORY, SCREEN_TITLES } from '../components/screenDirectory.ts';
import type { DriverProfile, RideRecord, ScreenId, VehicleRecord } from '../contracts/types.ts';
import {
  canDriverGoOnline,
  canTransitionRideState,
  computeWeeklyGoalProgress,
  formatShortDriverId,
  generatePanDriverId,
  generateSixDigitOtp,
  sortLeaderboardCaptains,
  validateAdultDob,
  validateDriverCode,
  validateEmail,
  validateIfscCode,
  validateIndianPhone,
  validateUpiId,
  validateVehicleRegNumber,
  validateVehicleYear,
} from '../contracts/validators.ts';
import { getAllIntegrationStatuses, isFirebaseConfigured } from '../services/config.ts';
import { computeEarningsFromRides, mapFirebasePhoneAuthError } from '../services/driverBackendService.ts';

const baseDriver: DriverProfile = {
  driver_id: 'drv_001',
  user_id: 'usr_001',
  full_name: 'Ramesh Kumar',
  phone: '+919876543210',
  city: 'Bengaluru',
  profile_completed: true,
  documents_uploaded: true,
  vehicle_verified: true,
  kyc_status: 'approved',
  admin_approved: true,
  account_status: 'active',
  is_online: false,
  rating_average: null,
  total_rides: 0,
  created_at: '2026-11-20T00:00:00Z',
  updated_at: '2026-11-20T00:00:00Z',
};

const verifiedVehicle: VehicleRecord = {
  vehicle_id: 'veh_001',
  driver_id: 'drv_001',
  category: 'cab',
  make: 'Maruti',
  model: 'Dzire',
  year: 2024,
  color: 'White',
  registration_number: 'KA01AB1234',
  verification_status: 'verified',
  is_active: true,
};

test('allows online duty only when all 5 compliance gates and verified vehicle pass', () => {
  const result = canDriverGoOnline(baseDriver, verifiedVehicle);
  assert.equal(result.allowed, true);
  assert.equal(result.blockers.length, 0);
});

test('blocks online duty if admin approval or vehicle verification is missing', () => {
  const unapproved = canDriverGoOnline({ ...baseDriver, admin_approved: false }, verifiedVehicle);
  assert.equal(unapproved.allowed, false);
  assert.ok(unapproved.blockers.some((b) => b.includes('Super Admin approval')));

  const unverifiedVehicle = canDriverGoOnline(baseDriver, {
    ...verifiedVehicle,
    verification_status: 'pending',
  });
  assert.equal(unverifiedVehicle.allowed, false);
  assert.ok(unverifiedVehicle.blockers.some((b) => b.includes('Vehicle verification')));
});

test('enforces valid ride state machine transitions including searching -> accepted', () => {
  assert.equal(canTransitionRideState('searching', 'accepted'), true);
  assert.equal(canTransitionRideState('offered', 'accepted'), true);
  assert.equal(canTransitionRideState('arrived', 'in_progress'), true);
  assert.equal(canTransitionRideState('in_progress', 'completed'), true);
  assert.equal(canTransitionRideState('accepted', 'cancelled'), true);
  assert.equal(canTransitionRideState('in_progress', 'cancelled'), true);
  assert.equal(canTransitionRideState('offered', 'completed'), false);
  assert.equal(canTransitionRideState('completed', 'in_progress'), false);
  assert.equal(canTransitionRideState('completed', 'cancelled'), false);
});

test('validates Indian phone numbers, plates, UPI IDs, IFSC codes, emails, DOBs, and vehicle years', () => {
  assert.equal(validateIndianPhone('9876543210').valid, true);
  assert.equal(validateIndianPhone('9876543210').normalized, '+919876543210');
  assert.equal(validateIndianPhone('12345').valid, false);
  assert.equal(validateVehicleRegNumber('KA01AB1234'), true);
  assert.equal(validateVehicleRegNumber('24BH1234AB'), true);
  assert.equal(validateVehicleRegNumber('INVALID'), false);
  assert.equal(validateUpiId('ramesh.driver@okicici'), true);
  assert.equal(validateUpiId('invalid-upi'), false);
  assert.equal(validateIfscCode('SBIN0001234'), true);
  assert.equal(validateIfscCode('INVALID123'), false);
  assert.equal(validateEmail('captain@shine.in'), true);
  assert.equal(validateEmail('bad-email'), false);
  assert.equal(validateAdultDob('1995-05-15'), true);
  assert.equal(validateAdultDob('2015-05-15'), false);
  assert.equal(validateVehicleYear('2023'), true);
  assert.equal(validateVehicleYear('1980'), false);
});

test('computes accurate earnings summary from completed rides by payment channel', () => {
  const nowIso = new Date().toISOString();
  const sampleRides: RideRecord[] = [
    {
      ride_id: 'ride_1',
      customer_id: 'cust_1',
      driver_id: 'drv_001',
      vehicle_id: 'veh_001',
      vehicle_category: 'cab',
      status: 'completed',
      pickup_address: 'Indiranagar',
      pickup_lat: 12.9716,
      pickup_lng: 77.5946,
      dropoff_address: 'Koramangala',
      dropoff_lat: 12.9352,
      dropoff_lng: 77.6245,
      estimated_distance_km: 6.5,
      estimated_duration_min: 20,
      estimated_fare_inr: 200,
      final_fare_inr: 200,
      commission_inr: 30,
      driver_net_inr: 170,
      payment_mode: 'cash',
      payment_status: 'paid',
      pickup_otp_verified: true,
      created_at: nowIso,
      completed_at: nowIso,
    },
    {
      ride_id: 'ride_2',
      customer_id: 'cust_2',
      driver_id: 'drv_001',
      vehicle_id: 'veh_001',
      vehicle_category: 'cab',
      status: 'completed',
      pickup_address: 'MG Road',
      pickup_lat: 12.975,
      pickup_lng: 77.606,
      dropoff_address: 'Whitefield',
      dropoff_lat: 12.9698,
      dropoff_lng: 77.7499,
      estimated_distance_km: 15,
      estimated_duration_min: 40,
      estimated_fare_inr: 400,
      final_fare_inr: 400,
      commission_inr: 60,
      driver_net_inr: 340,
      payment_mode: 'online_upi',
      payment_status: 'paid',
      pickup_otp_verified: true,
      created_at: nowIso,
      completed_at: nowIso,
    },
  ];

  const summary = computeEarningsFromRides(sampleRides, 'daily');
  assert.equal(summary.completed_rides, 2);
  assert.equal(summary.gross_fare_inr, 600);
  assert.equal(summary.platform_commission_inr, 90);
  assert.equal(summary.net_earnings_inr, 510);
  assert.equal(summary.cash_collected_inr, 200);
  assert.equal(summary.online_payments_inr, 400);
  assert.equal(summary.online_hours, 1);
});

test('exposes all 30 unique driver screens in directory and title map', () => {
  const expectedScreens: ScreenId[] = [
    'splash',
    'onboarding',
    'login_otp',
    'registration',
    'personal_details',
    'vehicle_selection',
    'vehicle_details',
    'document_upload',
    'kyc_pending',
    'kyc_decision',
    'dashboard',
    'online_mode',
    'ai_copilot',
    'incoming_ride',
    'ride_accept_decision',
    'pickup_navigation',
    'customer_details',
    'pickup_otp',
    'active_ride',
    'ride_completion',
    'earnings',
    'wallet',
    'payout_history',
    'ride_history',
    'ratings',
    'top_captains',
    'notifications',
    'profile',
    'support',
    'emergency_sos',
  ];
  assert.equal(SCREEN_DIRECTORY.length, 30);
  for (const id of expectedScreens) {
    assert.ok(SCREEN_TITLES[id], `Missing title for screen: ${id}`);
  }
});

test('confirms Firebase backend & free OpenStreetMap/OSRM readiness matrix', () => {
  assert.equal(isFirebaseConfigured(), true);
  const statuses = getAllIntegrationStatuses();
  assert.equal(statuses.length, 7);
  const mapsStatus = statuses.find((s) => s.id === 'google_maps');
  assert.equal(mapsStatus?.configured, true);
  assert.ok(mapsStatus?.label.includes('OpenStreetMap'));
});

test('maps Firebase Phone Auth error codes into actionable diagnostics', () => {
  const opDisabled = mapFirebasePhoneAuthError({ code: 'auth/operation-not-allowed', message: 'OPERATION_NOT_ALLOWED' });
  assert.equal(opDisabled.firebaseCode, 'auth/operation-not-allowed');
  assert.ok(opDisabled.message.includes('Phone Sign-In'));

  const billing = mapFirebasePhoneAuthError({ code: 'auth/billing-not-enabled', message: 'BILLING_NOT_ENABLED' });
  assert.equal(billing.firebaseCode, 'auth/billing-not-enabled');
  assert.ok(billing.message.includes('Blaze'));

  const captcha = mapFirebasePhoneAuthError({ code: 'auth/captcha-check-failed', message: 'CAPTCHA_CHECK_FAILED' });
  assert.equal(captcha.firebaseCode, 'auth/captcha-check-failed');
  assert.ok(captcha.message.includes('Checkbox reCAPTCHA'));

  const expired = mapFirebasePhoneAuthError({ code: 'auth/code-expired', message: 'SMS code expired' });
  assert.equal(expired.firebaseCode, 'auth/code-expired');
  assert.equal(expired.isExpiredSession, true);

  const wrongCode = mapFirebasePhoneAuthError({ code: 'auth/invalid-verification-code', message: 'Invalid code' });
  assert.equal(wrongCode.firebaseCode, 'auth/invalid-verification-code');
  assert.equal(wrongCode.isExpiredSession, undefined);
});

test('generates 6-digit OTPs, PAN-style 10-char driver IDs, weekly goal progress, and Top Captains sort order', () => {
  const otp = generateSixDigitOtp();
  assert.match(otp, /^\d{6}$/);

  const panFromName = generatePanDriverId('uid_ramesh_01', 'Ramesh Kumar');
  assert.match(panFromName, /^SHNRA\d{4}[A-Z]$/);
  assert.equal(panFromName.length, 10);
  assert.equal(formatShortDriverId('uid123', 'SHNRA4829K'), 'SHNRA4829K');
  assert.match(formatShortDriverId('abc987xyz'), /^SHN[A-Z]{2}\d{4}[A-Z]$/);
  assert.equal(validateDriverCode('shnra4829k').valid, true);
  assert.equal(validateDriverCode('shnra4829k').normalized, 'SHNRA4829K');
  assert.equal(validateDriverCode('INVALID').valid, false);

  const progress = computeWeeklyGoalProgress(6500, 10000);
  assert.equal(progress.progressPct, 65);
  assert.equal(progress.remainingInr, 3500);
  assert.equal(progress.goalAchieved, false);

  const done = computeWeeklyGoalProgress(12000, 10000);
  assert.equal(done.progressPct, 100);
  assert.equal(done.goalAchieved, true);

  const rankedByEarn = sortLeaderboardCaptains(
    [
      {
        driver_id: 'd1',
        display_name: 'A',
        city: 'BLR',
        vehicle_category: 'cab',
        weekly_earnings_inr: 5000,
        weekly_rides: 10,
        rating_average: 4.9,
        total_rides: 20,
        updated_at: '2026-11-22T00:00:00Z',
      },
      {
        driver_id: 'd2',
        display_name: 'B',
        city: 'BLR',
        vehicle_category: 'auto',
        weekly_earnings_inr: 9200,
        weekly_rides: 18,
        rating_average: 4.6,
        total_rides: 35,
        updated_at: '2026-11-22T00:00:00Z',
      },
    ],
    'earnings'
  );
  assert.equal(rankedByEarn[0].driver_id, 'd2');

  const rankedByRating = sortLeaderboardCaptains(rankedByEarn, 'rating');
  assert.equal(rankedByRating[0].driver_id, 'd1');
});
