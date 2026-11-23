import type { ScreenId } from '../contracts/types';

export interface ScreenDirectoryItem {
  id: ScreenId;
  label: string;
  group:
    | 'Auth & Onboarding'
    | 'KYC & Vehicle'
    | 'Duty & Dispatch'
    | 'Active Trip'
    | 'Earnings & History'
    | 'Account & Safety';
}

export const SCREEN_DIRECTORY: ScreenDirectoryItem[] = [
  { id: 'splash', label: 'Splash Screen', group: 'Auth & Onboarding' },
  { id: 'onboarding', label: 'Driver Onboarding', group: 'Auth & Onboarding' },
  { id: 'login_otp', label: 'Mobile OTP Login', group: 'Auth & Onboarding' },
  { id: 'registration', label: 'Driver Registration', group: 'Auth & Onboarding' },
  { id: 'personal_details', label: 'Personal Details', group: 'KYC & Vehicle' },
  { id: 'vehicle_selection', label: 'Vehicle Selection', group: 'KYC & Vehicle' },
  { id: 'vehicle_details', label: 'Vehicle Details', group: 'KYC & Vehicle' },
  { id: 'document_upload', label: 'Document Upload', group: 'KYC & Vehicle' },
  { id: 'kyc_pending', label: 'KYC & Admin Pending', group: 'KYC & Vehicle' },
  { id: 'kyc_decision', label: 'KYC Approved / Rejected', group: 'KYC & Vehicle' },
  { id: 'dashboard', label: 'Driver Home Dashboard', group: 'Duty & Dispatch' },
  { id: 'online_mode', label: 'Online / Offline Mode', group: 'Duty & Dispatch' },
  { id: 'ai_copilot', label: 'Gemini AI & Maps Co-Pilot', group: 'Duty & Dispatch' },
  { id: 'incoming_ride', label: 'Incoming Ride Request', group: 'Duty & Dispatch' },
  { id: 'ride_accept_decision', label: 'Ride Accept / Reject', group: 'Duty & Dispatch' },
  { id: 'pickup_navigation', label: 'Pickup Navigation', group: 'Active Trip' },
  { id: 'customer_details', label: 'Customer Details', group: 'Active Trip' },
  { id: 'pickup_otp', label: 'Pickup OTP Verification', group: 'Active Trip' },
  { id: 'active_ride', label: 'Active Ride Screen', group: 'Active Trip' },
  { id: 'ride_completion', label: 'Ride Completion', group: 'Active Trip' },
  { id: 'earnings', label: 'Earnings Dashboard', group: 'Earnings & History' },
  { id: 'wallet', label: 'Wallet', group: 'Earnings & History' },
  { id: 'payout_history', label: 'Payout History', group: 'Earnings & History' },
  { id: 'ride_history', label: 'Ride History', group: 'Earnings & History' },
  { id: 'ratings', label: 'Ratings & Reviews', group: 'Earnings & History' },
  { id: 'top_captains', label: 'Top Captains Leaderboard', group: 'Earnings & History' },
  { id: 'notifications', label: 'Notifications', group: 'Account & Safety' },
  { id: 'profile', label: 'Profile & Settings', group: 'Account & Safety' },
  { id: 'support', label: 'Customer Support', group: 'Account & Safety' },
  { id: 'emergency_sos', label: 'Emergency SOS', group: 'Account & Safety' },
];

export const SCREEN_TITLES: Record<ScreenId, string> = SCREEN_DIRECTORY.reduce(
  (acc, item) => {
    acc[item.id] = item.label;
    return acc;
  },
  {} as Record<ScreenId, string>
);
