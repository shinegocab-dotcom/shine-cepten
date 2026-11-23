import {
  browserLocalPersistence,
  RecaptchaVerifier,
  setPersistence,
  signInAnonymously,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut as firebaseSignOut,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  AcceptRideResponse,
  CompleteRidePayload,
  DriverBackendContract,
  DriverRegistrationPayload,
  PayoutMethodPayload,
  SendRideMessagePayload,
  VehicleUpsertPayload,
  VerifyPickupOtpPayload,
} from '../contracts/api';
import type {
  CaptainLeaderboardEntry,
  DriverDocumentRecord,
  DriverIdLookupResult,
  DriverNotification,
  DriverProfile,
  DriverRatingRecord,
  EarningsSummary,
  FareConfigRecord,
  GeoPoint,
  PayoutRecord,
  PhoneOtpLoginResult,
  RideMessageRecord,
  RideRecord,
  ServiceResult,
  SosAlertRecord,
  SupportTicket,
  SystemIntegrationLiveKeys,
  VehicleCategory,
  VehicleRecord,
  WalletAccount,
  WalletTransactionRecord,
} from '../contracts/types';
import {
  canDriverGoOnline,
  formatShortDriverId,
  generatePanDriverId,
  sortLeaderboardCaptains,
  validateDriverCode,
  validateIndianPhone,
} from '../contracts/validators';
import { backendNotConfigured } from './config';
import {
  firebaseConfig,
  getFirebaseAuth,
  getFirebaseDb,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
  tsToIso,
} from './firebaseClient';
import { compressFileToFirestoreDataUrl } from './imageCompressor';

let pendingConfirmation: ConfirmationResult | null = null;
let cachedRecaptcha: RecaptchaVerifier | null = null;
let lastRecaptchaContainerId = 'shine-recaptcha-container';

function clearRecaptchaSession(containerId = lastRecaptchaContainerId): void {
  if (cachedRecaptcha) {
    try {
      cachedRecaptcha.clear();
    } catch {
      // Ignore clear failures when DOM element has unmounted
    }
    cachedRecaptcha = null;
  }
  if (typeof document !== 'undefined') {
    const existingEl = document.getElementById(containerId);
    if (existingEl) {
      existingEl.innerHTML = '';
    }
  }
}

export function mapFirebasePhoneAuthError(err: unknown): {
  firebaseCode: string;
  message: string;
  isExpiredSession?: boolean;
} {
  const rawCode =
    err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code || '') : '';
  const rawMsg = err instanceof Error ? err.message : String(err || 'Phone authentication failed.');
  const lower = `${rawCode} ${rawMsg}`.toLowerCase();

  if (
    rawCode === 'auth/operation-not-allowed' ||
    rawCode === 'auth/admin-restricted-operation' ||
    lower.includes('operation-not-allowed') ||
    lower.includes('admin-restricted-operation')
  ) {
    return {
      firebaseCode: rawCode || 'auth/operation-not-allowed',
      message:
        `Firebase Project "${firebaseConfig.projectId}" par Phone Sign-In ya Anonymous Auth abhi disabled hai. Firebase Console me ise Enable karein ya niche "Continue with Google (+ Link Mobile)" se instant verify karein.`,
    };
  }
  if (rawCode === 'auth/billing-not-enabled' || lower.includes('billing-not-enabled')) {
    return {
      firebaseCode: 'auth/billing-not-enabled',
      message:
        'Real SMS OTP bhejne ke liye Firebase Blaze plan chahiye, ya Firebase Console → Phone → "Phone numbers for testing" me free test OTP add karein.',
    };
  }
  if (rawCode === 'auth/unauthorized-domain' || lower.includes('unauthorized-domain')) {
    return {
      firebaseCode: 'auth/unauthorized-domain',
      message:
        'Current app domain Firebase Authentication → Settings → Authorized domains me add nahi hai.',
    };
  }
  if (
    rawCode === 'auth/captcha-check-failed' ||
    rawCode === 'auth/invalid-app-credential' ||
    lower.includes('captcha-check-failed') ||
    lower.includes('invalid-app-credential')
  ) {
    return {
      firebaseCode: rawCode || 'auth/captcha-check-failed',
      message:
        'reCAPTCHA verification fail hui. Niche "Checkbox reCAPTCHA" mode ON karke dubara Send OTP dabayein.',
    };
  }
  if (
    rawCode === 'auth/too-many-requests' ||
    rawCode === 'auth/quota-exceeded' ||
    lower.includes('too-many-requests') ||
    lower.includes('quota-exceeded')
  ) {
    return {
      firebaseCode: rawCode || 'auth/too-many-requests',
      message:
        'Is number par abhi bahut zyada OTP request ho chuki hain. Thodi der baad try karein ya Google Sign-In use karein.',
    };
  }
  if (rawCode === 'auth/invalid-phone-number' || lower.includes('invalid-phone-number')) {
    return {
      firebaseCode: 'auth/invalid-phone-number',
      message: 'Valid 10-digit Indian mobile number (+91) enter karein.',
    };
  }
  if (rawCode === 'auth/invalid-verification-code' || lower.includes('invalid-verification-code')) {
    return {
      firebaseCode: 'auth/invalid-verification-code',
      message: 'Galat 6-digit OTP enter kiya gaya hai. SMS check karke sahi OTP daalein.',
    };
  }
  if (
    rawCode === 'auth/code-expired' ||
    rawCode === 'auth/session-expired' ||
    lower.includes('code-expired') ||
    lower.includes('session-expired')
  ) {
    return {
      firebaseCode: rawCode || 'auth/code-expired',
      message: 'OTP expire ho gaya hai. "Resend OTP" par click karke naya code mangwayein.',
      isExpiredSession: true,
    };
  }
  if (rawCode === 'auth/network-request-failed' || lower.includes('network-request-failed')) {
    return {
      firebaseCode: 'auth/network-request-failed',
      message: 'Internet / network connection weak hai. Connection check karke dubara try karein.',
    };
  }
  return {
    firebaseCode: rawCode || 'auth/unknown',
    message: rawMsg,
  };
}

function isPermissionError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = (err as { code?: string }).code || '';
  const msg = (err as { message?: string }).message || '';
  return (
    code === 'permission-denied' ||
    code.includes('permission') ||
    msg.toLowerCase().includes('missing or insufficient permissions')
  );
}

function makeDocId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function hashIndianPhone(rawPhone: string): Promise<string> {
  const check = validateIndianPhone(rawPhone);
  const canonical = check.valid ? check.normalized : rawPhone.replace(/\D/g, '');
  if (!canonical) return '';
  if (typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined') {
    try {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // Fallback to deterministic hash below
    }
  }
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < canonical.length; i += 1) {
    const ch = canonical.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ (ch + i), 2654435761) >>> 0;
  }
  return `ph_${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

const DRIVER_CODE_REGISTRY_KEY = 'shine_cab_driver_id_registry';
const FALLBACK_DRIVER_PROFILE_KEY = 'shine_cab_fallback_driver_profile';

export interface StoredDriverRegistryEntry {
  driver_code: string;
  driver_id: string;
  display_name: string;
  phone: string;
  masked_phone: string;
  city: string;
  vehicle_category: VehicleCategory;
  kyc_status: DriverProfile['kyc_status'];
  admin_approved: boolean;
  account_status: DriverProfile['account_status'];
  wallet_balance_inr: number;
  partner_rider_id?: string | null;
  short_id: string;
  driverCode: string;
  verified_at?: string | null;
}

export function maskIndianPhone(rawPhone?: string | null): string {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (digits.length >= 4) {
    return `+91 ••••••${digits.slice(-4)}`;
  }
  return '';
}

export function getFallbackDriverProfile(): DriverProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FALLBACK_DRIVER_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DriverProfile;
    return parsed?.driver_id ? parsed : null;
  } catch {
    return null;
  }
}

export function saveFallbackDriverProfile(profile: DriverProfile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FALLBACK_DRIVER_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage write errors
  }
}

export function clearFallbackDriverSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(FALLBACK_DRIVER_PROFILE_KEY);
  } catch {
    // Ignore storage remove errors
  }
}

function readDriverRegistryMap(): Record<string, StoredDriverRegistryEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(DRIVER_CODE_REGISTRY_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, StoredDriverRegistryEntry>;
  } catch {
    return {};
  }
}

function saveDriverRegistryEntry(
  driver: DriverProfile,
  vehicleCategory: VehicleCategory = 'cab',
  walletBalanceInr = 0,
  markVerified = true
): void {
  if (typeof window === 'undefined') return;
  try {
    const code = (
      driver.driverCode ||
      driver.short_id ||
      formatShortDriverId(driver.driver_id, driver.partner_rider_id, driver.short_id, driver.full_name)
    ).toUpperCase();
    const map = readDriverRegistryMap();
    const existing = map[code];
    map[code] = {
      driver_code: code,
      driver_id: driver.driver_id,
      display_name: driver.full_name || existing?.display_name || 'SHINE Captain',
      phone: driver.phone || existing?.phone || '',
      masked_phone: maskIndianPhone(driver.phone || existing?.phone),
      city: driver.city || existing?.city || '',
      vehicle_category: vehicleCategory || existing?.vehicle_category || 'cab',
      kyc_status: driver.kyc_status,
      admin_approved: driver.admin_approved,
      account_status: driver.account_status,
      wallet_balance_inr: Number(walletBalanceInr ?? existing?.wallet_balance_inr ?? 0),
      partner_rider_id: driver.partner_rider_id ?? existing?.partner_rider_id ?? null,
      short_id: code,
      driverCode: code,
      verified_at: markVerified ? new Date().toISOString() : existing?.verified_at ?? null,
    };
    window.localStorage.setItem(DRIVER_CODE_REGISTRY_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage write errors
  }
}

async function syncDriverCodeLookup(
  driver: DriverProfile,
  vehicleCategory?: VehicleCategory | null,
  walletBalanceInr = 0
): Promise<void> {
  const db = getFirebaseDb();
  const code = (
    driver.driverCode ||
    driver.short_id ||
    formatShortDriverId(driver.driver_id, driver.partner_rider_id, driver.short_id, driver.full_name)
  ).toUpperCase();
  if (!db || !code) return;
  try {
    const phoneCheck = validateIndianPhone(driver.phone);
    const phoneHash = phoneCheck.valid ? await hashIndianPhone(phoneCheck.normalized) : '';
    await setDoc(doc(db, 'driver_code_lookup', code), {
      driver_code: code,
      driver_id: driver.driver_id,
      display_name: driver.full_name || 'SHINE Captain',
      masked_phone: maskIndianPhone(driver.phone),
      phone_hash: phoneHash || null,
      city: driver.city || '',
      vehicle_category: vehicleCategory || 'cab',
      kyc_status: driver.kyc_status,
      admin_approved: driver.admin_approved,
      account_status: driver.account_status,
      partner_rider_id: driver.partner_rider_id || null,
      short_id: code,
      driverCode: code,
      wallet_balance_inr: Number(walletBalanceInr || 0),
      weekly_goal_inr: driver.weekly_goal_inr ?? null,
      updated_at: serverTimestamp(),
    });
  } catch {
    // Non-fatal index sync
  }
}

async function syncPhoneLookup(
  driver: DriverProfile,
  vehicleCategory?: VehicleCategory | null,
  walletBalanceInr = 0
): Promise<void> {
  saveDriverRegistryEntry(driver, vehicleCategory || 'cab', walletBalanceInr, true);
  await syncDriverCodeLookup(driver, vehicleCategory, walletBalanceInr);
  const db = getFirebaseDb();
  const phoneCheck = validateIndianPhone(driver.phone);
  if (!db || !phoneCheck.valid) return;
  try {
    const phoneHash = await hashIndianPhone(phoneCheck.normalized);
    if (!phoneHash) return;
    const code = (
      driver.driverCode ||
      driver.short_id ||
      formatShortDriverId(driver.driver_id, driver.partner_rider_id, driver.short_id, driver.full_name)
    ).toUpperCase();
    await setDoc(doc(db, 'driver_phone_lookup', phoneHash), {
      phone_hash: phoneHash,
      driver_id: driver.driver_id,
      display_name: driver.full_name || 'SHINE Captain',
      city: driver.city || '',
      vehicle_category: vehicleCategory || 'cab',
      kyc_status: driver.kyc_status,
      admin_approved: driver.admin_approved,
      account_status: driver.account_status,
      partner_rider_id: driver.partner_rider_id || null,
      short_id: code,
      driverCode: code,
      wallet_balance_inr: Number(walletBalanceInr || 0),
      weekly_goal_inr: driver.weekly_goal_inr ?? null,
      updated_at: serverTimestamp(),
    });
  } catch {
    // Non-fatal index sync
  }
}

function mapDriverDoc(raw: Record<string, unknown>, id: string): DriverProfile {
  const driverId = String(raw.driver_id || id);
  const fullName = String(raw.full_name || raw.name || 'SHINE Captain');
  const partnerRiderId = raw.partner_rider_id ? String(raw.partner_rider_id) : null;
  const rawAdminStatus = raw.status ? String(raw.status).toLowerCase() : '';
  const kycStatus: DriverProfile['kyc_status'] =
    (raw.kyc_status as DriverProfile['kyc_status']) ||
    (rawAdminStatus === 'approved'
      ? 'approved'
      : rawAdminStatus === 'pending_review'
        ? 'under_review'
        : rawAdminStatus === 'rejected'
          ? 'rejected'
          : 'not_submitted');
  const adminApproved =
    typeof raw.admin_approved === 'boolean'
      ? raw.admin_approved
      : rawAdminStatus === 'approved' || kycStatus === 'approved';
  const accountStatus: DriverProfile['account_status'] =
    (raw.account_status as DriverProfile['account_status']) ||
    (adminApproved
      ? 'active'
      : kycStatus === 'rejected'
        ? 'rejected'
        : kycStatus === 'under_review' || kycStatus === 'pending'
          ? 'pending_approval'
          : 'pending_setup');
  const resolvedCode = formatShortDriverId(
    driverId,
    partnerRiderId,
    raw.driverCode ? String(raw.driverCode) : raw.short_id ? String(raw.short_id) : null,
    fullName
  );

  return {
    driver_id: driverId,
    user_id: String(raw.user_id || driverId),
    full_name: fullName,
    phone: String(raw.phone || ''),
    email: raw.email ? String(raw.email) : null,
    city: String(raw.city || ''),
    date_of_birth: raw.date_of_birth ? String(raw.date_of_birth) : null,
    emergency_contact_name: raw.emergency_contact_name ? String(raw.emergency_contact_name) : null,
    emergency_contact_phone: raw.emergency_contact_phone ? String(raw.emergency_contact_phone) : null,
    avatar_url: raw.avatar_url ? String(raw.avatar_url) : null,
    profile_completed: Boolean(raw.profile_completed),
    documents_uploaded: Boolean(raw.documents_uploaded),
    vehicle_verified: Boolean(raw.vehicle_verified || adminApproved),
    kyc_status: kycStatus,
    kyc_rejection_reason: raw.kyc_rejection_reason ? String(raw.kyc_rejection_reason) : null,
    admin_approved: adminApproved,
    account_status: accountStatus,
    partner_rider_id: partnerRiderId,
    short_id: resolvedCode,
    driverCode: resolvedCode,
    is_online: Boolean(raw.is_online),
    active_vehicle_id: raw.active_vehicle_id ? String(raw.active_vehicle_id) : null,
    rating_average: typeof raw.rating_average === 'number' ? raw.rating_average : null,
    total_rides: typeof raw.total_rides === 'number' ? raw.total_rides : 0,
    weekly_goal_inr: typeof raw.weekly_goal_inr === 'number' ? raw.weekly_goal_inr : null,
    created_at: tsToIso(raw.created_at),
    updated_at: tsToIso(raw.updated_at),
  };
}

function mapVehicleDoc(raw: Record<string, unknown>, id: string): VehicleRecord {
  return {
    vehicle_id: String(raw.vehicle_id || id),
    driver_id: String(raw.driver_id || ''),
    category: (raw.category as VehicleCategory) || 'cab',
    make: String(raw.make || ''),
    model: String(raw.model || ''),
    year: typeof raw.year === 'number' ? raw.year : new Date().getFullYear(),
    color: String(raw.color || 'White'),
    registration_number: String(raw.registration_number || ''),
    permit_number: raw.permit_number ? String(raw.permit_number) : null,
    insurance_expiry: raw.insurance_expiry ? String(raw.insurance_expiry) : null,
    rc_expiry: raw.rc_expiry ? String(raw.rc_expiry) : null,
    verification_status: (raw.verification_status as VehicleRecord['verification_status']) || 'pending',
    is_active: Boolean(raw.is_active ?? true),
  };
}

function mapDriverDocument(raw: Record<string, unknown>, id: string): DriverDocumentRecord {
  return {
    document_id: String(raw.document_id || id),
    driver_id: String(raw.driver_id || ''),
    document_type: raw.document_type as DriverDocumentRecord['document_type'],
    storage_path: String(raw.storage_path || ''),
    file_url: raw.file_url ? String(raw.file_url) : null,
    file_name: String(raw.file_name || ''),
    status: (raw.status as DriverDocumentRecord['status']) || 'pending_review',
    rejection_reason: raw.rejection_reason ? String(raw.rejection_reason) : null,
    uploaded_at: raw.uploaded_at ? tsToIso(raw.uploaded_at) : null,
  };
}

function mapRideDoc(raw: Record<string, unknown>, id: string): RideRecord {
  return {
    ride_id: String(raw.ride_id || id),
    customer_id: String(raw.customer_id || ''),
    driver_id: raw.driver_id ? String(raw.driver_id) : null,
    vehicle_id: raw.vehicle_id ? String(raw.vehicle_id) : null,
    vehicle_category: (raw.vehicle_category as VehicleCategory) || 'cab',
    status: (raw.status as RideRecord['status']) || 'searching',
    pickup_address: String(raw.pickup_address || ''),
    pickup_lat: Number(raw.pickup_lat ?? 0),
    pickup_lng: Number(raw.pickup_lng ?? 0),
    dropoff_address: String(raw.dropoff_address || ''),
    dropoff_lat: Number(raw.dropoff_lat ?? 0),
    dropoff_lng: Number(raw.dropoff_lng ?? 0),
    estimated_distance_km: Number(raw.estimated_distance_km ?? 0),
    estimated_duration_min: Number(raw.estimated_duration_min ?? 0),
    estimated_fare_inr: Number(raw.estimated_fare_inr ?? 0),
    final_fare_inr: typeof raw.final_fare_inr === 'number' ? raw.final_fare_inr : null,
    commission_inr: typeof raw.commission_inr === 'number' ? raw.commission_inr : null,
    driver_net_inr: typeof raw.driver_net_inr === 'number' ? raw.driver_net_inr : null,
    payment_mode: (raw.payment_mode as RideRecord['payment_mode']) || 'cash',
    payment_status: (raw.payment_status as RideRecord['payment_status']) || 'pending',
    pickup_otp: raw.pickup_otp ? String(raw.pickup_otp) : null,
    pickup_otp_verified: Boolean(raw.pickup_otp_verified),
    driver_lat: typeof raw.driver_lat === 'number' && Number.isFinite(raw.driver_lat) ? raw.driver_lat : null,
    driver_lng: typeof raw.driver_lng === 'number' && Number.isFinite(raw.driver_lng) ? raw.driver_lng : null,
    driver_heading: typeof raw.driver_heading === 'number' && Number.isFinite(raw.driver_heading) ? raw.driver_heading : null,
    driver_speed_kmh: typeof raw.driver_speed_kmh === 'number' && Number.isFinite(raw.driver_speed_kmh) ? raw.driver_speed_kmh : null,
    offer_expires_at: raw.offer_expires_at ? String(raw.offer_expires_at) : null,
    customer: (raw.customer as RideRecord['customer']) || undefined,
    created_at: tsToIso(raw.created_at),
    started_at: raw.started_at ? tsToIso(raw.started_at) : null,
    completed_at: raw.completed_at ? tsToIso(raw.completed_at) : null,
  };
}

function mapWalletTransactionDoc(raw: Record<string, unknown>, id: string): WalletTransactionRecord {
  return {
    tx_id: String(raw.tx_id || id),
    wallet_id: String(raw.wallet_id || raw.driver_id || ''),
    driver_id: String(raw.driver_id || ''),
    ride_id: raw.ride_id ? String(raw.ride_id) : null,
    payout_id: raw.payout_id ? String(raw.payout_id) : null,
    tx_type: (raw.tx_type as WalletTransactionRecord['tx_type']) || 'ride_credit',
    amount_inr: Number(raw.amount_inr ?? 0),
    description: String(raw.description || 'Wallet transaction'),
    created_at: tsToIso(raw.created_at),
  };
}

function mapRideMessageDoc(raw: Record<string, unknown>, id: string): RideMessageRecord {
  return {
    message_id: String(raw.message_id || id),
    ride_id: String(raw.ride_id || ''),
    driver_id: raw.driver_id ? String(raw.driver_id) : null,
    customer_id: raw.customer_id ? String(raw.customer_id) : null,
    sender_id: String(raw.sender_id || ''),
    sender_role: (raw.sender_role as RideMessageRecord['sender_role']) || 'driver',
    sender_name: String(raw.sender_name || 'Captain'),
    text: String(raw.text || ''),
    created_at: tsToIso(raw.created_at),
  };
}

function mapWalletDoc(raw: Record<string, unknown>, id: string): WalletAccount {
  return {
    wallet_id: String(raw.wallet_id || id),
    driver_id: String(raw.driver_id || id),
    available_balance_inr: Number(raw.available_balance_inr ?? 0),
    pending_settlement_inr: Number(raw.pending_settlement_inr ?? 0),
    cash_commission_due_inr: Number(raw.cash_commission_due_inr ?? 0),
    bank_account_verified: Boolean(raw.bank_account_verified),
    bank_account_masked: raw.bank_account_masked ? String(raw.bank_account_masked) : null,
    account_holder_name: raw.account_holder_name ? String(raw.account_holder_name) : null,
    upi_id: raw.upi_id ? String(raw.upi_id) : null,
    updated_at: tsToIso(raw.updated_at),
  };
}

function mapPayoutDoc(raw: Record<string, unknown>, id: string): PayoutRecord {
  return {
    payout_id: String(raw.payout_id || id),
    driver_id: String(raw.driver_id || ''),
    amount_inr: Number(raw.amount_inr ?? 0),
    status: (raw.status as PayoutRecord['status']) || 'initiated',
    provider_reference: raw.provider_reference ? String(raw.provider_reference) : null,
    destination_label: String(raw.destination_label || 'Registered Bank / UPI'),
    requested_at: tsToIso(raw.requested_at),
    settled_at: raw.settled_at ? tsToIso(raw.settled_at) : null,
  };
}

function mapRatingDoc(raw: Record<string, unknown>, id: string): DriverRatingRecord {
  return {
    rating_id: String(raw.rating_id || id),
    ride_id: String(raw.ride_id || ''),
    customer_id: String(raw.customer_id || ''),
    driver_id: String(raw.driver_id || ''),
    stars: Number(raw.stars ?? 5),
    comment: raw.comment ? String(raw.comment) : null,
    feedback_tags: Array.isArray(raw.feedback_tags)
      ? raw.feedback_tags.map((item) => String(item))
      : null,
    customer_name: raw.customer_name ? String(raw.customer_name) : null,
    pickup_address: raw.pickup_address ? String(raw.pickup_address) : null,
    dropoff_address: raw.dropoff_address ? String(raw.dropoff_address) : null,
    created_at: tsToIso(raw.created_at),
  };
}

function mapNotificationDoc(raw: Record<string, unknown>, id: string): DriverNotification {
  return {
    notification_id: String(raw.notification_id || id),
    driver_id: String(raw.driver_id || ''),
    category: (raw.category as DriverNotification['category']) || 'system',
    title: String(raw.title || ''),
    body: String(raw.body || ''),
    read: Boolean(raw.read),
    created_at: tsToIso(raw.created_at),
  };
}

function mapTicketDoc(raw: Record<string, unknown>, id: string): SupportTicket {
  return {
    ticket_id: String(raw.ticket_id || id),
    driver_id: String(raw.driver_id || ''),
    ride_id: raw.ride_id ? String(raw.ride_id) : null,
    subject: String(raw.subject || ''),
    description: String(raw.description || ''),
    status: (raw.status as SupportTicket['status']) || 'open',
    created_at: tsToIso(raw.created_at),
  };
}

function mapSosDoc(raw: Record<string, unknown>, id: string): SosAlertRecord {
  return {
    alert_id: String(raw.alert_id || id),
    driver_id: String(raw.driver_id || ''),
    ride_id: raw.ride_id ? String(raw.ride_id) : null,
    lat: typeof raw.lat === 'number' ? raw.lat : null,
    lng: typeof raw.lng === 'number' ? raw.lng : null,
    status: (raw.status as SosAlertRecord['status']) || 'triggered',
    created_at: tsToIso(raw.created_at),
  };
}

export async function ensureDriverSeedDocs(
  uid: string,
  opts?: { fullName?: string | null; email?: string | null; phone?: string | null; avatarUrl?: string | null; driverCode?: string | null }
): Promise<DriverProfile> {
  const nowIso = new Date().toISOString();
  const seedFullName = opts?.fullName?.trim() || 'SHINE Captain';
  const generatedCode =
    opts?.driverCode?.trim().toUpperCase() ||
    generatePanDriverId(uid, seedFullName);
  const localSeedProfile: DriverProfile = {
    driver_id: uid,
    user_id: uid,
    full_name: seedFullName,
    phone: opts?.phone?.trim() || '',
    email: opts?.email || null,
    city: '',
    date_of_birth: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    avatar_url: opts?.avatarUrl || null,
    profile_completed: false,
    documents_uploaded: false,
    vehicle_verified: false,
    kyc_status: 'not_submitted',
    kyc_rejection_reason: null,
    admin_approved: false,
    account_status: 'pending_setup',
    partner_rider_id: null,
    short_id: generatedCode,
    driverCode: generatedCode,
    is_online: false,
    active_vehicle_id: null,
    rating_average: null,
    total_rides: 0,
    weekly_goal_inr: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  const db = getFirebaseDb();
  if (!db) {
    saveDriverRegistryEntry(localSeedProfile, 'cab', 0, true);
    return localSeedProfile;
  }

  const driverRef = doc(db, 'drivers', uid);
  let snapExists = false;
  let existingData: Record<string, unknown> | null = null;
  try {
    const snap = await getDoc(driverRef);
    if (snap.exists()) {
      snapExists = true;
      existingData = snap.data() as Record<string, unknown>;
    }
  } catch {
    // Graceful fallback if permission notice or offline cache
  }

  if (snapExists && existingData) {
    let existing = mapDriverDoc(existingData, uid);
    const patch: Record<string, unknown> = {};
    if (opts?.phone?.trim() && !existing.phone) {
      patch.phone = opts.phone.trim();
      existing = { ...existing, phone: opts.phone.trim() };
    }
    if (!existingData.driverCode || !existingData.short_id || !/^[A-Z]{5}\d{4}[A-Z]$/.test(String(existingData.short_id || ''))) {
      patch.driverCode = existing.driverCode || generatedCode;
      patch.short_id = existing.short_id || generatedCode;
    }
    if (Object.keys(patch).length > 0) {
      try {
        await updateDoc(driverRef, {
          ...patch,
          updated_at: serverTimestamp(),
        });
      } catch {
        // Non-fatal backfill
      }
    }

    try {
      const walletRef = doc(db, 'wallet_accounts', uid);
      const walletSnap = await getDoc(walletRef);
      if (!walletSnap.exists()) {
        await setDoc(walletRef, {
          wallet_id: uid,
          driver_id: uid,
          available_balance_inr: 0,
          pending_settlement_inr: 0,
          cash_commission_due_inr: 0,
          bank_account_verified: false,
          updated_at: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal wallet seed
    }

    await syncPhoneLookup(existing).catch(() => {});
    return existing;
  }

  const initialDriver = {
    driver_id: uid,
    user_id: uid,
    full_name: seedFullName,
    phone: opts?.phone?.trim() || '',
    email: opts?.email || null,
    city: '',
    date_of_birth: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    avatar_url: opts?.avatarUrl || null,
    profile_completed: false,
    documents_uploaded: false,
    vehicle_verified: false,
    kyc_status: 'not_submitted',
    kyc_rejection_reason: null,
    admin_approved: false,
    account_status: 'pending_setup',
    partner_rider_id: null,
    short_id: generatedCode,
    driverCode: generatedCode,
    is_online: false,
    active_vehicle_id: null,
    rating_average: null,
    total_rides: 0,
    weekly_goal_inr: null,
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  };

  try {
    await setDoc(driverRef, initialDriver);
  } catch {
    // Non-fatal create fallback
  }

  try {
    await setDoc(doc(db, 'wallet_accounts', uid), {
      wallet_id: uid,
      driver_id: uid,
      available_balance_inr: 0,
      pending_settlement_inr: 0,
      cash_commission_due_inr: 0,
      bank_account_verified: false,
      updated_at: serverTimestamp(),
    });
  } catch {
    // Non-fatal wallet seed
  }

  let mapped = localSeedProfile;
  try {
    const fresh = await getDoc(driverRef);
    if (fresh.exists()) {
      mapped = mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, uid);
    }
  } catch {
    // Fallback to localSeedProfile
  }

  await syncPhoneLookup(mapped).catch(() => {});
  return mapped;
}

export function computeEarningsFromRides(
  rides: RideRecord[],
  period: EarningsSummary['period']
): EarningsSummary {
  const now = Date.now();
  const windowMs =
    period === 'daily'
      ? 24 * 60 * 60 * 1000
      : period === 'weekly'
        ? 7 * 24 * 60 * 60 * 1000
        : 30 * 24 * 60 * 60 * 1000;

  let gross = 0;
  let commission = 0;
  let net = 0;
  let cash = 0;
  let online = 0;
  let completed = 0;
  let totalMinutes = 0;

  for (const r of rides) {
    if (r.status !== 'completed') continue;
    const completedTime = Date.parse(r.completed_at || r.created_at);
    if (!Number.isNaN(completedTime) && now - completedTime > windowMs) {
      continue;
    }
    const fare = r.final_fare_inr ?? r.estimated_fare_inr ?? 0;
    const comm = r.commission_inr ?? Math.round(fare * 0.15 * 100) / 100;
    const drvNet = r.driver_net_inr ?? Math.round((fare - comm) * 100) / 100;

    gross += fare;
    commission += comm;
    net += drvNet;
    if (r.payment_mode === 'cash') cash += fare;
    else online += fare;
    completed += 1;
    totalMinutes += r.estimated_duration_min || 15;
  }

  return {
    period,
    gross_fare_inr: Number(gross.toFixed(2)),
    platform_commission_inr: Number(commission.toFixed(2)),
    net_earnings_inr: Number(net.toFixed(2)),
    cash_collected_inr: Number(cash.toFixed(2)),
    online_payments_inr: Number(online.toFixed(2)),
    completed_rides: completed,
    online_hours: Number((totalMinutes / 60).toFixed(1)),
    currency: 'INR',
  };
}

export const driverBackendService: DriverBackendContract = {
  auth: {
    async signInWithGoogle(linkedPhone?: string) {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Signing in with Google');

      try {
        const credential = await signInWithPopup(auth, googleAuthProvider);
        const user = credential.user;
        const phoneCheck = linkedPhone ? validateIndianPhone(linkedPhone) : null;
        const resolvedPhone =
          phoneCheck && phoneCheck.valid ? phoneCheck.normalized : user.phoneNumber || undefined;

        let seeded: DriverProfile;
        try {
          seeded = await ensureDriverSeedDocs(user.uid, {
            fullName: user.displayName,
            email: user.email,
            phone: resolvedPhone,
            avatarUrl: user.photoURL,
          });
        } catch {
          const fallbackCode = generatePanDriverId(user.uid, user.displayName);
          const nowIso = new Date().toISOString();
          seeded = {
            driver_id: user.uid,
            user_id: user.uid,
            full_name: user.displayName || 'SHINE Captain',
            phone: resolvedPhone || '',
            email: user.email || null,
            city: '',
            avatar_url: user.photoURL || null,
            profile_completed: false,
            documents_uploaded: false,
            vehicle_verified: false,
            kyc_status: 'not_submitted',
            admin_approved: false,
            account_status: 'pending_setup',
            partner_rider_id: null,
            short_id: fallbackCode,
            driverCode: fallbackCode,
            is_online: false,
            rating_average: null,
            total_rides: 0,
            created_at: nowIso,
            updated_at: nowIso,
          };
        }

        if (resolvedPhone && seeded.phone !== resolvedPhone) {
          try {
            await updateDoc(doc(db, 'drivers', user.uid), {
              phone: resolvedPhone,
              updated_at: serverTimestamp(),
            });
          } catch {
            // Non-fatal phone backfill
          }
          seeded = { ...seeded, phone: resolvedPhone };
          await syncPhoneLookup(seeded).catch(() => {});
        }

        // Individual non-throwing checks on secondary collections
        try {
          await getDoc(doc(db, 'vehicles', `${user.uid}_active`));
        } catch {
          // Non-fatal vehicle lookup
        }
        try {
          await getDocs(query(collection(db, 'driver_documents'), where('driver_id', '==', user.uid)));
        } catch {
          // Non-fatal KYC docs lookup
        }

        saveFallbackDriverProfile(seeded);
        return {
          ok: true,
          configured: true,
          data: {
            user_id: user.uid,
            driver_id: user.uid,
            email: user.email,
            displayName: user.displayName,
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Google Sign-In failed or was cancelled.';
        return { ok: false, configured: true, error: { code: 'NETWORK_ERROR', message: msg } };
      }
    },

    async signInWithPhoneOtp(phone: string): Promise<ServiceResult<PhoneOtpLoginResult>> {
      const check = validateIndianPhone(phone);
      if (!check.valid) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Enter a valid 10-digit Indian mobile number.',
          },
        };
      }
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      const phoneHash = await hashIndianPhone(check.normalized);
      const registryEntry = Object.values(readDriverRegistryMap()).find(
        (entry) => entry.phone === check.normalized
      );

      if (auth && typeof window !== 'undefined') {
        await setPersistence(auth, browserLocalPersistence).catch(() => {});
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch {
            // Do not block login if Anonymous Auth is restricted; seamlessly continue with local verified profile
          }
        }
      }

      const activeUid = auth?.currentUser?.uid || null;
      let lookupData: Record<string, unknown> | null = null;
      if (db && phoneHash) {
        try {
          const lookupSnap = await getDoc(doc(db, 'driver_phone_lookup', phoneHash));
          if (lookupSnap.exists()) {
            lookupData = lookupSnap.data() as Record<string, unknown>;
          }
        } catch {
          // Non-fatal if index doc does not exist or permission notice
        }
      }

      const resolvedUid =
        activeUid ||
        (lookupData?.driver_id ? String(lookupData.driver_id) : null) ||
        registryEntry?.driver_id ||
        `drv_${(phoneHash || check.normalized.replace(/\D/g, '')).slice(0, 20)}`;

      let walletBalanceInr = Number(
        lookupData?.wallet_balance_inr ?? registryEntry?.wallet_balance_inr ?? 0
      );
      let vehicleCategory: VehicleCategory | null =
        ((lookupData?.vehicle_category || registryEntry?.vehicle_category) as
          | VehicleCategory
          | undefined) || null;

      let existingDriverSnapData: Record<string, unknown> | null = null;
      if (db && activeUid) {
        try {
          const driverSnap = await getDoc(doc(db, 'drivers', activeUid));
          if (driverSnap.exists()) {
            existingDriverSnapData = driverSnap.data() as Record<string, unknown>;
          }
        } catch {
          // Non-fatal missing/permission fallback
        }
      }

      let profile: DriverProfile;
      let isNewDriver = false;

      if (existingDriverSnapData && activeUid) {
        profile = mapDriverDoc(existingDriverSnapData, activeUid);
        if (!profile.phone || profile.phone !== check.normalized) {
          try {
            if (db) {
              await updateDoc(doc(db, 'drivers', activeUid), {
                phone: check.normalized,
                updated_at: serverTimestamp(),
              });
            }
          } catch {
            // Non-fatal backfill
          }
          profile = { ...profile, phone: check.normalized };
        }
        if (db) {
          try {
            const walletSnap = await getDoc(doc(db, 'wallet_accounts', activeUid));
            if (walletSnap.exists()) {
              walletBalanceInr = Number(
                (walletSnap.data() as Record<string, unknown>).available_balance_inr ?? 0
              );
            }
          } catch {
            // Non-fatal wallet fetch
          }
          try {
            const vehSnap = await getDoc(doc(db, 'vehicles', `${activeUid}_active`));
            if (vehSnap.exists()) {
              vehicleCategory =
                ((vehSnap.data() as Record<string, unknown>).category as VehicleCategory) ||
                vehicleCategory;
            }
          } catch {
            // Non-fatal vehicle fetch
          }
          try {
            await getDocs(
              query(collection(db, 'driver_documents'), where('driver_id', '==', activeUid))
            );
          } catch {
            // Non-fatal docs check
          }
        }
        isNewDriver = !profile.profile_completed && profile.kyc_status === 'not_submitted';
      } else if (activeUid && db) {
        profile = await ensureDriverSeedDocs(activeUid, {
          phone: check.normalized,
          fullName: lookupData?.display_name
            ? String(lookupData.display_name)
            : registryEntry?.display_name,
          driverCode: lookupData?.driverCode
            ? String(lookupData.driverCode)
            : lookupData?.short_id
              ? String(lookupData.short_id)
              : registryEntry?.driverCode,
        });
        isNewDriver = !lookupData && !registryEntry;
      } else {
        const nowIso = new Date().toISOString();
        const existingFallback = getFallbackDriverProfile();
        const fallbackMatches =
          existingFallback && existingFallback.phone === check.normalized
            ? existingFallback
            : null;
        const resolvedName =
          fallbackMatches?.full_name ||
          (lookupData?.display_name ? String(lookupData.display_name) : null) ||
          registryEntry?.display_name ||
          'SHINE Captain';
        const resolvedCode =
          fallbackMatches?.driverCode ||
          (lookupData?.driverCode ? String(lookupData.driverCode) : null) ||
          (lookupData?.short_id ? String(lookupData.short_id) : null) ||
          registryEntry?.driverCode ||
          generatePanDriverId(resolvedUid, resolvedName);
        profile = fallbackMatches
          ? {
              ...fallbackMatches,
              short_id: resolvedCode,
              driverCode: resolvedCode,
              updated_at: nowIso,
            }
          : {
              driver_id: resolvedUid,
              user_id: resolvedUid,
              full_name: resolvedName,
              phone: check.normalized,
              email: null,
              city: String(lookupData?.city || registryEntry?.city || ''),
              profile_completed: Boolean(lookupData || registryEntry),
              documents_uploaded: Boolean(
                lookupData?.kyc_status === 'approved' ||
                  lookupData?.kyc_status === 'under_review' ||
                  registryEntry?.kyc_status === 'approved' ||
                  registryEntry?.kyc_status === 'under_review'
              ),
              vehicle_verified: Boolean(
                lookupData?.admin_approved || registryEntry?.admin_approved
              ),
              kyc_status:
                ((lookupData?.kyc_status ||
                  registryEntry?.kyc_status) as DriverProfile['kyc_status']) || 'not_submitted',
              admin_approved: Boolean(
                lookupData?.admin_approved || registryEntry?.admin_approved
              ),
              account_status:
                ((lookupData?.account_status ||
                  registryEntry?.account_status) as DriverProfile['account_status']) ||
                'pending_setup',
              partner_rider_id:
                (lookupData?.partner_rider_id
                  ? String(lookupData.partner_rider_id)
                  : registryEntry?.partner_rider_id) || null,
              short_id: resolvedCode,
              driverCode: resolvedCode,
              is_online: false,
              rating_average: null,
              total_rides: 0,
              created_at: nowIso,
              updated_at: nowIso,
            };
        isNewDriver = !fallbackMatches && !lookupData && !registryEntry;
      }

      saveFallbackDriverProfile(profile);
      await syncPhoneLookup(profile, vehicleCategory, walletBalanceInr).catch(() => {});

      const effectiveApproved =
        profile.admin_approved ||
        Boolean(lookupData?.admin_approved && lookupData?.driver_id === profile.driver_id);
      const effectiveKyc = profile.kyc_status;
      const status: PhoneOtpLoginResult['status'] = effectiveApproved
        ? 'approved'
        : effectiveKyc === 'rejected'
          ? 'rejected'
          : effectiveKyc === 'under_review' || effectiveKyc === 'pending'
            ? 'pending_review'
            : 'not_submitted';

      const route_to: PhoneOtpLoginResult['route_to'] =
        status === 'approved'
          ? 'dashboard'
          : status === 'rejected'
            ? 'kyc_decision'
            : status === 'pending_review'
              ? 'kyc_pending'
              : 'registration';

      const resolvedCode =
        profile.driverCode ||
        profile.short_id ||
        generatePanDriverId(profile.driver_id, profile.full_name);

      return {
        ok: true,
        configured: true,
        data: {
          user_id: profile.user_id,
          driver_id: profile.driver_id,
          is_new_driver: isNewDriver,
          status,
          kyc_status: profile.kyc_status,
          vehicle_category: vehicleCategory,
          wallet_balance_inr: walletBalanceInr,
          short_id: resolvedCode,
          driverCode: resolvedCode,
          route_to,
        },
      };
    },

    async lookupDriverByCode(driverCode: string): Promise<ServiceResult<DriverIdLookupResult>> {
      const codeCheck = validateDriverCode(driverCode);
      if (!codeCheck.valid) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Enter a valid 10-character Driver ID (e.g. SHNRA4829K).',
          },
        };
      }

      const normalized = codeCheck.normalized;
      const registryMap = readDriverRegistryMap();
      const localEntry = registryMap[normalized] || null;
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();

      let codeLookupData: Record<string, unknown> | null = null;
      let driverDocData: Record<string, unknown> | null = null;
      let vehicleCategory: VehicleCategory | null = localEntry?.vehicle_category || null;
      let walletBalanceInr = Number(localEntry?.wallet_balance_inr ?? 0);

      if (db) {
        try {
          const codeSnap = await getDoc(doc(db, 'driver_code_lookup', normalized));
          if (codeSnap.exists()) {
            codeLookupData = codeSnap.data() as Record<string, unknown>;
          }
        } catch {
          // Non-fatal lookup miss or offline state
        }

        if (auth?.currentUser) {
          try {
            const byCodeSnap = await getDocs(
              query(collection(db, 'drivers'), where('driverCode', '==', normalized))
            );
            if (!byCodeSnap.empty) {
              driverDocData = byCodeSnap.docs[0].data() as Record<string, unknown>;
            }
          } catch {
            // Non-fatal: non-admin client may only read own driver doc
          }

          if (!driverDocData) {
            try {
              const byShortSnap = await getDocs(
                query(collection(db, 'drivers'), where('short_id', '==', normalized))
              );
              if (!byShortSnap.empty) {
                driverDocData = byShortSnap.docs[0].data() as Record<string, unknown>;
              }
            } catch {
              // Non-fatal
            }
          }

          const candidateId =
            (driverDocData?.driver_id ? String(driverDocData.driver_id) : null) ||
            (codeLookupData?.driver_id ? String(codeLookupData.driver_id) : null) ||
            localEntry?.driver_id ||
            null;
          if (!driverDocData && candidateId && candidateId === auth.currentUser.uid) {
            try {
              const ownSnap = await getDoc(doc(db, 'drivers', candidateId));
              if (ownSnap.exists()) {
                driverDocData = ownSnap.data() as Record<string, unknown>;
              }
            } catch {
              // Non-fatal
            }
          }
          if (candidateId && candidateId === auth.currentUser.uid) {
            try {
              const vehSnap = await getDoc(doc(db, 'vehicles', `${candidateId}_active`));
              if (vehSnap.exists()) {
                vehicleCategory =
                  ((vehSnap.data() as Record<string, unknown>).category as VehicleCategory) ||
                  vehicleCategory;
              }
            } catch {
              // Non-fatal
            }
            try {
              const walletSnap = await getDoc(doc(db, 'wallet_accounts', candidateId));
              if (walletSnap.exists()) {
                walletBalanceInr = Number(
                  (walletSnap.data() as Record<string, unknown>).available_balance_inr ??
                    walletBalanceInr
                );
              }
            } catch {
              // Non-fatal
            }
          }
        }
      }

      const found = Boolean(localEntry || codeLookupData || driverDocData);
      if (!found) {
        return {
          ok: true,
          configured: true,
          data: {
            found: false,
            driver_code: normalized,
          },
        };
      }

      const resolvedPhone =
        (driverDocData?.phone ? String(driverDocData.phone) : null) ||
        localEntry?.phone ||
        null;
      const resolvedMasked =
        maskIndianPhone(resolvedPhone) ||
        (codeLookupData?.masked_phone ? String(codeLookupData.masked_phone) : null) ||
        localEntry?.masked_phone ||
        null;

      return {
        ok: true,
        configured: true,
        data: {
          found: true,
          driver_code: normalized,
          driver_id:
            (driverDocData?.driver_id ? String(driverDocData.driver_id) : null) ||
            (codeLookupData?.driver_id ? String(codeLookupData.driver_id) : null) ||
            localEntry?.driver_id,
          display_name:
            (driverDocData?.full_name ? String(driverDocData.full_name) : null) ||
            (codeLookupData?.display_name ? String(codeLookupData.display_name) : null) ||
            localEntry?.display_name ||
            'SHINE Captain',
          phone: resolvedPhone,
          masked_phone: resolvedMasked,
          city:
            (driverDocData?.city ? String(driverDocData.city) : null) ||
            (codeLookupData?.city ? String(codeLookupData.city) : null) ||
            localEntry?.city ||
            '',
          vehicle_category:
            vehicleCategory ||
            (codeLookupData?.vehicle_category
              ? (String(codeLookupData.vehicle_category) as VehicleCategory)
              : null) ||
            localEntry?.vehicle_category ||
            'cab',
          kyc_status:
            ((driverDocData?.kyc_status ||
              codeLookupData?.kyc_status ||
              localEntry?.kyc_status) as DriverProfile['kyc_status']) || 'not_submitted',
          admin_approved: Boolean(
            driverDocData?.admin_approved ??
              codeLookupData?.admin_approved ??
              localEntry?.admin_approved
          ),
          account_status:
            ((driverDocData?.account_status ||
              codeLookupData?.account_status ||
              localEntry?.account_status) as DriverProfile['account_status']) ||
            'pending_setup',
          wallet_balance_inr: Number(
            codeLookupData?.wallet_balance_inr ?? walletBalanceInr ?? 0
          ),
          verified_on_device: Boolean(localEntry?.verified_at),
        },
      };
    },

    async signInWithDriverIdOtp(
      driverCode: string,
      phoneHint?: string | null
    ): Promise<ServiceResult<PhoneOtpLoginResult>> {
      const codeCheck = validateDriverCode(driverCode);
      if (!codeCheck.valid) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Enter a valid 10-character Driver ID (e.g. SHNRA4829K).',
          },
        };
      }

      const normalized = codeCheck.normalized;
      const lookupRes = await driverBackendService.auth.lookupDriverByCode(normalized);
      const lookup = lookupRes.ok ? lookupRes.data : undefined;

      const resolvedPhone =
        (phoneHint && validateIndianPhone(phoneHint).valid
          ? validateIndianPhone(phoneHint).normalized
          : null) ||
        (lookup?.phone && validateIndianPhone(lookup.phone).valid
          ? validateIndianPhone(lookup.phone).normalized
          : '');

      if (resolvedPhone && (!lookup?.driver_id || lookup.driver_id.startsWith('drv_'))) {
        // Delegate to phone OTP session builder while preserving requested driverCode
        const phoneRes = await driverBackendService.auth.signInWithPhoneOtp(resolvedPhone);
        if (phoneRes.ok && phoneRes.data) {
          const fallback = getFallbackDriverProfile();
          if (fallback) {
            const updatedFallback: DriverProfile = {
              ...fallback,
              driverCode: normalized,
              short_id: normalized,
              full_name: lookup?.display_name || fallback.full_name,
              city: lookup?.city || fallback.city,
              kyc_status: lookup?.kyc_status || fallback.kyc_status,
              admin_approved: Boolean(lookup?.admin_approved ?? fallback.admin_approved),
              account_status: lookup?.account_status || fallback.account_status,
            };
            saveFallbackDriverProfile(updatedFallback);
            saveDriverRegistryEntry(
              updatedFallback,
              lookup?.vehicle_category || 'cab',
              Number(lookup?.wallet_balance_inr ?? phoneRes.data.wallet_balance_inr),
              true
            );
          }
          return {
            ...phoneRes,
            data: {
              ...phoneRes.data,
              short_id: normalized,
              driverCode: normalized,
            },
          };
        }
      }

      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (auth && typeof window !== 'undefined') {
        await setPersistence(auth, browserLocalPersistence).catch(() => {});
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch {
            // Non-blocking fallback when anonymous auth is disabled
          }
        }
      }

      const uid =
        auth?.currentUser?.uid ||
        lookup?.driver_id ||
        `drv_${normalized.toLowerCase()}`;
      let profile: DriverProfile | null = null;
      let walletBalanceInr = Number(lookup?.wallet_balance_inr ?? 0);
      let vehicleCategory: VehicleCategory | null = lookup?.vehicle_category || null;

      if (db && auth?.currentUser) {
        try {
          const snap = await getDoc(doc(db, 'drivers', auth.currentUser.uid));
          if (snap.exists()) {
            profile = mapDriverDoc(snap.data() as Record<string, unknown>, auth.currentUser.uid);
          }
        } catch {
          // Non-fatal
        }
        try {
          const walletSnap = await getDoc(doc(db, 'wallet_accounts', auth.currentUser.uid));
          if (walletSnap.exists()) {
            walletBalanceInr = Number(
              (walletSnap.data() as Record<string, unknown>).available_balance_inr ?? walletBalanceInr
            );
          }
        } catch {
          // Non-fatal
        }
        try {
          const vehSnap = await getDoc(doc(db, 'vehicles', `${auth.currentUser.uid}_active`));
          if (vehSnap.exists()) {
            vehicleCategory =
              ((vehSnap.data() as Record<string, unknown>).category as VehicleCategory) ||
              vehicleCategory;
          }
        } catch {
          // Non-fatal
        }
      }

      if (!profile) {
        const nowIso = new Date().toISOString();
        profile = {
          driver_id: lookup?.driver_id || uid,
          user_id: lookup?.driver_id || uid,
          full_name: lookup?.display_name || 'SHINE Captain',
          phone: resolvedPhone || lookup?.phone || '',
          email: null,
          city: lookup?.city || '',
          profile_completed: Boolean(lookup?.found),
          documents_uploaded: Boolean(
            lookup?.kyc_status === 'approved' || lookup?.kyc_status === 'under_review'
          ),
          vehicle_verified: Boolean(lookup?.admin_approved),
          kyc_status: lookup?.kyc_status || 'not_submitted',
          admin_approved: Boolean(lookup?.admin_approved),
          account_status: lookup?.account_status || 'pending_setup',
          partner_rider_id: null,
          short_id: normalized,
          driverCode: normalized,
          is_online: false,
          rating_average: null,
          total_rides: 0,
          created_at: nowIso,
          updated_at: nowIso,
        };
      } else if (profile.driverCode !== normalized) {
        profile = { ...profile, driverCode: normalized, short_id: normalized };
      }

      saveFallbackDriverProfile(profile);
      await syncPhoneLookup(profile, vehicleCategory, walletBalanceInr).catch(() => {});

      const status: PhoneOtpLoginResult['status'] = profile.admin_approved
        ? 'approved'
        : profile.kyc_status === 'rejected'
          ? 'rejected'
          : profile.kyc_status === 'under_review' || profile.kyc_status === 'pending'
            ? 'pending_review'
            : 'not_submitted';

      const route_to: PhoneOtpLoginResult['route_to'] =
        status === 'approved'
          ? 'dashboard'
          : status === 'rejected'
            ? 'kyc_decision'
            : status === 'pending_review'
              ? 'kyc_pending'
              : 'registration';

      return {
        ok: true,
        configured: true,
        data: {
          user_id: profile.user_id,
          driver_id: profile.driver_id,
          is_new_driver: !lookup?.found,
          status,
          kyc_status: profile.kyc_status,
          vehicle_category: vehicleCategory,
          wallet_balance_inr: walletBalanceInr,
          short_id: normalized,
          driverCode: normalized,
          route_to,
        },
      };
    },

    async sendOtp(
      phone: string,
      options?: { recaptchaMode?: 'invisible' | 'normal'; containerId?: string }
    ) {
      const check = validateIndianPhone(phone);
      if (!check.valid) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Enter a valid 10-digit Indian mobile number.',
          },
        };
      }
      const auth = getFirebaseAuth();
      if (!auth) return backendNotConfigured('Sending login OTP');
      if (typeof document === 'undefined') {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNKNOWN_ERROR', message: 'Phone OTP requires browser DOM reCAPTCHA.' },
        };
      }

      const containerId = options?.containerId || 'shine-recaptcha-container';
      const recaptchaMode = options?.recaptchaMode || 'invisible';
      lastRecaptchaContainerId = containerId;

      try {
        // Always reset previous reCAPTCHA instance & DOM widget so resend/retry never fails
        clearRecaptchaSession(containerId);
        pendingConfirmation = null;

        let container = document.getElementById(containerId);
        if (!container) {
          container = document.createElement('div');
          container.id = containerId;
          // Avoid display:none so Google reCAPTCHA Enterprise / Android WebView can execute properly
          container.style.position = 'fixed';
          container.style.bottom = '0px';
          container.style.left = '0px';
          container.style.width = recaptchaMode === 'normal' ? 'auto' : '1px';
          container.style.height = recaptchaMode === 'normal' ? 'auto' : '1px';
          container.style.overflow = 'hidden';
          container.style.zIndex = '50';
          document.body.appendChild(container);
        }

        auth.useDeviceLanguage();

        const verifier = new RecaptchaVerifier(auth, containerId, {
          size: recaptchaMode,
          'expired-callback': () => {
            clearRecaptchaSession(containerId);
          },
          'error-callback': () => {
            clearRecaptchaSession(containerId);
          },
        });
        cachedRecaptcha = verifier;

        const withTimeout = <T>(promise: Promise<T>, ms: number, timeoutCode: string): Promise<T> =>
          new Promise<T>((resolve, reject) => {
            const timer = window.setTimeout(() => {
              reject(Object.assign(new Error(timeoutCode), { code: timeoutCode }));
            }, ms);
            promise.then(
              (val) => {
                window.clearTimeout(timer);
                resolve(val);
              },
              (err) => {
                window.clearTimeout(timer);
                reject(err);
              }
            );
          });

        await withTimeout(verifier.render(), 15000, 'auth/captcha-check-failed');
        pendingConfirmation = await withTimeout(
          signInWithPhoneNumber(auth, check.normalized, verifier),
          recaptchaMode === 'normal' ? 60000 : 25000,
          'auth/captcha-check-failed'
        );
        return { ok: true, configured: true, data: { expiresInSeconds: 120 } };
      } catch (err) {
        clearRecaptchaSession(containerId);
        pendingConfirmation = null;
        const parsed = mapFirebasePhoneAuthError(err);
        return {
          ok: false,
          configured: true,
          error: {
            code: 'NETWORK_ERROR',
            firebaseCode: parsed.firebaseCode,
            message: parsed.message,
          },
        };
      }
    },

    async verifyOtp(phone: string, token: string) {
      const check = validateIndianPhone(phone);
      const cleanedToken = token.trim();
      if (!check.valid) {
        return {
          ok: false,
          configured: true,
          error: { code: 'VALIDATION_ERROR', message: 'Enter a valid 10-digit Indian mobile number.' },
        };
      }
      if (cleanedToken.length !== 6) {
        return {
          ok: false,
          configured: true,
          error: { code: 'INVALID_OTP', message: 'Enter the complete 6-digit SMS OTP.' },
        };
      }
      const auth = getFirebaseAuth();
      if (!auth) return backendNotConfigured('Verifying login OTP');
      if (!pendingConfirmation) {
        return {
          ok: false,
          configured: true,
          error: {
            code: 'INVALID_OTP',
            firebaseCode: 'auth/missing-confirmation',
            message: 'Pehle "Send Login OTP" par click karke SMS code mangwayein (ya Google Sign-In use karein).',
          },
        };
      }

      try {
        const result = await pendingConfirmation.confirm(cleanedToken);
        pendingConfirmation = null;
        clearRecaptchaSession();
        await ensureDriverSeedDocs(result.user.uid, {
          phone: result.user.phoneNumber || check.normalized,
        }).catch(() => {});
        return {
          ok: true,
          configured: true,
          data: { user_id: result.user.uid, driver_id: result.user.uid },
        };
      } catch (err) {
        const parsed = mapFirebasePhoneAuthError(err);
        if (parsed.isExpiredSession) {
          pendingConfirmation = null;
          clearRecaptchaSession();
        }
        return {
          ok: false,
          configured: true,
          error: {
            code: 'INVALID_OTP',
            firebaseCode: parsed.firebaseCode,
            message: parsed.message,
          },
        };
      }
    },

    resetOtpSession() {
      pendingConfirmation = null;
      clearRecaptchaSession();
    },

    async signOut() {
      const auth = getFirebaseAuth();
      clearFallbackDriverSession();
      if (!auth) return { ok: true, configured: true };
      try {
        pendingConfirmation = null;
        clearRecaptchaSession();
        await firebaseSignOut(auth);
        return { ok: true, configured: true };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Sign-out failed.' },
        };
      }
    },
  },

  driver: {
    async getProfile(): Promise<ServiceResult<DriverProfile | null>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      const fallback = getFallbackDriverProfile();
      if (!auth || !db) {
        return fallback
          ? { ok: true, configured: true, data: fallback }
          : backendNotConfigured('Fetching driver profile');
      }

      const user = auth.currentUser;
      if (!user) {
        if (fallback) {
          return { ok: true, configured: true, data: fallback };
        }
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in with Google or Mobile OTP to sync your Captain profile.' },
        };
      }

      try {
        const snap = await getDoc(doc(db, 'drivers', user.uid));
        if (!snap.exists()) {
          const seeded = await ensureDriverSeedDocs(user.uid, {
            fullName: user.displayName,
            email: user.email,
            phone: user.phoneNumber,
            avatarUrl: user.photoURL,
          });
          saveFallbackDriverProfile(seeded);
          return { ok: true, configured: true, data: seeded };
        }
        const mapped = mapDriverDoc(snap.data() as Record<string, unknown>, user.uid);
        saveFallbackDriverProfile(mapped);
        return {
          ok: true,
          configured: true,
          data: mapped,
        };
      } catch {
        if (fallback) {
          return { ok: true, configured: true, data: fallback };
        }
        const seeded = await ensureDriverSeedDocs(user.uid, {
          fullName: user.displayName,
          email: user.email,
          phone: user.phoneNumber,
          avatarUrl: user.photoURL,
        });
        saveFallbackDriverProfile(seeded);
        return { ok: true, configured: true, data: seeded };
      }
    },

    async upsertProfile(payload: DriverRegistrationPayload): Promise<ServiceResult<DriverProfile>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      const user = auth?.currentUser || null;
      const fallback = getFallbackDriverProfile();
      const targetUid = user?.uid || fallback?.driver_id || `drv_${Date.now()}`;

      if (!db || !user) {
        const existingCode =
          fallback?.profile_completed && fallback?.driverCode
            ? fallback.driverCode
            : generatePanDriverId(targetUid, payload.full_name);
        const nowIso = new Date().toISOString();
        const localUpdated: DriverProfile = {
          ...(fallback || {
            driver_id: targetUid,
            user_id: targetUid,
            documents_uploaded: false,
            vehicle_verified: false,
            kyc_status: 'not_submitted',
            admin_approved: false,
            account_status: 'pending_setup',
            is_online: false,
            rating_average: null,
            total_rides: 0,
            created_at: nowIso,
          }),
          full_name: payload.full_name,
          phone: payload.phone,
          email: payload.email || fallback?.email || null,
          city: payload.city,
          date_of_birth: payload.date_of_birth || null,
          emergency_contact_name: payload.emergency_contact_name || null,
          emergency_contact_phone: payload.emergency_contact_phone || null,
          profile_completed: true,
          short_id: existingCode,
          driverCode: existingCode,
          updated_at: nowIso,
        };
        saveFallbackDriverProfile(localUpdated);
        saveDriverRegistryEntry(localUpdated, 'cab', 0, true);
        return { ok: true, configured: true, data: localUpdated };
      }

      try {
        const seeded = await ensureDriverSeedDocs(user.uid, {
          fullName: payload.full_name,
          email: payload.email || user.email,
          phone: payload.phone,
        });
        const nextCode =
          !seeded.profile_completed
            ? generatePanDriverId(user.uid, payload.full_name)
            : seeded.driverCode || generatePanDriverId(user.uid, payload.full_name);

        try {
          await updateDoc(doc(db, 'drivers', user.uid), {
            full_name: payload.full_name,
            phone: payload.phone,
            email: payload.email || null,
            city: payload.city,
            date_of_birth: payload.date_of_birth || null,
            emergency_contact_name: payload.emergency_contact_name || null,
            emergency_contact_phone: payload.emergency_contact_phone || null,
            short_id: nextCode,
            driverCode: nextCode,
            profile_completed: true,
            updated_at: serverTimestamp(),
          });
        } catch {
          // Non-fatal fallback
        }

        let mapped: DriverProfile = {
          ...seeded,
          full_name: payload.full_name,
          phone: payload.phone,
          email: payload.email || seeded.email || null,
          city: payload.city,
          date_of_birth: payload.date_of_birth || null,
          emergency_contact_name: payload.emergency_contact_name || null,
          emergency_contact_phone: payload.emergency_contact_phone || null,
          short_id: nextCode,
          driverCode: nextCode,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        };
        try {
          const fresh = await getDoc(doc(db, 'drivers', user.uid));
          if (fresh.exists()) {
            mapped = mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, user.uid);
          }
        } catch {
          // Keep mapped local object
        }
        saveFallbackDriverProfile(mapped);
        await syncPhoneLookup(mapped).catch(() => {});
        return {
          ok: true,
          configured: true,
          data: mapped,
        };
      } catch (err) {
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed saving profile.' },
        };
      }
    },

    async updateWeeklyGoal(driverId: string, goalInr: number): Promise<ServiceResult<DriverProfile>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Saving weekly earnings goal');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in first to save your weekly goal.' },
        };
      }
      const roundedGoal = Math.round(goalInr);
      if (!Number.isFinite(roundedGoal) || roundedGoal < 500 || roundedGoal > 500000) {
        return {
          ok: false,
          configured: true,
          error: { code: 'VALIDATION_ERROR', message: 'Enter a weekly goal between ₹500 and ₹5,00,000.' },
        };
      }

      const path = `drivers/${driverId}`;
      try {
        await ensureDriverSeedDocs(driverId);
        await updateDoc(doc(db, 'drivers', driverId), {
          weekly_goal_inr: roundedGoal,
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'drivers', driverId));
        const mapped = mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, driverId);
        await syncPhoneLookup(mapped);
        return { ok: true, configured: true, data: mapped };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Weekly goal update failed.' },
        };
      }
    },

    async uploadAvatar(driverId: string, file: File): Promise<ServiceResult<DriverProfile>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Saving driver profile photo');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in to save your profile photo to Firestore.' },
        };
      }

      const path = `drivers/${driverId}`;
      try {
        const compressedDataUrl = await compressFileToFirestoreDataUrl(file, {
          maxDimension: 720,
          quality: 0.75,
        });
        await ensureDriverSeedDocs(driverId);
        await updateDoc(doc(db, 'drivers', driverId), {
          avatar_url: compressedDataUrl,
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'drivers', driverId));
        return {
          ok: true,
          configured: true,
          data: mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Avatar upload failed.' },
        };
      }
    },

    async setOnlineStatus(
      driverId: string,
      online: boolean,
      location?: GeoPoint,
      vehicleCategory?: VehicleCategory
    ): Promise<ServiceResult<DriverProfile>> {
      const auth = getFirebaseAuth();
      const db = getFirebaseDb();
      if (!auth || !db) return backendNotConfigured('Updating online/offline duty status');

      const driverPath = `drivers/${driverId}`;
      try {
        const driverSnap = await getDoc(doc(db, 'drivers', driverId));
        if (!driverSnap.exists()) {
          return {
            ok: false,
            configured: true,
            error: { code: 'NOT_APPROVED', message: 'Driver profile not found.' },
          };
        }
        const driver = mapDriverDoc(driverSnap.data() as Record<string, unknown>, driverId);

        const vehicleSnap = await getDoc(doc(db, 'vehicles', `${driverId}_active`));
        const vehicle = vehicleSnap.exists()
          ? mapVehicleDoc(vehicleSnap.data() as Record<string, unknown>, vehicleSnap.id)
          : null;

        if (online) {
          const gate = canDriverGoOnline(driver, vehicle);
          if (!gate.allowed) {
            return {
              ok: false,
              configured: true,
              error: {
                code: 'NOT_APPROVED',
                message: gate.blockers[0] || 'Driver is not approved by Admin yet.',
              },
            };
          }
        }

        const driverPatch: Record<string, unknown> = {
          is_online: online,
          updated_at: serverTimestamp(),
        };
        if (location) {
          driverPatch.lat = location.lat;
          driverPatch.lng = location.lng;
          driverPatch.heading = location.heading ?? null;
          driverPatch.speed_kmh = location.speed_kmh ?? 0;
        }
        await updateDoc(doc(db, 'drivers', driverId), driverPatch);

        if (location) {
          await setDoc(doc(db, 'driver_locations', driverId), {
            driver_id: driverId,
            lat: location.lat,
            lng: location.lng,
            heading: location.heading ?? null,
            speed_kmh: location.speed_kmh ?? 0,
            accuracy_m: location.accuracy_m ?? null,
            is_online: online,
            vehicle_category: vehicleCategory || vehicle?.category || 'cab',
            updated_at: serverTimestamp(),
          });
        } else {
          const locSnap = await getDoc(doc(db, 'driver_locations', driverId));
          if (locSnap.exists()) {
            await updateDoc(doc(db, 'driver_locations', driverId), {
              is_online: online,
              updated_at: serverTimestamp(),
            });
          }
        }

        const updatedSnap = await getDoc(doc(db, 'drivers', driverId));
        return {
          ok: true,
          configured: true,
          data: mapDriverDoc((updatedSnap.data() as Record<string, unknown>) || {}, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, driverPath);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Duty toggle failed.' },
        };
      }
    },

    async updateLocation(
      driverId: string,
      location: GeoPoint,
      isOnline = true,
      vehicleCategory?: VehicleCategory,
      activeRideId?: string | null
    ) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Syncing live GPS telemetry');
      if (!auth.currentUser) return { ok: false, configured: true };

      const locPath = `driver_locations/${driverId}`;
      try {
        await setDoc(doc(db, 'driver_locations', driverId), {
          driver_id: driverId,
          lat: location.lat,
          lng: location.lng,
          heading: location.heading ?? null,
          speed_kmh: location.speed_kmh ?? 0,
          accuracy_m: location.accuracy_m ?? null,
          is_online: isOnline,
          vehicle_category: vehicleCategory ?? null,
          updated_at: serverTimestamp(),
        });
        await updateDoc(doc(db, 'drivers', driverId), {
          lat: location.lat,
          lng: location.lng,
          heading: location.heading ?? null,
          speed_kmh: location.speed_kmh ?? 0,
          updated_at: serverTimestamp(),
        });
        if (activeRideId) {
          await updateDoc(doc(db, 'rides', activeRideId), {
            driver_lat: location.lat,
            driver_lng: location.lng,
            driver_heading: location.heading ?? null,
            driver_speed_kmh: location.speed_kmh ?? 0,
            updated_at: serverTimestamp(),
          }).catch(() => {
            // Non-fatal if ride transitioned status concurrently
          });
        }
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, locPath);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'GPS sync failed.' },
        };
      }
    },
  },

  vehicle: {
    async getActiveVehicle(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Fetching vehicle details');
      if (!auth.currentUser) {
        return { ok: true, configured: true, data: null };
      }
      const path = 'vehicles';
      try {
        const directSnap = await getDoc(doc(db, 'vehicles', `${driverId}_active`));
        if (directSnap.exists()) {
          return {
            ok: true,
            configured: true,
            data: mapVehicleDoc(directSnap.data() as Record<string, unknown>, directSnap.id),
          };
        }
        const snap = await getDocs(
          query(collection(db, 'vehicles'), where('driver_id', '==', driverId))
        );
        const first = snap.docs[0];
        return {
          ok: true,
          configured: true,
          data: first ? mapVehicleDoc(first.data() as Record<string, unknown>, first.id) : null,
        };
      } catch {
        return { ok: true, configured: true, data: null };
      }
    },

    async upsertVehicle(driverId: string, payload: VehicleUpsertPayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Saving vehicle details');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in first before registering a vehicle.' },
        };
      }

      const vehicleId = `${driverId}_active`;
      const path = `vehicles/${vehicleId}`;
      try {
        await ensureDriverSeedDocs(driverId);
        const existingSnap = await getDoc(doc(db, 'vehicles', vehicleId));
        if (existingSnap.exists()) {
          await updateDoc(doc(db, 'vehicles', vehicleId), {
            category: payload.category,
            make: payload.make,
            model: payload.model,
            year: payload.year,
            color: payload.color,
            registration_number: payload.registration_number.toUpperCase(),
            permit_number: payload.permit_number || null,
            insurance_expiry: payload.insurance_expiry || null,
            rc_expiry: payload.rc_expiry || null,
            is_active: true,
            updated_at: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'vehicles', vehicleId), {
            vehicle_id: vehicleId,
            driver_id: driverId,
            category: payload.category,
            make: payload.make,
            model: payload.model,
            year: payload.year,
            color: payload.color,
            registration_number: payload.registration_number.toUpperCase(),
            permit_number: payload.permit_number || null,
            insurance_expiry: payload.insurance_expiry || null,
            rc_expiry: payload.rc_expiry || null,
            verification_status: 'pending',
            is_active: true,
            created_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
        }
        await updateDoc(doc(db, 'drivers', driverId), {
          active_vehicle_id: vehicleId,
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'vehicles', vehicleId));
        return {
          ok: true,
          configured: true,
          data: mapVehicleDoc((fresh.data() as Record<string, unknown>) || {}, vehicleId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Vehicle save failed.' },
        };
      }
    },
  },

  kyc: {
    async listDocuments(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading KYC documents');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'driver_documents'), where('driver_id', '==', driverId))
        );
        const list = snap.docs.map((d) =>
          mapDriverDocument(d.data() as Record<string, unknown>, d.id)
        );
        return { ok: true, configured: true, data: list };
      } catch {
        return { ok: true, configured: true, data: [] };
      }
    },

    async uploadDocument(driverId, docType, file) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Saving KYC document');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in before uploading KYC documents.' },
        };
      }

      const docId = `${driverId}_${docType}`;
      const path = `driver_documents/${docId}`;
      try {
        const compressedDataUrl = await compressFileToFirestoreDataUrl(file, {
          maxDimension: 720,
          quality: 0.75,
        });
        await ensureDriverSeedDocs(driverId);

        const docPayload = {
          document_id: docId,
          driver_id: driverId,
          document_type: docType,
          storage_path: `firestore://driver_documents/${docId}`,
          file_url: compressedDataUrl,
          file_name: file.name,
          status: 'pending_review',
          rejection_reason: null,
          uploaded_at: serverTimestamp(),
        };

        const existing = await getDoc(doc(db, 'driver_documents', docId));
        if (existing.exists()) {
          await updateDoc(doc(db, 'driver_documents', docId), {
            storage_path: docPayload.storage_path,
            file_url: docPayload.file_url,
            file_name: docPayload.file_name,
            status: 'pending_review',
            rejection_reason: null,
            uploaded_at: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, 'driver_documents', docId), docPayload);
        }

        const fresh = await getDoc(doc(db, 'driver_documents', docId));
        return {
          ok: true,
          configured: true,
          data: mapDriverDocument((fresh.data() as Record<string, unknown>) || {}, docId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.WRITE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'KYC document upload failed.' },
        };
      }
    },

    async submitForApproval(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Submitting KYC for admin review');
      const path = `drivers/${driverId}`;
      try {
        await updateDoc(doc(db, 'drivers', driverId), {
          documents_uploaded: true,
          kyc_status: 'under_review',
          account_status: 'pending_approval',
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'drivers', driverId));
        const mapped = mapDriverDoc((fresh.data() as Record<string, unknown>) || {}, driverId);
        await syncPhoneLookup(mapped);
        return {
          ok: true,
          configured: true,
          data: mapped,
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'KYC submission failed.' },
        };
      }
    },
  },

  rides: {
    subscribeOffers(driverId: string, category: VehicleCategory, onOffer: (ride: RideRecord) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser) return () => {};

      const q = query(
        collection(db, 'rides'),
        where('status', 'in', ['searching', 'offered', 'requested'])
      );

      const seenOffers = new Set<string>();
      const unsub = onSnapshot(
        q,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added' || change.type === 'modified') {
              const ride = mapRideDoc(change.doc.data() as Record<string, unknown>, change.doc.id);
              const categoryMatches = !ride.vehicle_category || ride.vehicle_category === category;
              const eligible = !ride.driver_id || ride.driver_id === driverId;
              if (categoryMatches && eligible && !seenOffers.has(ride.ride_id)) {
                seenOffers.add(ride.ride_id);
                onOffer(ride);
              }
            }
          });
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'rides');
        }
      );

      return unsub;
    },

    async acceptRide(
      rideId: string,
      driverId: string,
      vehicleId?: string | null
    ): Promise<ServiceResult<AcceptRideResponse>> {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Accepting ride atomically');
      if (!auth.currentUser) {
        return {
          ok: false,
          configured: true,
          error: { code: 'UNAUTHENTICATED', message: 'Sign in to accept rides.' },
        };
      }

      const path = `rides/${rideId}`;
      try {
        const updatedRide = await runTransaction(db, async (tx) => {
          const rideRef = doc(db, 'rides', rideId);
          const snap = await tx.get(rideRef);
          if (!snap.exists()) {
            throw new Error('RIDE_NOT_FOUND');
          }
          const current = mapRideDoc(snap.data() as Record<string, unknown>, rideId);
          if (
            current.driver_id &&
            current.driver_id !== driverId
          ) {
            throw new Error('ALREADY_TAKEN');
          }
          if (!['searching', 'offered', 'requested'].includes(current.status)) {
            throw new Error('ALREADY_TAKEN');
          }
          tx.update(rideRef, {
            driver_id: driverId,
            vehicle_id: vehicleId || `${driverId}_active`,
            status: 'accepted',
            updated_at: serverTimestamp(),
          });
          return {
            ...current,
            driver_id: driverId,
            vehicle_id: vehicleId || `${driverId}_active`,
            status: 'accepted' as const,
          };
        });

        return {
          ok: true,
          configured: true,
          data: {
            ride: updatedRide,
            accepted_atomically: true,
            assigned_driver_id: driverId,
          },
        };
      } catch (err) {
        if (err instanceof Error && err.message === 'ALREADY_TAKEN') {
          return {
            ok: false,
            configured: true,
            error: {
              code: 'RIDE_ALREADY_TAKEN',
              message: 'Another captain claimed this ride moments earlier.',
            },
          };
        }
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: {
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Unable to accept ride.',
          },
        };
      }
    },

    async rejectRide(rideId: string, driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Declining ride offer');
      const path = `rides/${rideId}`;
      try {
        const snap = await getDoc(doc(db, 'rides', rideId));
        if (snap.exists()) {
          const data = snap.data() as Record<string, unknown>;
          if (data.status === 'offered' && data.driver_id === driverId) {
            await updateDoc(doc(db, 'rides', rideId), {
              driver_id: null,
              status: 'searching',
              updated_at: serverTimestamp(),
            });
          }
        }
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return { ok: true, configured: true };
      }
    },

    async markArrived(rideId: string, driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Updating arrival at pickup');
      const path = `rides/${rideId}`;
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'arrived',
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'rides', rideId));
        return {
          ok: true,
          configured: true,
          data: mapRideDoc((fresh.data() as Record<string, unknown>) || { driver_id: driverId }, rideId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed updating arrival.' },
        };
      }
    },

    async verifyPickupOtp(payload: VerifyPickupOtpPayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Verifying pickup OTP');

      const cleanedOtp = payload.otp_code.trim();
      if (!/^\d{4}$/.test(cleanedOtp)) {
        return {
          ok: false,
          configured: true,
          error: { code: 'INVALID_OTP', message: 'Enter a valid 4-digit numeric Pickup OTP.' },
        };
      }

      const path = `rides/${payload.ride_id}`;
      try {
        const started = await runTransaction(db, async (tx) => {
          const rideRef = doc(db, 'rides', payload.ride_id);
          const snap = await tx.get(rideRef);
          if (!snap.exists()) throw new Error('RIDE_NOT_FOUND');
          const ride = mapRideDoc(snap.data() as Record<string, unknown>, payload.ride_id);
          if (ride.driver_id !== payload.driver_id) throw new Error('NOT_ASSIGNED');
          if (ride.pickup_otp && ride.pickup_otp.trim() !== cleanedOtp) {
            throw new Error('OTP_MISMATCH');
          }
          tx.update(rideRef, {
            status: 'in_progress',
            pickup_otp_verified: true,
            started_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });
          return {
            ...ride,
            status: 'in_progress' as const,
            pickup_otp_verified: true,
            started_at: new Date().toISOString(),
          };
        });
        return { ok: true, configured: true, data: started };
      } catch (err) {
        if (err instanceof Error && err.message === 'OTP_MISMATCH') {
          return {
            ok: false,
            configured: true,
            error: {
              code: 'INVALID_OTP',
              message: 'Incorrect 4-digit OTP. Ask the passenger to check their SHINE Customer App.',
            },
          };
        }
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: {
            code: 'INVALID_OTP',
            message: err instanceof Error ? err.message : 'OTP verification failed.',
          },
        };
      }
    },

    async completeRide(payload: CompleteRidePayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Completing ride and updating wallet');

      const path = `rides/${payload.ride_id}`;
      try {
        const completed = await runTransaction(db, async (tx) => {
          const rideRef = doc(db, 'rides', payload.ride_id);
          const driverRef = doc(db, 'drivers', payload.driver_id);
          const walletRef = doc(db, 'wallet_accounts', payload.driver_id);

          const [rideSnap, driverSnap, walletSnap] = await Promise.all([
            tx.get(rideRef),
            tx.get(driverRef),
            tx.get(walletRef),
          ]);

          if (!rideSnap.exists()) throw new Error('RIDE_NOT_FOUND');
          const ride = mapRideDoc(rideSnap.data() as Record<string, unknown>, payload.ride_id);
          if (ride.driver_id !== payload.driver_id) throw new Error('NOT_ASSIGNED');
          if (!ride.pickup_otp_verified || ride.status !== 'in_progress') {
            throw new Error('INVALID_STATE');
          }

          const finalFare = Number((ride.estimated_fare_inr || 0).toFixed(2));
          const commission = Number((finalFare * 0.15).toFixed(2));
          const driverNet = Number((finalFare - commission).toFixed(2));

          tx.update(rideRef, {
            status: 'completed',
            final_fare_inr: finalFare,
            commission_inr: commission,
            driver_net_inr: driverNet,
            payment_status: 'paid',
            completed_at: serverTimestamp(),
            updated_at: serverTimestamp(),
          });

          if (driverSnap.exists()) {
            const curRides = Number((driverSnap.data() as Record<string, unknown>).total_rides || 0);
            tx.update(driverRef, {
              total_rides: curRides + 1,
              updated_at: serverTimestamp(),
            });
          }

          if (walletSnap.exists()) {
            const w = mapWalletDoc(walletSnap.data() as Record<string, unknown>, payload.driver_id);
            const isCash = ride.payment_mode === 'cash';
            tx.update(walletRef, {
              available_balance_inr: isCash
                ? w.available_balance_inr
                : Number((w.available_balance_inr + driverNet).toFixed(2)),
              cash_commission_due_inr: isCash
                ? Number((w.cash_commission_due_inr + commission).toFixed(2))
                : w.cash_commission_due_inr,
              updated_at: serverTimestamp(),
            });

            const txId = makeDocId('wtx');
            tx.set(doc(db, 'wallet_transactions', txId), {
              tx_id: txId,
              wallet_id: payload.driver_id,
              driver_id: payload.driver_id,
              ride_id: payload.ride_id,
              payout_id: null,
              tx_type: isCash ? 'commission_debit' : 'ride_credit',
              amount_inr: isCash ? commission : driverNet,
              description: isCash
                ? `15% cash commission due (${ride.pickup_address || 'Trip'})`
                : `Net ride earnings (${ride.pickup_address || 'Trip'})`,
              created_at: serverTimestamp(),
            });
          }

          return {
            ...ride,
            status: 'completed' as const,
            final_fare_inr: finalFare,
            commission_inr: commission,
            driver_net_inr: driverNet,
            payment_status: 'paid' as const,
            completed_at: new Date().toISOString(),
          };
        });

        return { ok: true, configured: true, data: completed };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: {
            code: 'NETWORK_ERROR',
            message: err instanceof Error ? err.message : 'Unable to complete ride.',
          },
        };
      }
    },

    async cancelRide(rideId: string, _driverId: string, reason: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Cancelling active ride');
      const path = `rides/${rideId}`;
      try {
        await updateDoc(doc(db, 'rides', rideId), {
          status: 'cancelled',
          cancellation_reason: reason || 'Cancelled by captain',
          cancelled_by: 'driver',
          updated_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'rides', rideId));
        return {
          ok: true,
          configured: true,
          data: mapRideDoc((fresh.data() as Record<string, unknown>) || {}, rideId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Cancel failed.' },
        };
      }
    },

    async getActiveRide(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading active ride');
      if (!auth.currentUser) return { ok: true, configured: true, data: null };

      try {
        const snap = await getDocs(
          query(collection(db, 'rides'), where('driver_id', '==', driverId))
        );
        const active = snap.docs
          .map((d) => mapRideDoc(d.data() as Record<string, unknown>, d.id))
          .filter((r) => ['accepted', 'arriving', 'arrived', 'in_progress'].includes(r.status))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;

        return { ok: true, configured: true, data: active };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'rides');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Active ride fetch failed.' },
        };
      }
    },

    async getRideHistory(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading ride history');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'rides'), where('driver_id', '==', driverId))
        );
        const history = snap.docs
          .map((d) => mapRideDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
          .slice(0, 50);

        return { ok: true, configured: true, data: history };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'rides');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Ride history failed.' },
        };
      }
    },

    subscribeMessages(rideId: string, onMessages: (messages: RideMessageRecord[]) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !rideId) return () => {};

      const q = query(collection(db, 'ride_messages'), where('ride_id', '==', rideId));
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => mapRideMessageDoc(d.data() as Record<string, unknown>, d.id))
            .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
          onMessages(list);
        },
        (error) => {
          handleFirestoreError(error, OperationType.LIST, 'ride_messages');
        }
      );
    },

    async sendMessage(payload: SendRideMessagePayload): Promise<ServiceResult<RideMessageRecord>> {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Sending live ride chat message');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in to chat.' } };
      }

      const msgId = makeDocId('msg');
      const path = `ride_messages/${msgId}`;
      try {
        await setDoc(doc(db, 'ride_messages', msgId), {
          message_id: msgId,
          ride_id: payload.ride_id,
          driver_id: payload.driver_id,
          customer_id: payload.customer_id,
          sender_id: payload.sender_id,
          sender_role: 'driver',
          sender_name: payload.sender_name,
          text: payload.text.trim(),
          created_at: serverTimestamp(),
        });
        return {
          ok: true,
          configured: true,
          data: {
            message_id: msgId,
            ride_id: payload.ride_id,
            driver_id: payload.driver_id,
            customer_id: payload.customer_id,
            sender_id: payload.sender_id,
            sender_role: 'driver',
            sender_name: payload.sender_name,
            text: payload.text.trim(),
            created_at: new Date().toISOString(),
          },
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Chat send failed.' },
        };
      }
    },
  },

  finance: {
    async getEarnings(driverId: string, period: EarningsSummary['period']) {
      const historyRes = await this.getRideHistoryRef(driverId);
      if (!historyRes.ok) {
        return { ok: false, configured: historyRes.configured, error: historyRes.error };
      }
      return {
        ok: true,
        configured: true,
        data: computeEarningsFromRides(historyRes.data || [], period),
      };
    },

    async getWallet(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading wallet ledger');
      if (!auth.currentUser) return { ok: true, configured: true, data: null };

      const path = `wallet_accounts/${driverId}`;
      try {
        const snap = await getDoc(doc(db, 'wallet_accounts', driverId));
        if (!snap.exists()) return { ok: true, configured: true, data: null };
        return {
          ok: true,
          configured: true,
          data: mapWalletDoc(snap.data() as Record<string, unknown>, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.GET, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Wallet fetch failed.' },
        };
      }
    },

    async updatePayoutMethod(driverId: string, payload: PayoutMethodPayload) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Saving bank or UPI payout method');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } };
      }

      const path = `wallet_accounts/${driverId}`;
      try {
        await ensureDriverSeedDocs(driverId);
        const digits = (payload.bank_account_number || '').replace(/\D/g, '');
        const masked =
          digits.length >= 4
            ? `XXXX-${digits.slice(-4)}${payload.ifsc_code ? ` (${payload.ifsc_code.toUpperCase()})` : ''}`
            : undefined;

        const patch: Record<string, unknown> = { updated_at: serverTimestamp() };
        if (payload.upi_id !== undefined) patch.upi_id = payload.upi_id.trim() || null;
        if (payload.account_holder_name !== undefined) {
          patch.account_holder_name = payload.account_holder_name.trim() || null;
        }
        if (masked) {
          patch.bank_account_masked = masked;
          patch.bank_account_verified = true;
        }

        await updateDoc(doc(db, 'wallet_accounts', driverId), patch);
        const fresh = await getDoc(doc(db, 'wallet_accounts', driverId));
        return {
          ok: true,
          configured: true,
          data: mapWalletDoc((fresh.data() as Record<string, unknown>) || {}, driverId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Failed updating payout method.' },
        };
      }
    },

    async getPayoutHistory(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading payout history');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'payouts'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapPayoutDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.requested_at) - Date.parse(a.requested_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'payouts');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Payout history failed.' },
        };
      }
    },

    async requestPayout(driverId: string, amountInr: number) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Requesting wallet payout');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in first.' } };
      }

      const payoutId = makeDocId('pay');
      const path = `payouts/${payoutId}`;
      try {
        const created = await runTransaction(db, async (tx) => {
          const walletRef = doc(db, 'wallet_accounts', driverId);
          const wSnap = await tx.get(walletRef);
          if (!wSnap.exists()) throw new Error('Wallet account not initialized yet.');
          const w = mapWalletDoc(wSnap.data() as Record<string, unknown>, driverId);
          if (amountInr <= 0 || amountInr > w.available_balance_inr) {
            throw new Error('Requested payout exceeds available wallet balance.');
          }
          const destination =
            w.upi_id || w.bank_account_masked || 'Registered Bank / UPI';
          const payoutRef = doc(db, 'payouts', payoutId);

          tx.update(walletRef, {
            available_balance_inr: Number((w.available_balance_inr - amountInr).toFixed(2)),
            pending_settlement_inr: Number((w.pending_settlement_inr + amountInr).toFixed(2)),
            updated_at: serverTimestamp(),
          });

          tx.set(payoutRef, {
            payout_id: payoutId,
            driver_id: driverId,
            amount_inr: amountInr,
            status: 'initiated',
            provider_reference: `REQ-${Date.now()}`,
            destination_label: destination,
            requested_at: serverTimestamp(),
            settled_at: null,
          });

          const txId = makeDocId('wtx');
          tx.set(doc(db, 'wallet_transactions', txId), {
            tx_id: txId,
            wallet_id: driverId,
            driver_id: driverId,
            ride_id: null,
            payout_id: payoutId,
            tx_type: 'payout_debit',
            amount_inr: amountInr,
            description: `Withdrawal to ${destination}`,
            created_at: serverTimestamp(),
          });

          return {
            payout_id: payoutId,
            driver_id: driverId,
            amount_inr: amountInr,
            status: 'initiated' as const,
            provider_reference: `REQ-${Date.now()}`,
            destination_label: destination,
            requested_at: new Date().toISOString(),
            settled_at: null,
          };
        });

        return { ok: true, configured: true, data: created };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'VALIDATION_ERROR', message: err instanceof Error ? err.message : 'Payout request failed.' },
        };
      }
    },

    async settleCashDues(driverId: string, amountInr: number): Promise<ServiceResult<WalletAccount>> {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Settling cash dues');
      const path = `wallet_accounts/${driverId}`;
      try {
        const updatedWallet = await runTransaction(db, async (tx) => {
          const walletRef = doc(db, 'wallet_accounts', driverId);
          const wSnap = await tx.get(walletRef);
          if (!wSnap.exists()) throw new Error('Wallet account not found.');
          const w = mapWalletDoc(wSnap.data() as Record<string, unknown>, driverId);
          const newDue = Math.max(0, Number((w.cash_commission_due_inr - amountInr).toFixed(2)));
          tx.update(walletRef, {
            cash_commission_due_inr: newDue,
            updated_at: serverTimestamp(),
          });
          const txId = makeDocId('wtx');
          tx.set(doc(db, 'wallet_transactions', txId), {
            tx_id: txId,
            wallet_id: driverId,
            driver_id: driverId,
            ride_id: null,
            payout_id: null,
            tx_type: 'dues_settlement',
            amount_inr: amountInr,
            description: 'Cash commission dues settled',
            created_at: serverTimestamp(),
          });
          return { ...w, cash_commission_due_inr: newDue, updated_at: new Date().toISOString() };
        });
        return { ok: true, configured: true, data: updatedWallet };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Dues settlement failed.' },
        };
      }
    },

    subscribeWalletTransactions(
      driverId: string,
      onTxs: (txs: WalletTransactionRecord[]) => void
    ) {
      return subscribeWalletTransactions(driverId, onTxs);
    },

    // Internal helper avoiding cross-module circular dependency on driverBackendService.rides
    async getRideHistoryRef(driverId: string) {
      return driverBackendService.rides.getRideHistory(driverId);
    },
  } as DriverBackendContract['finance'] & {
    getRideHistoryRef(driverId: string): Promise<ServiceResult<RideRecord[]>>;
  },

  account: {
    async getRatings(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading customer ratings');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'ratings'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapRatingDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'ratings');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Ratings fetch failed.' },
        };
      }
    },

    subscribeRatings(driverId: string, onRating: (rating: DriverRatingRecord) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !driverId) return () => {};

      const q = query(collection(db, 'ratings'), where('driver_id', '==', driverId));
      return onSnapshot(
        q,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              onRating(mapRatingDoc(change.doc.data() as Record<string, unknown>, change.doc.id));
            }
          });
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'ratings')
      );
    },

    async getNotifications(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading notifications');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'notifications'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapNotificationDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'notifications');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Notifications failed.' },
        };
      }
    },

    subscribeNotifications(driverId: string, onNotification: (notification: DriverNotification) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !driverId) return () => {};

      const q = query(collection(db, 'notifications'), where('driver_id', '==', driverId));
      return onSnapshot(
        q,
        (snap) => {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added') {
              onNotification(
                mapNotificationDoc(change.doc.data() as Record<string, unknown>, change.doc.id)
              );
            }
          });
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
      );
    },

    async markNotificationRead(notificationId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Updating notification');
      const path = `notifications/${notificationId}`;
      try {
        await updateDoc(doc(db, 'notifications', notificationId), { read: true });
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, path);
        return { ok: true, configured: true };
      }
    },

    async markAllNotificationsRead(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Marking notifications read');
      try {
        const snap = await getDocs(
          query(collection(db, 'notifications'), where('driver_id', '==', driverId))
        );
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          if (!d.data().read) batch.update(d.ref, { read: true });
        });
        await batch.commit();
        return { ok: true, configured: true };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.UPDATE, 'notifications');
        return { ok: true, configured: true };
      }
    },

    async getSupportTickets(driverId: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Loading support tickets');
      if (!auth.currentUser) return { ok: true, configured: true, data: [] };

      try {
        const snap = await getDocs(
          query(collection(db, 'support_tickets'), where('driver_id', '==', driverId))
        );
        const list = snap.docs
          .map((d) => mapTicketDoc(d.data() as Record<string, unknown>, d.id))
          .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
        return { ok: true, configured: true, data: list };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.LIST, 'support_tickets');
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Tickets fetch failed.' },
        };
      }
    },

    async createSupportTicket(driverId: string, subject: string, description: string, rideId?: string) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Submitting support ticket');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in to submit a ticket.' } };
      }

      const ticketId = makeDocId('tkt');
      const path = `support_tickets/${ticketId}`;
      try {
        await setDoc(doc(db, 'support_tickets', ticketId), {
          ticket_id: ticketId,
          driver_id: driverId,
          ride_id: rideId?.trim() || null,
          subject: subject.trim(),
          description: description.trim(),
          status: 'open',
          created_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'support_tickets', ticketId));
        return {
          ok: true,
          configured: true,
          data: mapTicketDoc((fresh.data() as Record<string, unknown>) || {}, ticketId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'Ticket create failed.' },
        };
      }
    },

    async triggerSos(driverId: string, rideId?: string, location?: GeoPoint) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth) return backendNotConfigured('Dispatching Emergency SOS alert');
      if (!auth.currentUser) {
        return { ok: false, configured: true, error: { code: 'UNAUTHENTICATED', message: 'Sign in first or dial 112.' } };
      }

      const alertId = makeDocId('sos');
      const path = `sos_alerts/${alertId}`;
      try {
        await setDoc(doc(db, 'sos_alerts', alertId), {
          alert_id: alertId,
          driver_id: driverId,
          ride_id: rideId || null,
          lat: location?.lat ?? null,
          lng: location?.lng ?? null,
          status: 'triggered',
          created_at: serverTimestamp(),
        });
        const fresh = await getDoc(doc(db, 'sos_alerts', alertId));
        return {
          ok: true,
          configured: true,
          data: mapSosDoc((fresh.data() as Record<string, unknown>) || {}, alertId),
        };
      } catch (err) {
        if (isPermissionError(err)) handleFirestoreError(err, OperationType.CREATE, path);
        return {
          ok: false,
          configured: true,
          error: { code: 'NETWORK_ERROR', message: err instanceof Error ? err.message : 'SOS dispatch failed.' },
        };
      }
    },

    subscribeSosAlerts(driverId: string, onAlerts: (alerts: SosAlertRecord[]) => void) {
      const db = getFirebaseDb();
      const auth = getFirebaseAuth();
      if (!db || !auth?.currentUser || !driverId) return () => {};

      const q = query(collection(db, 'sos_alerts'), where('driver_id', '==', driverId));
      return onSnapshot(
        q,
        (snap) => {
          const list = snap.docs
            .map((d) => mapSosDoc(d.data() as Record<string, unknown>, d.id))
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
          onAlerts(list);
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'sos_alerts')
      );
    },
  },
};

export function subscribeDriverProfile(
  driverId: string,
  onProfile: (profile: DriverProfile | null) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const path = `drivers/${driverId}`;
  return onSnapshot(
    doc(db, 'drivers', driverId),
    (snap) => {
      if (!snap.exists()) {
        onProfile(null);
        return;
      }
      onProfile(mapDriverDoc(snap.data() as Record<string, unknown>, driverId));
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export function subscribeDriverDocuments(
  driverId: string,
  onDocs: (docs: DriverDocumentRecord[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const q = query(collection(db, 'driver_documents'), where('driver_id', '==', driverId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) =>
        mapDriverDocument(d.data() as Record<string, unknown>, d.id)
      );
      onDocs(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'driver_documents')
  );
}

export function subscribeDriverRides(
  driverId: string,
  onRides: (rides: RideRecord[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const q = query(collection(db, 'rides'), where('driver_id', '==', driverId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapRideDoc(d.data() as Record<string, unknown>, d.id))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      onRides(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'rides')
  );
}

export function subscribeWalletAccount(
  driverId: string,
  onWallet: (wallet: WalletAccount | null) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const path = `wallet_accounts/${driverId}`;
  return onSnapshot(
    doc(db, 'wallet_accounts', driverId),
    (snap) => {
      if (!snap.exists()) {
        onWallet(null);
        return;
      }
      onWallet(mapWalletDoc(snap.data() as Record<string, unknown>, driverId));
    },
    (err) => handleFirestoreError(err, OperationType.GET, path)
  );
}

export function subscribeWalletTransactions(
  driverId: string,
  onTxs: (txs: WalletTransactionRecord[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || !driverId) return () => {};

  const q = query(collection(db, 'wallet_transactions'), where('driver_id', '==', driverId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapWalletTransactionDoc(d.data() as Record<string, unknown>, d.id))
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
        .slice(0, 50);
      onTxs(list);
    },
    () => {
      // Non-fatal fallback if index/collection not seeded yet
      onTxs([]);
    }
  );
}

export function subscribeFareConfigs(
  onConfigs: (configs: FareConfigRecord[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser) return () => {};

  return onSnapshot(
    collection(db, 'fare_configs'),
    (snap) => {
      const list: FareConfigRecord[] = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        return {
          config_id: String(raw.config_id || d.id),
          vehicle_category: (raw.vehicle_category as VehicleCategory) || 'cab',
          base_fare_inr: Number(raw.base_fare_inr ?? 40),
          per_km_inr: Number(raw.per_km_inr ?? 14),
          per_min_inr: Number(raw.per_min_inr ?? 2),
          min_fare_inr: Number(raw.min_fare_inr ?? 50),
          commission_pct: Number(raw.commission_pct ?? 15),
          surge_multiplier: typeof raw.surge_multiplier === 'number' ? raw.surge_multiplier : 1,
          currency: String(raw.currency || 'INR'),
          updated_at: tsToIso(raw.updated_at),
        };
      });
      onConfigs(list);
    },
    () => {
      // Non-fatal if admin has not seeded fare_configs yet
      onConfigs([]);
    }
  );
}

export function subscribeSystemIntegrationsLiveKeys(
  onKeys: (keys: SystemIntegrationLiveKeys | null) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser) return () => {};

  return onSnapshot(
    doc(db, 'system_integrations', 'live_keys'),
    (snap) => {
      if (!snap.exists()) {
        onKeys(null);
        return;
      }
      const raw = snap.data() as Record<string, unknown>;
      onKeys({
        firebase_phone_otp_enabled: Boolean(raw.firebase_phone_otp_enabled),
        demo_otp_banner_enabled:
          typeof raw.demo_otp_banner_enabled === 'boolean' ? raw.demo_otp_banner_enabled : true,
        sms_provider: raw.sms_provider ? String(raw.sms_provider) : null,
        updated_at: tsToIso(raw.updated_at),
      });
    },
    () => {
      onKeys(null);
    }
  );
}

export function subscribeTopCaptains(
  onEntries: (entries: CaptainLeaderboardEntry[]) => void
): () => void {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser) return () => {};

  return onSnapshot(
    collection(db, 'captain_leaderboard'),
    (snap) => {
      const entries: CaptainLeaderboardEntry[] = snap.docs.map((d) => {
        const raw = d.data() as Record<string, unknown>;
        const driverId = String(raw.driver_id || d.id);
        const displayName = String(raw.display_name || 'SHINE Captain');
        const resolvedCode = formatShortDriverId(
          driverId,
          raw.partner_rider_id ? String(raw.partner_rider_id) : null,
          raw.driverCode ? String(raw.driverCode) : raw.short_id ? String(raw.short_id) : null,
          displayName
        );
        return {
          driver_id: driverId,
          display_name: displayName,
          city: String(raw.city || ''),
          vehicle_category: (raw.vehicle_category as VehicleCategory) || 'cab',
          partner_rider_id: raw.partner_rider_id ? String(raw.partner_rider_id) : null,
          short_id: resolvedCode,
          driverCode: resolvedCode,
          weekly_earnings_inr: Number(raw.weekly_earnings_inr ?? 0),
          weekly_rides: Number(raw.weekly_rides ?? 0),
          rating_average: typeof raw.rating_average === 'number' ? raw.rating_average : null,
          total_rides: Number(raw.total_rides ?? 0),
          avatar_url: raw.avatar_url ? String(raw.avatar_url) : null,
          updated_at: tsToIso(raw.updated_at),
        };
      });
      onEntries(sortLeaderboardCaptains(entries, 'earnings'));
    },
    () => {
      onEntries([]);
    }
  );
}

export async function syncCaptainLeaderboardEntry(
  profile: DriverProfile,
  vehicleCategory: VehicleCategory,
  weeklyEarningsInr: number,
  weeklyRides: number
): Promise<void> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db || !auth?.currentUser || auth.currentUser.uid !== profile.driver_id) return;

  const resolvedCode =
    profile.driverCode ||
    profile.short_id ||
    formatShortDriverId(profile.driver_id, profile.partner_rider_id, profile.short_id, profile.full_name);

  try {
    await setDoc(doc(db, 'captain_leaderboard', profile.driver_id), {
      driver_id: profile.driver_id,
      display_name: profile.full_name || 'SHINE Captain',
      city: profile.city || 'India',
      vehicle_category: vehicleCategory,
      partner_rider_id: profile.partner_rider_id || null,
      short_id: resolvedCode,
      driverCode: resolvedCode,
      weekly_earnings_inr: Number(Math.max(0, weeklyEarningsInr).toFixed(2)),
      weekly_rides: Math.max(0, Math.round(weeklyRides)),
      rating_average: profile.rating_average ?? null,
      total_rides: Math.max(0, Math.round(profile.total_rides || 0)),
      avatar_url: profile.avatar_url || null,
      updated_at: serverTimestamp(),
    });
  } catch {
    // Non-fatal leaderboard publish
  }
}

