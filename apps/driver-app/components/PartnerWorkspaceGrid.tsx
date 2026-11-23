import React, { useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bell,
  Bike,
  Car,
  CheckCircle2,
  Clock,
  Compass,
  FileCheck2,
  FileUp,
  Headphones,
  IndianRupee,
  KeyRound,
  Landmark,
  LogIn,
  MapPin,
  Navigation,
  Power,
  Radio,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  User,
  UserCheck,
  UserPlus,
  Wallet,
} from 'lucide-react';
import type { ScreenId } from '../contracts/types';
import { useDriverApp } from '../state/DriverAppContext';

export type WorkspaceCategory =
  | 'all'
  | 'duty_trips'
  | 'finance_ratings'
  | 'kyc_vehicle'
  | 'account_safety';

export interface WorkspaceModuleItem {
  screen: ScreenId;
  label: string;
  detail: string;
  category: Exclude<WorkspaceCategory, 'all'>;
  tone?: 'default' | 'brand' | 'danger';
  icon: React.ComponentType<{ className?: string }>;
}

interface PartnerWorkspaceGridProps {
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  compact?: boolean;
}

export const PartnerWorkspaceGrid: React.FC<PartnerWorkspaceGridProps> = ({
  title = 'Partner Workspace Modules',
  subtitle = 'Every SHINE CAPTAIN tool & screen',
  headerRight,
  compact = false,
}) => {
  const {
    currentScreen,
    navigate,
    driverProfile,
    vehicle,
    documents,
    notifications,
    activeRide,
    incomingOffer,
    wallet,
    rideHistory,
  } = useDriverApp();

  const [categoryFilter, setCategoryFilter] = useState<WorkspaceCategory>('all');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const verifiedDocsCount = documents.filter((d) => d.status === 'verified').length;

  const modules = useMemo<WorkspaceModuleItem[]>(
    () => [
      {
        screen: 'online_mode',
        label: 'Online / Offline Duty',
        detail: driverProfile?.is_online ? 'Currently Online' : 'Duty Standby',
        category: 'duty_trips',
        tone: 'brand',
        icon: Power,
      },
      {
        screen: 'ai_copilot',
        label: 'Gemini AI & Maps Co-Pilot',
        detail: 'Chat & Live Maps Grounding',
        category: 'duty_trips',
        tone: 'brand',
        icon: Sparkles,
      },
      {
        screen: 'incoming_ride',
        label: 'Incoming Ride Queue',
        detail: incomingOffer ? '1 Offer Waiting' : 'Firestore Live Dispatch',
        category: 'duty_trips',
        icon: Radio,
      },
      {
        screen: 'ride_accept_decision',
        label: 'Ride Accept / Reject',
        detail: 'Atomic Lock Claim',
        category: 'duty_trips',
        icon: CheckCircle2,
      },
      {
        screen: 'pickup_navigation',
        label: 'Pickup Navigation',
        detail: activeRide ? 'Active Pickup' : 'OSM Route & Speed',
        category: 'duty_trips',
        icon: MapPin,
      },
      {
        screen: 'customer_details',
        label: 'Customer Details & Chat',
        detail: activeRide?.customer?.display_name || 'Rider Info & Chat',
        category: 'duty_trips',
        icon: UserCheck,
      },
      {
        screen: 'pickup_otp',
        label: 'Pickup OTP Verify',
        detail: '4-Digit Rider PIN',
        category: 'duty_trips',
        icon: KeyRound,
      },
      {
        screen: 'active_ride',
        label: 'Active Trip Screen',
        detail: activeRide?.status === 'in_progress' ? 'Trip Live' : 'Dropoff Navigation',
        category: 'duty_trips',
        icon: Navigation,
      },
      {
        screen: 'ride_completion',
        label: 'Trip Fare Summary',
        detail: 'Cash / UPI Settle',
        category: 'duty_trips',
        icon: BadgeCheck,
      },
      {
        screen: 'earnings',
        label: 'Earnings Ledger',
        detail: 'Daily / Weekly / Monthly',
        category: 'finance_ratings',
        icon: IndianRupee,
      },
      {
        screen: 'wallet',
        label: 'Wallet & Cash Dues',
        detail: wallet ? `₹${wallet.available_balance_inr.toFixed(0)} Bal` : 'Balance & Dues',
        category: 'finance_ratings',
        icon: Wallet,
      },
      {
        screen: 'payout_history',
        label: 'Bank Payout Log',
        detail: 'UTR Settlements',
        category: 'finance_ratings',
        icon: Landmark,
      },
      {
        screen: 'ride_history',
        label: 'Ride History',
        detail: `${rideHistory.length} Recorded Trips`,
        category: 'finance_ratings',
        icon: Clock,
      },
      {
        screen: 'ratings',
        label: 'Customer Ratings',
        detail: driverProfile?.rating_average
          ? `${driverProfile.rating_average.toFixed(2)} ★ Avg`
          : 'Live Reviews',
        category: 'finance_ratings',
        icon: Star,
      },
      {
        screen: 'top_captains',
        label: 'Top Captains',
        detail: 'Weekly Earnings & Stars',
        category: 'finance_ratings',
        tone: 'brand',
        icon: Trophy,
      },
      {
        screen: 'registration',
        label: 'Create ID & Upload Docs',
        detail: 'Unified KYC Form',
        category: 'kyc_vehicle',
        tone: 'brand',
        icon: UserPlus,
      },
      {
        screen: 'login_otp',
        label: 'Google & OTP Login',
        detail: driverProfile ? 'Signed In' : 'Partner Sign-In',
        category: 'kyc_vehicle',
        icon: LogIn,
      },
      {
        screen: 'personal_details',
        label: 'Personal & Emergency',
        detail: driverProfile?.full_name || 'Legal Name & Phone',
        category: 'kyc_vehicle',
        icon: User,
      },
      {
        screen: 'vehicle_selection',
        label: 'Vehicle Type Select',
        detail: 'Bike · Auto · Cab',
        category: 'kyc_vehicle',
        icon: Bike,
      },
      {
        screen: 'vehicle_details',
        label: 'Vehicle & Permits',
        detail: vehicle ? vehicle.registration_number : 'RC & Insurance',
        category: 'kyc_vehicle',
        icon: Car,
      },
      {
        screen: 'document_upload',
        label: 'Upload 9 KYC Docs',
        detail: `${verifiedDocsCount}/9 Verified`,
        category: 'kyc_vehicle',
        icon: FileUp,
      },
      {
        screen: 'kyc_pending',
        label: 'Admin Approval & ID',
        detail:
          driverProfile?.driverCode ||
          driverProfile?.short_id ||
          driverProfile?.partner_rider_id ||
          'Rider ID Review',
        category: 'kyc_vehicle',
        icon: FileCheck2,
      },
      {
        screen: 'kyc_decision',
        label: '5-Gate KYC Decision',
        detail: driverProfile?.admin_approved ? 'All Gates Passed' : 'Verification Gates',
        category: 'kyc_vehicle',
        icon: ShieldCheck,
      },
      {
        screen: 'notifications',
        label: 'Notifications Inbox',
        detail: unreadCount > 0 ? `${unreadCount} Unread` : 'Alerts & Updates',
        category: 'account_safety',
        icon: Bell,
      },
      {
        screen: 'profile',
        label: 'Profile, Photo & Settings',
        detail: 'Avatar & 6 Settings',
        category: 'account_safety',
        icon: User,
      },
      {
        screen: 'onboarding',
        label: 'Language, City & OSM',
        detail: '14 Indian Languages',
        category: 'account_safety',
        icon: Compass,
      },
      {
        screen: 'support',
        label: 'Support & Helpdesk',
        detail: 'Raise Fare / KYC Ticket',
        category: 'account_safety',
        icon: Headphones,
      },
      {
        screen: 'emergency_sos',
        label: 'Emergency SOS Desk',
        detail: '24×7 Distress Alert',
        category: 'account_safety',
        tone: 'danger',
        icon: ShieldAlert,
      },
    ],
    [
      driverProfile,
      incomingOffer,
      activeRide,
      wallet,
      rideHistory.length,
      vehicle,
      verifiedDocsCount,
      unreadCount,
    ]
  );

  const visibleModules = useMemo(
    () =>
      categoryFilter === 'all'
        ? modules
        : modules.filter((m) => m.category === categoryFilter),
    [categoryFilter, modules]
  );

  const categories: { id: WorkspaceCategory; label: string }[] = [
    { id: 'all', label: `All (${modules.length})` },
    { id: 'duty_trips', label: 'Duty & Trips' },
    { id: 'finance_ratings', label: 'Finance & Ratings' },
    { id: 'kyc_vehicle', label: 'KYC & Vehicle' },
    { id: 'account_safety', label: 'Account & Safety' },
  ];

  return (
    <section className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold text-[#1E1E1E] dark:text-white">
            {title}
          </h2>
          {!compact && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">{subtitle}</p>
          )}
        </div>
        {headerRight}
      </div>

      {/* Category Filter Strip */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setCategoryFilter(cat.id)}
            className={`min-h-[36px] shrink-0 rounded-xl border px-3 text-xs font-semibold transition-colors ${
              categoryFilter === cat.id
                ? 'border-[#1E1E1E] bg-[#1E1E1E] text-white dark:border-[#F5C518] dark:bg-[#F5C518] dark:text-[#1E1E1E]'
                : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400 dark:border-neutral-800 dark:bg-[#14161A] dark:text-neutral-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Spacious, Readable Mobile 2-Column Icon Card Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {visibleModules.map((item) => {
          const Icon = item.icon;
          const isActive = currentScreen === item.screen;

          const iconWrapClass =
            item.tone === 'danger'
              ? 'bg-red-600 text-white'
              : item.tone === 'brand' || isActive
              ? 'bg-[#F5C518] text-[#1E1E1E]'
              : 'bg-[#1E1E1E] text-[#F5C518] dark:bg-[#1B1E24] dark:text-[#F5C518]';

          return (
            <button
              key={item.screen}
              type="button"
              onClick={() => navigate(item.screen)}
              className={`group flex min-h-[88px] flex-col items-start justify-between rounded-2xl border p-3.5 text-left transition-colors ${
                isActive
                  ? 'border-[#F5C518] bg-[#F5C518]/10 dark:bg-[#F5C518]/10'
                  : 'border-neutral-200 bg-white hover:border-[#1E1E1E] dark:border-neutral-800 dark:bg-[#14161A] dark:hover:border-[#F5C518]'
              }`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${iconWrapClass}`}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {item.screen === 'notifications' && unreadCount > 0 && (
                  <span className="font-mono-num flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#F5C518] px-1.5 text-[10px] font-extrabold text-[#1E1E1E]">
                    {unreadCount}
                  </span>
                )}
              </div>

              <div className="mt-2.5 w-full min-w-0">
                <p className="truncate text-xs font-bold text-[#1E1E1E] dark:text-white">
                  {item.label}
                </p>
                <p className="truncate text-[11px] text-neutral-500 dark:text-neutral-400">
                  {item.detail}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
