import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Car,
  CheckCircle2,
  ChevronRight,
  Compass,
  FileCheck2,
  Globe,
  Headphones,
  Landmark,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  Navigation,
  PhoneCall,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Star,
  Sun,
  Trash2,
  UserCheck,
  UserPlus,
  Volume2,
} from 'lucide-react';
import { BrandLogo } from '../branding/BrandLogo';
import { PartnerWorkspaceGrid } from '../components/PartnerWorkspaceGrid';
import { PhotoActionButtons } from '../components/PhotoCaptureControl';
import type { ScreenId, SosAlertRecord } from '../contracts/types';
import { PrimaryButton, StateNotice } from '../components/UiPrimitives';
import { INDIAN_LANGUAGES, type IndianLanguageCode } from '../i18n/translations';
import { playRideOfferAlert } from '../services/adapters/soundAlert';
import { driverBackendService } from '../services/driverBackendService';
import { getFirebaseAuth } from '../services/firebaseClient';
import { useDriverApp } from '../state/DriverAppContext';

type ProfileTab =
  | 'account'
  | 'dispatch'
  | 'navigation'
  | 'alerts'
  | 'safety'
  | 'integrations';

interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}

const SettingToggleRow: React.FC<SettingToggleProps> = ({
  title,
  description,
  checked,
  onChange,
}) => (
  <div className="flex items-center justify-between gap-4 py-3.5">
    <div className="min-w-0">
      <p className="text-sm font-semibold text-[#1E1E1E] dark:text-white">{title}</p>
      <p className="mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      onClick={onChange}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-[#F5C518]' : 'bg-neutral-300 dark:bg-neutral-700'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-[#1E1E1E] transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  </div>
);

export const NotificationsScreen: React.FC = () => {
  const { backendConfigured, loading, driverProfile, notifications, refreshDriverWorkspace } =
    useDriverApp();
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'ride' | 'kyc' | 'payout' | 'safety'>(
    'all'
  );
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const filteredNotifications = useMemo(() => {
    if (categoryFilter === 'all') return notifications;
    return notifications.filter((n) => n.category === categoryFilter);
  }, [notifications, categoryFilter]);

  const handleMarkRead = async (id: string) => {
    setBusyNotificationId(id);
    await driverBackendService.account.markNotificationRead(id);
    await refreshDriverWorkspace();
    setBusyNotificationId(null);
  };

  const handleMarkAllRead = async () => {
    if (!driverProfile || unreadCount === 0) return;
    setMarkingAll(true);
    await driverBackendService.account.markAllNotificationsRead(driverProfile.driver_id);
    await refreshDriverWorkspace();
    setMarkingAll(false);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-[#1E1E1E] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3.5">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#F5C518]">
              SHINE CAPTAIN DISPATCH &amp; ACCOUNT INBOX
            </p>
            <div className="mt-2 flex items-baseline gap-2.5">
              <h1 className="font-mono-num text-3xl font-extrabold tracking-tight text-white">
                {backendConfigured ? unreadCount : '—'}
              </h1>
              <span className="text-xs font-medium text-neutral-400">Unread Notices</span>
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Live Firestore stream for KYC approvals, ride dispatches, payouts &amp; safety alerts
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshDriverWorkspace()}
              disabled={loading}
              aria-label="Refresh notifications"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-700 bg-[#262626] px-3.5 text-xs font-semibold text-white hover:border-neutral-500"
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {unreadCount > 0 && driverProfile && (
              <button
                type="button"
                disabled={markingAll}
                onClick={() => void handleMarkAllRead()}
                className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#F5C518] px-3.5 text-xs font-bold text-[#1E1E1E] disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {markingAll ? 'Updating…' : `Mark All Read (${unreadCount})`}
              </button>
            )}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-1.5 border-t border-neutral-800 pt-4">
          {(['all', 'ride', 'kyc', 'payout', 'safety'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`min-h-[36px] rounded-lg px-3 text-xs font-semibold capitalize transition-colors ${
                categoryFilter === cat
                  ? 'bg-[#F5C518] text-[#1E1E1E]'
                  : 'bg-[#262626] text-neutral-300 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {!backendConfigured || notifications.length === 0 ? (
        <StateNotice
          variant={backendConfigured ? 'empty' : 'unconfigured'}
          title={backendConfigured ? 'Inbox Empty' : 'Notification Feed Unconfigured'}
          description="Real-time Firestore notifications from ride dispatch, Super Admin KYC reviews, and payouts appear here automatically."
        />
      ) : filteredNotifications.length === 0 ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-8 text-center dark:border-neutral-800 dark:bg-[#14161A]">
          <Bell className="mx-auto h-6 w-6 text-neutral-400" />
          <p className="mt-2 text-sm font-bold">No {categoryFilter.toUpperCase()} Alerts</p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            Switch category filters to view other recorded alerts.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-neutral-200 rounded-2xl border border-neutral-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-[#14161A]">
          {filteredNotifications.map((n) => (
            <div key={n.notification_id} className="flex items-start justify-between gap-4 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    n.read ? 'bg-neutral-300 dark:bg-neutral-700' : 'bg-[#F5C518]'
                  }`}
                />
                <div>
                  <p className="text-sm font-semibold text-[#1E1E1E] dark:text-white">{n.title}</p>
                  <p className="mt-0.5 text-xs text-neutral-600 dark:text-neutral-400">{n.body}</p>
                  <p className="font-mono-num mt-1.5 text-[11px] uppercase text-neutral-400">
                    {n.category} · {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              {!n.read && (
                <button
                  type="button"
                  disabled={busyNotificationId === n.notification_id}
                  onClick={() => void handleMarkRead(n.notification_id)}
                  className="min-h-[38px] shrink-0 rounded-xl border border-neutral-300 px-3 text-xs font-semibold hover:border-[#F5C518] disabled:opacity-50 dark:border-neutral-700"
                >
                  {busyNotificationId === n.notification_id ? 'Updating…' : 'Mark Read'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ProfileScreen: React.FC = () => {
  const {
    theme,
    toggleTheme,
    backendConfigured,
    loading,
    driverProfile,
    vehicle,
    documents,
    onlineEligibility,
    integrationStatuses,
    dispatchPreferences,
    updateDispatchPreferences,
    appSettings,
    updateAppSettings,
    avatarPreviewUrl,
    driverAvatarUrl,
    uploadingAvatar,
    uploadOrSetProfilePhoto,
    clearProfilePhoto,
    liveLocation,
    locationError,
    watchingGps,
    toggleWatchGps,
    requestGpsFix,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
    t,
  } = useDriverApp();

  const [activeTab, setActiveTab] = useState<ProfileTab>('account');
  const [signingOut, setSigningOut] = useState(false);

  const verifiedDocsCount = documents.filter((d) => d.status === 'verified').length;
  const complianceChecks: { label: string; ok: boolean; screen: ScreenId }[] = [
    { label: 'Profile', ok: Boolean(driverProfile?.profile_completed), screen: 'personal_details' },
    { label: 'Docs', ok: Boolean(driverProfile?.documents_uploaded), screen: 'document_upload' },
    {
      label: 'Vehicle',
      ok: Boolean(driverProfile?.vehicle_verified && vehicle?.verification_status === 'verified'),
      screen: 'vehicle_details',
    },
    { label: 'Admin', ok: Boolean(driverProfile?.admin_approved), screen: 'kyc_pending' },
    { label: 'Active', ok: driverProfile?.account_status === 'active', screen: 'kyc_decision' },
  ];
  const verifiedGatesCount = complianceChecks.filter((c) => c.ok).length;

  const handleSignOut = async () => {
    setSigningOut(true);
    const res = await driverBackendService.auth.signOut();
    setSigningOut(false);
    if (!res.ok) {
      setFeedback({
        type: 'info',
        title: 'Sign Out Unavailable',
        message: res.error?.message || 'No active Firebase partner session.',
      });
      return;
    }
    await refreshDriverWorkspace();
    navigate('login_otp');
  };

  const quickDirectoryLinks: {
    id: ScreenId;
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'personal_details',
      title: 'Personal & Emergency Details',
      subtitle: driverProfile?.full_name
        ? `${driverProfile.full_name} · ${driverProfile.city}`
        : 'Name, phone, city, and SOS contact',
      icon: UserCheck,
    },
    {
      id: 'vehicle_details',
      title: 'Vehicle Profile & Permits',
      subtitle: vehicle
        ? `${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`
        : 'RC, insurance expiry, and plate registration',
      icon: Car,
    },
    {
      id: 'document_upload',
      title: 'KYC Documents & Verification',
      subtitle:
        documents.length > 0
          ? `${verifiedDocsCount} verified of ${documents.length} submitted`
          : 'DL, RC, Insurance, Aadhaar/ID & Selfie',
      icon: FileCheck2,
    },
    {
      id: 'wallet',
      title: 'Bank & UPI Payout Account',
      subtitle: 'Settlement balance, cash dues & withdrawals',
      icon: Landmark,
    },
    {
      id: 'ratings',
      title: 'Partner Ratings & Reviews',
      subtitle: driverProfile?.rating_average
        ? `Average rating ${driverProfile.rating_average.toFixed(2)} / 5`
        : 'Customer feedback after completed trips',
      icon: Star,
    },
    {
      id: 'notifications',
      title: 'Notifications Center',
      subtitle: 'Ride alerts, KYC updates & settlement notices',
      icon: Bell,
    },
    {
      id: 'support',
      title: 'Partner Support & Helpdesk',
      subtitle: 'Raise fare, KYC, or payout tickets',
      icon: Headphones,
    },
    {
      id: 'emergency_sos',
      title: 'Emergency SOS & Safety Desk',
      subtitle: '24×7 escalation & GPS distress alert',
      icon: ShieldAlert,
    },
  ];

  const tabs: { id: ProfileTab; label: string }[] = [
    { id: 'account', label: 'Account & Profile' },
    { id: 'dispatch', label: 'Duty & Dispatch' },
    { id: 'navigation', label: 'Navigation & GPS' },
    { id: 'alerts', label: 'Alerts & Sound' },
    { id: 'safety', label: 'Privacy & Safety' },
    { id: 'integrations', label: 'Integrations' },
  ];

  return (
    <div className="space-y-4">
      {/* 1. DARK & GOLD PARTNER IDENTITY HERO */}
      <section className="rounded-3xl bg-[#1E1E1E] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-start gap-4">
            {driverAvatarUrl ? (
              <img
                src={driverAvatarUrl}
                alt={driverProfile?.full_name || 'Driver Profile Photo'}
                className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-2 ring-[#F5C518]"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[#F5C518] text-xl font-extrabold text-[#1E1E1E]">
                {driverProfile?.full_name
                  ? driverProfile.full_name
                      .split(' ')
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()
                  : 'SC'}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-[#F5C518]">
                SHINE CAPTAIN · ACCOUNT &amp; SETTINGS
              </p>
              <h1 className="font-display mt-1 truncate text-2xl font-extrabold tracking-tight text-white">
                {driverProfile?.full_name || 'Partner Sign-In Required'}
              </h1>
              <p className="font-mono-num mt-1 text-xs text-neutral-400">
                {driverProfile
                  ? `${driverProfile.phone || driverProfile.email || ''} · ${driverProfile.city || 'India'} · ${
                      driverProfile.driverCode ||
                      driverProfile.short_id ||
                      driverProfile.partner_rider_id
                    }`
                  : 'Upload your real photo below — synced straight to Super Admin KYC & Header'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-700 bg-[#262626] px-3.5 text-xs font-semibold text-white hover:border-neutral-500"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-[#F5C518]" />
              ) : (
                <Moon className="h-4 w-4 text-[#F5C518]" />
              )}
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </button>
            <button
              type="button"
              onClick={() => void refreshDriverWorkspace()}
              disabled={loading}
              aria-label="Refresh profile and settings"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-neutral-700 bg-[#262626] text-white hover:border-neutral-500"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <label className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-neutral-700 bg-[#262626] px-3 text-xs">
            <Globe className="h-4 w-4 shrink-0 text-[#F5C518]" />
            <span className="shrink-0 font-semibold text-neutral-300">App Language:</span>
            <select
              aria-label="Quick Profile Language Selector"
              value={appSettings.appLanguage}
              onChange={(e) =>
                updateAppSettings({ appLanguage: e.target.value as IndianLanguageCode })
              }
              className="w-full bg-transparent text-xs font-bold text-[#F5C518] outline-none"
            >
              {INDIAN_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-[#1E1E1E] text-white">
                  {lang.nativeLabel} — {lang.englishName} ({lang.regionHint})
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Real Driver Photo Camera Click & Upload Controls */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-neutral-800 bg-[#262626] p-3.5">
          <div>
            <p className="text-xs font-bold text-white">Driver Profile Photo (Header &amp; KYC Avatar)</p>
            <p className="text-[11px] text-neutral-400">
              {driverAvatarUrl
                ? 'Compressed JPEG photo synced directly to Firestore drivers.avatar_url'
                : 'Capture via camera or upload from device gallery to display in Header & Admin'}
            </p>
          </div>
          <div className="w-full space-y-2">
            <PhotoActionButtons
              onSelectFile={(file) => void uploadOrSetProfilePhoto(file)}
              facingMode="user"
              accept="image/*"
              cameraTitle="Click Driver Profile Photo"
              busy={uploadingAvatar}
              cameraLabel="Click Photo"
              uploadLabel="Upload Photo"
            />
            {avatarPreviewUrl && !driverProfile?.avatar_url && (
              <button
                type="button"
                onClick={clearProfilePhoto}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-700 px-3 text-xs font-semibold text-neutral-300 hover:border-red-400 hover:text-red-300"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear Local Photo Preview
              </button>
            )}
          </div>
        </div>

        {/* Identity Status Strip */}
        <div className="mt-4 grid grid-cols-2 gap-3.5 border-t border-neutral-800 pt-3.5">
          <div>
            <p className="text-[11px] text-neutral-400">Account Status</p>
            <p
              className={`mt-0.5 text-sm font-bold capitalize ${
                driverProfile?.admin_approved ? 'text-emerald-400' : 'text-[#F5C518]'
              }`}
            >
              {driverProfile
                ? driverProfile.admin_approved
                  ? 'Active & Approved'
                  : (driverProfile.account_status || 'pending_setup').replace('_', ' ')
                : 'Unauthenticated'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">KYC Verification</p>
            <p className="mt-0.5 text-sm font-bold capitalize text-white">
              {driverProfile
                ? (driverProfile.kyc_status || 'not_submitted').replace('_', ' ')
                : 'Pending Sign-In'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Assigned Vehicle</p>
            <p className="font-mono-num mt-0.5 truncate text-sm font-bold text-white">
              {vehicle
                ? `${vehicle.registration_number} (${(vehicle.category || 'cab').toUpperCase()})`
                : 'Not Linked'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-neutral-400">Captain Driver ID</p>
            <p className="font-mono-num mt-0.5 truncate text-sm font-bold text-[#F5C518]">
              {driverProfile?.driverCode ||
                driverProfile?.short_id ||
                driverProfile?.partner_rider_id ||
                'Generated On Sign-In'}
            </p>
          </div>
        </div>

        {/* KYC Authentication & 5-Gate Readiness Hub */}
        <div className="mt-4 space-y-3 border-t border-neutral-800 pt-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-neutral-400">
              KYC &amp; Compliance Readiness
            </span>
            <span className="font-mono-num text-xs font-bold text-[#F5C518]">
              {verifiedGatesCount}/5 Gates
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {complianceChecks.map((check) => (
              <button
                key={check.label}
                type="button"
                title={`${check.label}: ${check.ok ? 'Verified' : 'Pending'}`}
                onClick={() => navigate(check.screen)}
                className={`h-2 flex-1 rounded-full transition-colors ${
                  check.ok ? 'bg-[#F5C518]' : 'bg-neutral-700 hover:bg-neutral-500'
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-left">
            <button
              type="button"
              onClick={() => navigate('document_upload')}
              className="rounded-xl border border-neutral-800 bg-[#262626] p-2.5 hover:border-[#F5C518]"
            >
              <p className="text-[10px] text-neutral-400">KYC Docs</p>
              <p className="font-mono-num mt-0.5 text-xs font-bold text-white">
                {verifiedDocsCount}/9 Verified
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate('vehicle_details')}
              className="rounded-xl border border-neutral-800 bg-[#262626] p-2.5 hover:border-[#F5C518]"
            >
              <p className="text-[10px] text-neutral-400">Insurance</p>
              <p className="font-mono-num mt-0.5 truncate text-xs font-bold text-white">
                {vehicle?.insurance_expiry || 'Pending'}
              </p>
            </button>
            <button
              type="button"
              onClick={() => navigate('vehicle_details')}
              className="rounded-xl border border-neutral-800 bg-[#262626] p-2.5 hover:border-[#F5C518]"
            >
              <p className="text-[10px] text-neutral-400">RC Expiry</p>
              <p className="font-mono-num mt-0.5 truncate text-xs font-bold text-white">
                {vehicle?.rc_expiry || 'Pending'}
              </p>
            </button>
          </div>

          {(!driverProfile || !onlineEligibility.allowed) && (
            <div className="space-y-2.5 rounded-2xl border border-neutral-800 bg-[#262626] p-3">
              <p className="text-xs font-bold text-[#F5C518]">
                {!driverProfile
                  ? 'Partner Sign-In & KYC Authentication'
                  : 'Approval Gates Remaining Before Duty'}
              </p>
              <p className="text-[11px] leading-relaxed text-neutral-300">
                {!driverProfile
                  ? 'Sign in with Google or Mobile OTP to submit your Driver & Vehicle documents and receive your Admin-approved Partner Rider ID.'
                  : onlineEligibility.blockers.join(' · ')}
              </p>
              <div className="flex flex-wrap gap-2">
                {!driverProfile ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate('login_otp')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#F5C518] px-3 text-xs font-bold text-[#1E1E1E]"
                    >
                      <LogIn className="h-3.5 w-3.5" />
                      {t.loginBtn}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('registration')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#14161A] px-3 text-xs font-bold text-white hover:border-[#F5C518]"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-[#F5C518]" />
                      {t.signupBtn}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate('registration')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#F5C518] px-3 text-xs font-bold text-[#1E1E1E]"
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      Upload Docs
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('kyc_pending')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#14161A] px-3 text-xs font-bold text-white hover:border-[#F5C518]"
                    >
                      Check Rider ID
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* 2. SETTINGS SECTION NAVIGATION TABS */}
      <nav
        aria-label="Profile Settings Categories"
        className="flex gap-1.5 overflow-x-auto rounded-2xl border border-neutral-200 bg-white p-1.5 dark:border-neutral-800 dark:bg-[#14161A]"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`min-h-[42px] shrink-0 rounded-xl px-3.5 text-xs font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-[#1E1E1E] text-white dark:bg-[#F5C518] dark:text-[#1E1E1E]'
                : 'text-neutral-600 hover:text-[#1E1E1E] dark:text-neutral-400 dark:hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 3. ACTIVE SETTINGS PAGE CONTENT */}
      {activeTab === 'account' && (
        <div className="space-y-4">
          <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
            <div className="border-b border-neutral-200 pb-3 dark:border-neutral-800">
              <h2 className="font-display text-base font-bold">Account &amp; Partner Records</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Manage personal KYC, vehicle permits, bank account, and safety records
              </p>
            </div>

            <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
              {quickDirectoryLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => navigate(item.id)}
                    className="flex min-h-[60px] w-full items-center justify-between gap-3 py-3 text-left transition-colors hover:opacity-80"
                  >
                    <div className="flex min-w-0 items-center gap-3.5">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7F8FA] text-[#1E1E1E] dark:bg-[#1A1D23] dark:text-[#F5C518]">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="space-y-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
              <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
                <div>
                  <h2 className="font-display text-base font-bold">App Display &amp; Language</h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Saved locally on this device
                  </p>
                </div>
                <Globe className="h-4 w-4 text-[#F5C518]" />
              </div>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                    Interface Theme
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => theme === 'dark' && toggleTheme()}
                      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-xs font-semibold ${
                        theme === 'light'
                          ? 'border-[#1E1E1E] bg-[#1E1E1E] text-white'
                          : 'border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <Sun className="h-4 w-4" />
                      Light Theme
                    </button>
                    <button
                      type="button"
                      onClick={() => theme === 'light' && toggleTheme()}
                      className={`flex min-h-[44px] items-center justify-center gap-2 rounded-xl border text-xs font-semibold ${
                        theme === 'dark'
                          ? 'border-[#F5C518] bg-[#F5C518] text-[#1E1E1E]'
                          : 'border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      <Moon className="h-4 w-4" />
                      Dark Theme
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label
                    htmlFor="profile-language-select"
                    className="block text-xs font-semibold text-neutral-500 dark:text-neutral-400"
                  >
                    App Language Dropdown (14 Languages)
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 dark:border-neutral-700 dark:bg-[#1A1D23]">
                    <Globe className="h-4 w-4 shrink-0 text-[#F5C518]" />
                    <select
                      id="profile-language-select"
                      value={appSettings.appLanguage}
                      onChange={(e) =>
                        updateAppSettings({ appLanguage: e.target.value as IndianLanguageCode })
                      }
                      className="min-h-[46px] w-full bg-transparent text-sm font-semibold text-[#1E1E1E] outline-none dark:text-white"
                    >
                      {INDIAN_LANGUAGES.map((lang) => (
                        <option
                          key={lang.code}
                          value={lang.code}
                          className="bg-white text-[#1E1E1E] dark:bg-[#14161A] dark:text-white"
                        >
                          {lang.nativeLabel} ({lang.englishName} · {lang.regionHint})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
              <BrandLogo size="sm" showTagline />
              <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
                Unified ecosystem identity shared across Customer App, Driver App, and Super Admin
                Panel on Cloud Firestore.
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {driverProfile && backendConfigured ? (
                  <PrimaryButton
                    variant="outline"
                    className="w-full"
                    disabled={signingOut}
                    onClick={() => void handleSignOut()}
                  >
                    <LogOut className="h-4 w-4" />
                    {signingOut ? 'Signing Out…' : 'Sign Out of Partner Session'}
                  </PrimaryButton>
                ) : (
                  <div className="flex w-full flex-col gap-2">
                    <PrimaryButton
                      variant="brand"
                      className="w-full"
                      onClick={() => navigate('login_otp')}
                    >
                      <LogIn className="h-4 w-4" />
                      Partner Sign-In (Google &amp; Mobile OTP)
                    </PrimaryButton>
                    <PrimaryButton
                      variant="outline"
                      className="w-full"
                      onClick={async () => {
                        const res = await driverBackendService.auth.signInWithGoogle();
                        if (!res.ok) {
                          setFeedback({
                            type: 'error',
                            title: 'Google Sign-In Failed',
                            message: res.error?.message || 'Unable to sign in with Google.',
                          });
                          return;
                        }
                        await refreshDriverWorkspace();
                        setFeedback({
                          type: 'success',
                          title: 'Google Account Linked',
                          message: 'Synced partner workspace and AI chat history with Google.',
                        });
                      }}
                    >
                      <LogIn className="h-4 w-4" />
                      Continue with Google
                    </PrimaryButton>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {activeTab === 'dispatch' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">Duty &amp; Dispatch Controls</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Configure ride offer preferences (subject to admin approval and vehicle verification)
              </p>
            </div>
            <Sliders className="h-4 w-4 text-[#F5C518]" />
          </div>

          <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            <SettingToggleRow
              title="Auto-Accept Eligible Rides"
              description="Automatically accept incoming rides matching your approved category when online."
              checked={dispatchPreferences.autoAcceptEligible}
              onChange={() =>
                updateDispatchPreferences({
                  autoAcceptEligible: !dispatchPreferences.autoAcceptEligible,
                })
              }
            />
            <SettingToggleRow
              title="Accept Cash Fares"
              description="Receive direct cash rides alongside UPI, card, and wallet trips."
              checked={dispatchPreferences.acceptCashRides}
              onChange={() =>
                updateDispatchPreferences({
                  acceptCashRides: !dispatchPreferences.acceptCashRides,
                })
              }
            />
            <SettingToggleRow
              title="Go-Home Destination Filter"
              description="Prefer ride requests heading toward your saved end-of-shift destination."
              checked={dispatchPreferences.homewardFilterEnabled}
              onChange={() =>
                updateDispatchPreferences({
                  homewardFilterEnabled: !dispatchPreferences.homewardFilterEnabled,
                })
              }
            />
          </div>

          {dispatchPreferences.homewardFilterEnabled && (
            <div className="mt-4 space-y-2 rounded-xl bg-[#F7F8FA] p-4 dark:bg-[#1A1D23]">
              <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                Saved Homeward Destination Area
              </label>
              <input
                type="text"
                value={dispatchPreferences.homewardDestination}
                onChange={(e) =>
                  updateDispatchPreferences({ homewardDestination: e.target.value })
                }
                placeholder="e.g. Indiranagar Metro, Bengaluru"
                className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-white px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#14161A]"
              />
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            <PrimaryButton variant="brand" onClick={() => navigate('online_mode')}>
              Open Online Duty Control
            </PrimaryButton>
            <PrimaryButton variant="outline" onClick={() => navigate('kyc_decision')}>
              Check 5-Gate Approval Status
            </PrimaryButton>
          </div>
        </section>
      )}

      {activeTab === 'navigation' && (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">Navigation &amp; Hardware GPS</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                OpenStreetMap + OSRM routing &amp; real browser Geolocation settings
              </p>
            </div>
            <Compass className="h-4 w-4 text-[#F5C518]" />
          </div>

          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Preferred Navigation Engine
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {(
                [
                  {
                    id: 'in_app_gps',
                    title: 'In-App OpenStreetMap + OSRM',
                    subtitle: '100% free interactive Leaflet map with live km/h speedometer',
                  },
                  {
                    id: 'google_maps',
                    title: 'External Maps App',
                    subtitle: 'Also show quick deep-link button to open native turn-by-turn Maps',
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => updateAppSettings({ preferredNavigationApp: opt.id })}
                  className={`flex min-h-[64px] items-start gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                    appSettings.preferredNavigationApp === opt.id
                      ? 'border-[#1E1E1E] bg-[#1E1E1E] text-white dark:border-[#F5C518] dark:bg-[#F5C518] dark:text-[#1E1E1E]'
                      : 'border-neutral-200 bg-[#F7F8FA] dark:border-neutral-700 dark:bg-[#1A1D23]'
                  }`}
                >
                  <Navigation className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="text-xs font-bold">{opt.title}</p>
                    <p className="mt-0.5 text-[11px] opacity-80">{opt.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            <SettingToggleRow
              title="Voice Turn-by-Turn Prompts"
              description="Speak upcoming turns and pickup arrival cues during navigation."
              checked={appSettings.voiceGuidanceEnabled}
              onChange={() =>
                updateAppSettings({ voiceGuidanceEnabled: !appSettings.voiceGuidanceEnabled })
              }
            />
            <SettingToggleRow
              title="High-Accuracy Satellite GPS"
              description="Request fine GPS accuracy during active pickups and drops."
              checked={appSettings.highAccuracyGps}
              onChange={() => updateAppSettings({ highAccuracyGps: !appSettings.highAccuracyGps })}
            />
            <SettingToggleRow
              title="Continuous Hardware GPS Stream"
              description="Stream live browser coordinates and km/h speed to Firestore when online."
              checked={watchingGps}
              onChange={toggleWatchGps}
            />
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-xl bg-[#F7F8FA] p-4 dark:bg-[#1A1D23] sm:flex-row sm:items-center">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#F5C518]" />
              <div>
                <p className="text-xs font-semibold">Hardware GPS Sensor Readout</p>
                <p className="font-mono-num mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
                  {liveLocation
                    ? `${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)} · ${Math.round(liveLocation.speed_kmh ?? 0)} km/h · ±${liveLocation.accuracy_m ?? '—'}m`
                    : locationError || 'No active GPS fix captured yet'}
                </p>
              </div>
            </div>
            <PrimaryButton variant="outline" onClick={() => void requestGpsFix()}>
              Test Device GPS
            </PrimaryButton>
          </div>
        </section>
      )}

      {activeTab === 'alerts' && (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">Alerts, Ringtone &amp; Notifications</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Customize incoming ride alert cues and account notification channels
              </p>
            </div>
            <Volume2 className="h-4 w-4 text-[#F5C518]" />
          </div>

          <div>
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              Incoming Ride Offer Alert Style
            </p>
            <div className="mt-2 grid grid-cols-1 gap-2">
              {(
                [
                  { id: 'urgent_bell', label: 'Urgent Dispatch Bell' },
                  { id: 'chime', label: 'Standard Chime' },
                  { id: 'vibrate_only', label: 'Vibrate Only' },
                ] as const
              ).map((tone) => (
                <button
                  key={tone.id}
                  type="button"
                  onClick={() => updateAppSettings({ rideOfferRingtone: tone.id })}
                  className={`min-h-[44px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                    appSettings.rideOfferRingtone === tone.id
                      ? 'border-[#1E1E1E] bg-[#1E1E1E] text-white dark:border-[#F5C518] dark:bg-[#F5C518] dark:text-[#1E1E1E]'
                      : 'border-neutral-200 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  {tone.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            <SettingToggleRow
              title="Payout & Bank Settlement Alerts"
              description="Notify immediately when wallet withdrawals settle or commission dues post."
              checked={appSettings.payoutAlerts}
              onChange={() => updateAppSettings({ payoutAlerts: !appSettings.payoutAlerts })}
            />
            <SettingToggleRow
              title="KYC & Admin Approval Updates"
              description="Notify when Super Admin approves or flags uploaded driver documents."
              checked={appSettings.kycAlerts}
              onChange={() => updateAppSettings({ kycAlerts: !appSettings.kycAlerts })}
            />
            <SettingToggleRow
              title="Safety & SOS SMS Alerts"
              description="Receive critical route safety advisories and account security alerts."
              checked={appSettings.safetySmsAlerts}
              onChange={() => updateAppSettings({ safetySmsAlerts: !appSettings.safetySmsAlerts })}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              variant="outline"
              onClick={() => playRideOfferAlert(appSettings.rideOfferRingtone)}
            >
              <Volume2 className="h-4 w-4 text-[#F5C518]" />
              Test Alert Sound
            </PrimaryButton>
            <PrimaryButton variant="brand" onClick={() => navigate('notifications')}>
              Open Notification Inbox
            </PrimaryButton>
          </div>
        </section>
      )}

      {activeTab === 'safety' && (
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">Privacy, Security &amp; Safety</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Trip location sharing, OTP verification safeguards, and SOS contact details
              </p>
            </div>
            <Lock className="h-4 w-4 text-[#F5C518]" />
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-[#F7F8FA] p-4 dark:bg-[#1A1D23]">
            <div>
              <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                Registered Emergency Contact
              </p>
              <p className="mt-0.5 text-sm font-bold">
                {driverProfile?.emergency_contact_name
                  ? `${driverProfile.emergency_contact_name} · ${driverProfile.emergency_contact_phone || ''}`
                  : 'No emergency contact saved yet'}
              </p>
            </div>
            <PrimaryButton variant="outline" onClick={() => navigate('personal_details')}>
              Update Contact
            </PrimaryButton>
          </div>

          <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
            <SettingToggleRow
              title="Share Live Location During Active Trips"
              description="Transmit real-time GPS to SHINE CAB Customer App and Safety Desk while on a trip."
              checked={appSettings.shareLiveLocationOnTrip}
              onChange={() =>
                updateAppSettings({
                  shareLiveLocationOnTrip: !appSettings.shareLiveLocationOnTrip,
                })
              }
            />
            <SettingToggleRow
              title="Pickup OTP Security Lock"
              description="Require strict 4-digit customer OTP match before transitioning ride to In Progress."
              checked={appSettings.autoLockOtpOnAttempts}
              onChange={() =>
                updateAppSettings({
                  autoLockOtpOnAttempts: !appSettings.autoLockOtpOnAttempts,
                })
              }
            />
            <SettingToggleRow
              title="Auto-Notify Emergency Contact on SOS"
              description="Include registered emergency contact whenever SOS escalation is triggered."
              checked={appSettings.autoNotifyEmergencyOnSos}
              onChange={() =>
                updateAppSettings({
                  autoNotifyEmergencyOnSos: !appSettings.autoNotifyEmergencyOnSos,
                })
              }
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <PrimaryButton variant="danger" onClick={() => navigate('emergency_sos')}>
              <ShieldAlert className="h-4 w-4" />
              Open Emergency SOS Desk
            </PrimaryButton>
            <PrimaryButton variant="outline" onClick={() => navigate('support')}>
              <Headphones className="h-4 w-4" />
              Contact Safety Support
            </PrimaryButton>
          </div>
        </section>
      )}

      {activeTab === 'integrations' && (
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">
                Firebase, Maps &amp; Device Sensors Matrix
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                100% live Firestore, OpenStreetMap, OSRM, and Device Hardware capabilities
              </p>
            </div>
            <ShieldCheck className="h-4 w-4 text-[#F5C518]" />
          </div>

          <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            {integrationStatuses.map((status) => (
              <div
                key={status.id}
                className="flex flex-col gap-2 py-3.5"
              >
                <div>
                  <p className="text-sm font-semibold">{status.label}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{status.notes}</p>
                  {status.missingEnvVars.length > 0 && (
                    <p className="font-mono-num mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                      Required: {status.missingEnvVars.join(' · ')}
                    </p>
                  )}
                </div>
                <span
                  className={`flex shrink-0 items-center gap-1.5 text-xs font-bold ${
                    status.configured
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {status.configured && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {status.mode === 'live'
                    ? 'Active'
                    : status.mode === 'browser_native'
                      ? 'Device Native'
                      : 'Configuration Required'}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <PartnerWorkspaceGrid
        title="All Partner Workspace Icons &amp; Modules"
        subtitle="Direct access to every SHINE CAPTAIN tool, document upload, trip control, and safety screen"
      />
    </div>
  );
};

export const SupportScreen: React.FC = () => {
  const {
    backendConfigured,
    driverProfile,
    rideHistory,
    supportTickets,
    setSupportTickets,
    setFeedback,
    navigate,
  } = useDriverApp();
  const [subject, setSubject] = useState('');
  const [rideId, setRideId] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const quickTopics = [
    'KYC & Document Review Follow-up',
    'Bank Payout / Wallet Settlement Delay',
    'Trip Fare or Commission Adjustment',
    'GPS / Navigation / App Technical Issue',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      setFeedback({
        type: 'error',
        title: 'Ticket Details Required',
        message: 'Provide a subject and clear description of your issue.',
      });
      return;
    }
    if (!driverProfile) {
      setFeedback({
        type: 'error',
        title: 'Partner Sign-In Required',
        message: 'Sign in with Google or Mobile OTP to raise a support ticket in Cloud Firestore.',
      });
      return;
    }
    setSubmitting(true);
    const res = await driverBackendService.account.createSupportTicket(
      driverProfile.driver_id,
      subject.trim(),
      description.trim(),
      rideId.trim() || undefined
    );
    setSubmitting(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Ticket Submission Failed',
        message: res.error?.message || 'Unable to submit ticket.',
      });
      return;
    }
    if (res.data) {
      const created = res.data;
      setSupportTickets((prev) => [created, ...prev]);
    }
    setSubject('');
    setRideId('');
    setDescription('');
    setFeedback({
      type: 'success',
      title: 'Support Ticket Created',
      message: `Ticket ID: ${res.data?.ticket_id}`,
    });
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-[#1E1E1E] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3.5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold tracking-wider text-[#F5C518]">
                SHINE CAPTAIN PARTNER HELPDESK
              </p>
              {(driverProfile?.driverCode || driverProfile?.short_id) && (
                <span className="font-mono-num rounded-md bg-[#F5C518]/15 px-2 py-0.5 text-[11px] font-bold text-[#F5C518]">
                  ID: {driverProfile.driverCode || driverProfile.short_id}
                </span>
              )}
            </div>
            <h1 className="font-display mt-1 text-2xl font-extrabold tracking-tight text-white">
              24×7 Operations Support
            </h1>
            <p className="mt-1 text-xs text-neutral-400">
              Raise fare, KYC verification, wallet payout, or trip disputes directly to SHINE CAB Ops
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton variant="brand" onClick={() => navigate('ai_copilot')}>
              <Sparkles className="h-4 w-4" />
              Ask Gemini AI Co-Pilot
            </PrimaryButton>
            <PrimaryButton variant="danger" onClick={() => navigate('emergency_sos')}>
              <ShieldAlert className="h-4 w-4" />
              Emergency SOS
            </PrimaryButton>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-neutral-800 pt-4">
          {quickTopics.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setSubject(topic)}
              className={`min-h-[36px] rounded-xl px-3 text-xs font-semibold transition-colors ${
                subject === topic
                  ? 'bg-[#F5C518] text-[#1E1E1E]'
                  : 'bg-[#262626] text-neutral-300 hover:text-white'
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]"
      >
        <div className="flex items-center gap-2 border-b border-neutral-200 pb-3 text-sm font-bold dark:border-neutral-800">
          <Headphones className="h-4 w-4 text-[#F5C518]" />
          <span>Create Operations Support Ticket</span>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Issue Subject</label>
          <input
            type="text"
            placeholder="Select a quick topic above or enter subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="min-h-[46px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Related Ride ID (Optional)</label>
          {rideHistory.length > 0 && (
            <select
              value={rideId}
              onChange={(e) => setRideId(e.target.value)}
              className="font-mono-num mb-2 min-h-[46px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-xs outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
            >
              <option value="">Select from recent recorded rides (optional)</option>
              {rideHistory.slice(0, 10).map((r) => (
                <option key={r.ride_id} value={r.ride_id}>
                  {r.ride_id} — {r.pickup_address} → {r.dropoff_address}
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Paste Ride ID from Ride History"
            value={rideId}
            onChange={(e) => setRideId(e.target.value)}
            className="font-mono-num min-h-[46px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold">Detailed Description</label>
          <textarea
            rows={4}
            placeholder="Describe what happened with exact time, pickup/drop location, or payout reference"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] p-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
        </div>

        <PrimaryButton type="submit" variant="brand" disabled={submitting}>
          {submitting ? 'Submitting Ticket…' : 'Submit Support Ticket'}
        </PrimaryButton>
      </form>

      <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
          <div>
            <h2 className="font-display text-base font-bold">Submitted Support Tickets</h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Live resolution status synced from Firestore support_tickets
            </p>
          </div>
          <span className="font-mono-num text-xs font-bold text-[#1E1E1E] dark:text-[#F5C518]">
            {supportTickets.length}
          </span>
        </div>

        {supportTickets.length === 0 ? (
          <p className="py-5 text-center text-xs text-neutral-500 dark:text-neutral-400">
            {backendConfigured
              ? 'No support tickets raised yet.'
              : 'Submitted support tickets appear here once Firebase is initialized.'}
          </p>
        ) : (
          <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
            {supportTickets.map((ticket) => (
              <div key={ticket.ticket_id} className="space-y-1 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-bold">{ticket.subject}</p>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      ticket.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : ticket.status === 'in_review'
                          ? 'bg-[#F5C518]/20 text-[#1E1E1E] dark:text-[#F5C518]'
                          : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
                    }`}
                  >
                    {(ticket.status || 'open').replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 dark:text-neutral-400">
                  {ticket.description}
                </p>
                <p className="font-mono-num text-[11px] text-neutral-400">
                  {ticket.ticket_id} · {new Date(ticket.created_at).toLocaleString()}
                  {ticket.ride_id ? ` · Ride ${ticket.ride_id}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export const EmergencySosScreen: React.FC = () => {
  const {
    driverProfile,
    activeRide,
    liveLocation,
    locationError,
    requestGpsFix,
    setFeedback,
    navigate,
  } = useDriverApp();
  const [triggering, setTriggering] = useState(false);
  const [sosAlerts, setSosAlerts] = useState<SosAlertRecord[]>([]);

  const activeDriverId = driverProfile?.driver_id || getFirebaseAuth()?.currentUser?.uid || null;

  useEffect(() => {
    if (!activeDriverId) {
      setSosAlerts([]);
      return;
    }
    const unsub = driverBackendService.account.subscribeSosAlerts(activeDriverId, setSosAlerts);
    return unsub;
  }, [activeDriverId]);

  const handleTriggerSos = async () => {
    setTriggering(true);
    try {
      const freshPoint = await requestGpsFix();
      if (!activeDriverId) {
        setFeedback({
          type: 'error',
          title: 'Partner Sign-In Required for Cloud SOS',
          message:
            'Emergency SOS writes an immediate real-time alert to Firestore sos_alerts for the SHINE CAPTAIN safety desk. For immediate danger, dial 112 directly.',
        });
        return;
      }
      const res = await driverBackendService.account.triggerSos(
        activeDriverId,
        activeRide?.ride_id,
        freshPoint ?? liveLocation ?? undefined
      );
      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'SOS Dispatch Failed',
          message: res.error?.message || 'Dial 112 immediately.',
        });
        return;
      }
      setFeedback({
        type: 'success',
        title: 'SOS Alert Logged & Live',
        message: `Alert ID ${res.data?.alert_id} transmitted via Firestore to SHINE CAPTAIN Safety Desk.`,
      });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-red-200 bg-red-50/80 p-4 dark:border-red-900/60 dark:bg-red-950/30">
        <div className="flex items-start gap-3.5">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-600 text-white">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <div className="space-y-1.5">
            <p className="text-xs font-bold tracking-wider text-red-700 dark:text-red-300">
              24×7 SAFETY ESCALATION COMMAND
            </p>
            <h1 className="font-display text-2xl font-extrabold text-red-950 dark:text-red-100">
              Emergency SOS
            </h1>
            <p className="text-sm leading-relaxed text-red-900/80 dark:text-red-200/80">
              Triggering SOS captures your hardware GPS coordinates and alerts SHINE CAB Safety
              Operations in real time via Firestore along with your emergency contact.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5">
          <PrimaryButton variant="danger" className="w-full" disabled={triggering} onClick={() => void handleTriggerSos()}>
            <ShieldAlert className="h-4 w-4" />
            {triggering ? 'Transmitting SOS…' : 'Trigger Safety Desk SOS'}
          </PrimaryButton>
          <a
            href="tel:112"
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-red-300 bg-white px-5 text-sm font-bold text-red-700 hover:bg-red-50 dark:border-red-800 dark:bg-[#14161A] dark:text-red-300"
          >
            <PhoneCall className="h-4 w-4" />
            Call National Emergency (112)
          </a>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4">
        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">Live Hardware GPS Lock</h2>
            <MapPin className="h-4 w-4 text-[#F5C518]" />
          </div>
          <p className="font-mono-num mt-2 text-sm font-semibold">
            {liveLocation
              ? `${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)} · ±${liveLocation.accuracy_m ?? '—'}m`
              : locationError || 'Location not acquired yet'}
          </p>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            {activeRide
              ? `Attached Active Ride: ${activeRide.ride_id}`
              : 'No active trip currently in progress'}
          </p>
          <PrimaryButton variant="outline" className="mt-4" onClick={() => void requestGpsFix()}>
            Acquire Current GPS Fix
          </PrimaryButton>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold">Emergency Contact</h2>
            <PhoneCall className="h-4 w-4 text-[#F5C518]" />
          </div>
          <p className="mt-2 text-sm font-semibold">
            {driverProfile?.emergency_contact_name || 'Not configured'}
          </p>
          <p className="font-mono-num mt-0.5 text-xs text-neutral-500 dark:text-neutral-400">
            {driverProfile?.emergency_contact_phone || 'Add an emergency contact in Personal Details'}
          </p>
          <PrimaryButton
            variant="outline"
            className="mt-4"
            onClick={() => navigate('personal_details')}
          >
            Manage Emergency Contact
          </PrimaryButton>
        </div>

        {/* Live SOS Alert History */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-sm font-bold">Live SOS Escalation Log</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Real-time Firestore status (triggered → acknowledged → resolved)
              </p>
            </div>
            <span className="font-mono-num text-xs font-bold text-[#F5C518]">
              {sosAlerts.length}
            </span>
          </div>

          {sosAlerts.length === 0 ? (
            <p className="py-4 text-xs text-neutral-500 dark:text-neutral-400">
              No SOS alerts dispatched from this account.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-neutral-200 dark:divide-neutral-800">
              {sosAlerts.map((alert) => (
                <div key={alert.alert_id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-mono-num truncate text-xs font-bold">{alert.alert_id}</p>
                    <p className="font-mono-num text-[11px] text-neutral-500">
                      {new Date(alert.created_at).toLocaleString()}
                      {alert.lat != null && alert.lng != null
                        ? ` · ${alert.lat.toFixed(4)}, ${alert.lng.toFixed(4)}`
                        : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                      alert.status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                        : alert.status === 'acknowledged'
                          ? 'bg-[#F5C518]/25 text-[#1E1E1E] dark:text-[#F5C518]'
                          : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                    }`}
                  >
                    {alert.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
