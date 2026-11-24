import type {
  CaptainLeaderboardEntry,
  DriverProfile,
  RideStatus,
  VehicleRecord,
} from './types';

export interface OnlineEligibilityResult {
  allowed: boolean;
  blockers: string[];
}

/**
 * Enforces the production SHINE CAB DRIVER approval gate:
 * A driver cannot go online or receive rides until profile, documents,
 * vehicle verification, admin approval, and active account status are all satisfied.
 */
export function canDriverGoOnline(
  driver: DriverProfile | null | undefined,
  vehicle: VehicleRecord | null | undefined
): OnlineEligibilityResult {
  const blockers: string[] = [];

  if (!driver) {
    blockers.push('Driver profile is not authenticated or synced with the backend.');
    return { allowed: false, blockers };
  }

  if (!driver.profile_completed) {
    blockers.push('Personal details must be completed.');
  }
  if (!driver.documents_uploaded) {
    blockers.push('Required KYC documents must be uploaded.');
  }
  if (!vehicle || vehicle.verification_status !== 'verified' || !driver.vehicle_verified) {
    blockers.push('Vehicle verification must be completed.');
  }
  if (!driver.admin_approved && driver.kyc_status !== 'approved') {
    blockers.push('Super Admin approval is pending or not granted.');
  }
  if (driver.account_status !== 'active') {
    blockers.push(`Driver account status is "${driver.account_status}" (must be "active").`);
  }

  return {
    allowed: blockers.length === 0,
    blockers,
  };
}

const VALID_RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  searching: ['offered', 'accepted', 'cancelled'],
  requested: ['searching', 'offered', 'accepted', 'cancelled'],
  offered: ['accepted', 'searching', 'cancelled'],
  accepted: ['arriving', 'arrived', 'cancelled'],
  arriving: ['arrived', 'cancelled'],
  arrived: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

export function canTransitionRideState(current: RideStatus, next: RideStatus): boolean {
  return VALID_RIDE_TRANSITIONS[current].includes(next);
}

export function validateIndianPhone(input: string): { valid: boolean; normalized: string } {
  const digits = input.replace(/\D/g, '');
  const trimmed = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
  const valid = /^[6-9]\d{9}$/.test(trimmed);
  return {
    valid,
    normalized: valid ? `+91${trimmed}` : input,
  };
}

export function validateVehicleRegNumber(reg: string): boolean {
  const cleaned = reg.trim().toUpperCase().replace(/\s+/g, '');
  return (
    /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{3,4}$/.test(cleaned) ||
    /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(cleaned)
  );
}

export function validateEmail(email: string): boolean {
  const cleaned = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned);
}

export function validateAdultDob(dob: string, minAge = 18): boolean {
  if (!dob.trim()) return true;
  const parsed = new Date(dob);
  if (Number.isNaN(parsed.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDiff = today.getMonth() - parsed.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }
  return age >= minAge && age <= 100;
}

export function validateVehicleYear(yearStr: string): boolean {
  if (!yearStr.trim()) return true;
  const year = Number(yearStr);
  const maxYear = new Date().getFullYear() + 1;
  return Number.isInteger(year) && year >= 1995 && year <= maxYear;
}

export function validateUpiId(upi: string): boolean {
  const cleaned = upi.trim();
  return /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9]{1,64}$/.test(cleaned);
}

export function validateIfscCode(ifsc: string): boolean {
  const cleaned = ifsc.trim().toUpperCase();
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleaned);
}

export function generateSixDigitOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const PAN_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function extractNamePrefixLetters(fullName?: string | null): string {
  if (!fullName) return '';
  const cleaned = fullName.trim();
  if (!cleaned || /^shine\s*captain$/i.test(cleaned)) return '';
  const letters = cleaned.toUpperCase().replace(/[^A-Z]/g, '');
  return letters.length >= 2 ? letters.slice(0, 2) : '';
}

/**
 * Generates a deterministic PAN-card style 10-character alphanumeric Driver ID:
 * SHN + 2 uppercase letters + 4 digits + 1 uppercase check letter (e.g. SHNRA4829K).
 */
export function generatePanDriverId(seed: string, fullName?: string | null): string {
  const safeSeed = seed.trim() || 'SHINECAPTAIN';
  let hash = 2166136261;
  for (let i = 0; i < safeSeed.length; i += 1) {
    hash ^= safeSeed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  const nameLetters = extractNamePrefixLetters(fullName);
  const firstLetter = nameLetters
    ? nameLetters[0]
    : PAN_LETTERS[hash % PAN_LETTERS.length];
  const secondLetter = nameLetters
    ? nameLetters[1]
    : PAN_LETTERS[(hash >>> 5) % PAN_LETTERS.length];

  const fourDigits = String(1000 + ((hash >>> 10) % 9000));
  const stem = `SHN${firstLetter}${secondLetter}${fourDigits}`;

  let checkSum = 0;
  for (let i = 0; i < stem.length; i += 1) {
    checkSum += stem.charCodeAt(i) * (i + 3);
  }
  const checkLetter = String.fromCharCode(65 + (checkSum % 26));
  return `${stem}${checkLetter}`;
}

export function validateDriverCode(input: string): { valid: boolean; normalized: string } {
  const normalized = input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const valid = /^SHN[A-Z]{2}\d{4}[A-Z]$/.test(normalized) || /^[A-Z]{5}\d{4}[A-Z]$/.test(normalized);
  return { valid, normalized };
}

export function formatShortDriverId(
  driverId: string,
  partnerRiderId?: string | null,
  shortId?: string | null,
  fullName?: string | null
): string {
  if (shortId) {
    const cleanedShort = shortId.trim().toUpperCase();
    if (/^[A-Z]{5}\d{4}[A-Z]$/.test(cleanedShort)) {
      return cleanedShort;
    }
  }
  if (partnerRiderId) {
    const cleanedPartner = partnerRiderId.trim().toUpperCase();
    if (/^[A-Z]{5}\d{4}[A-Z]$/.test(cleanedPartner)) {
      return cleanedPartner;
    }
  }
  return generatePanDriverId(driverId, fullName);
}

export interface WeeklyGoalProgress {
  goalInr: number;
  earnedInr: number;
  remainingInr: number;
  progressPct: number;
  goalAchieved: boolean;
}

export function computeWeeklyGoalProgress(
  weeklyEarningsInr: number,
  goalInr: number | null | undefined
): WeeklyGoalProgress {
  const safeGoal =
    typeof goalInr === 'number' && Number.isFinite(goalInr) && goalInr >= 500
      ? Math.round(goalInr)
      : 10000;
  const safeEarned = Math.max(0, Number(weeklyEarningsInr.toFixed(2)));
  const remainingInr = Math.max(0, Number((safeGoal - safeEarned).toFixed(2)));
  const progressPct = Math.min(100, Math.round((safeEarned / safeGoal) * 100));
  return {
    goalInr: safeGoal,
    earnedInr: safeEarned,
    remainingInr,
    progressPct,
    goalAchieved: safeEarned >= safeGoal,
  };
}

export function sortLeaderboardCaptains(
  entries: CaptainLeaderboardEntry[],
  sortBy: 'earnings' | 'rating' = 'earnings'
): CaptainLeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (sortBy === 'rating') {
      const ratingDiff = (b.rating_average ?? 0) - (a.rating_average ?? 0);
      if (Math.abs(ratingDiff) > 0.001) return ratingDiff;
      return b.weekly_earnings_inr - a.weekly_earnings_inr;
    }
    const earnDiff = b.weekly_earnings_inr - a.weekly_earnings_inr;
    if (Math.abs(earnDiff) > 0.01) return earnDiff;
    return (b.rating_average ?? 0) - (a.rating_average ?? 0);
  });
}

