import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { IntegrationStatus } from '../contracts/integrations';
import type {
  CaptainLeaderboardEntry,
  DocumentType,
  DriverDocumentRecord,
  DriverNotification,
  DriverProfile,
  DriverRatingRecord,
  EarningsSummary,
  FareConfigRecord,
  GeoPoint,
  PayoutRecord,
  RideRecord,
  ScreenId,
  SupportTicket,
  SystemIntegrationLiveKeys,
  VehicleCategory,
  VehicleRecord,
  WalletAccount,
  WalletTransactionRecord,
} from '../contracts/types';
import { canDriverGoOnline, type OnlineEligibilityResult } from '../contracts/validators';
import {
  getTranslations,
  type AppTranslations,
  type IndianLanguageCode,
} from '../i18n/translations';
import { liveLocationAdapter } from '../services/adapters/locationAdapter';
import { playRideOfferAlert } from '../services/adapters/soundAlert';
import { getAllIntegrationStatuses, isFirebaseConfigured } from '../services/config';
import {
  computeEarningsFromRides,
  driverBackendService,
  getFallbackDriverProfile,
  saveFallbackDriverProfile,
  subscribeDriverDocuments,
  subscribeDriverProfile,
  subscribeDriverRides,
  subscribeFareConfigs,
  subscribeSystemIntegrationsLiveKeys,
  subscribeTopCaptains,
  subscribeWalletAccount,
  subscribeWalletTransactions,
  syncCaptainLeaderboardEntry,
} from '../services/driverBackendService';
import { getFirebaseAuth, testFirestoreConnection } from '../services/firebaseClient';
import { compressFileToFirestoreDataUrl } from '../services/imageCompressor';

export interface OnboardingDraft {
  phone: string;
  fullName: string;
  email: string;
  city: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  vehicleCategory: VehicleCategory;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: string;
  vehicleColor: string;
  registrationNumber: string;
  permitNumber: string;
  insuranceExpiry: string;
  rcExpiry: string;
  selectedFiles: Partial<Record<DocumentType, string>>;
}

export interface DispatchPreferences {
  autoAcceptEligible: boolean;
  acceptCashRides: boolean;
  homewardFilterEnabled: boolean;
  homewardDestination: string;
}

export interface AppSettings {
  appLanguage: IndianLanguageCode;
  preferredNavigationApp: 'in_app_gps' | 'google_maps';
  voiceGuidanceEnabled: boolean;
  highAccuracyGps: boolean;
  rideOfferRingtone: 'chime' | 'urgent_bell' | 'vibrate_only';
  payoutAlerts: boolean;
  kycAlerts: boolean;
  safetySmsAlerts: boolean;
  shareLiveLocationOnTrip: boolean;
  autoLockOtpOnAttempts: boolean;
  autoNotifyEmergencyOnSos: boolean;
}

export interface ServiceFeedback {
  type: 'info' | 'error' | 'success';
  title: string;
  message: string;
  missingEnvVars?: string[];
}

interface DriverAppContextValue {
  currentScreen: ScreenId;
  canGoBack: boolean;
  navigate: (screen: ScreenId) => void;
  goBack: () => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  backendConfigured: boolean;
  integrationStatuses: IntegrationStatus[];
  loading: boolean;
  driverProfile: DriverProfile | null;
  vehicle: VehicleRecord | null;
  documents: DriverDocumentRecord[];
  onlineEligibility: OnlineEligibilityResult;
  onlineSince: string | null;
  activeRide: RideRecord | null;
  setActiveRide: (ride: RideRecord | null) => void;
  lastCompletedRide: RideRecord | null;
  setLastCompletedRide: (ride: RideRecord | null) => void;
  incomingOffer: RideRecord | null;
  setIncomingOffer: (ride: RideRecord | null) => void;
  earningsPeriod: EarningsSummary['period'];
  setEarningsPeriod: (p: EarningsSummary['period']) => void;
  earnings: EarningsSummary | null;
  wallet: WalletAccount | null;
  setWallet: (wallet: WalletAccount | null) => void;
  walletTransactions: WalletTransactionRecord[];
  payouts: PayoutRecord[];
  rideHistory: RideRecord[];
  ratings: DriverRatingRecord[];
  notifications: DriverNotification[];
  supportTickets: SupportTicket[];
  setSupportTickets: React.Dispatch<React.SetStateAction<SupportTicket[]>>;
  liveLocation: GeoPoint | null;
  locationError: string | null;
  watchingGps: boolean;
  toggleWatchGps: () => void;
  requestGpsFix: () => Promise<GeoPoint | null>;
  onboardingDraft: OnboardingDraft;
  updateDraft: (patch: Partial<OnboardingDraft>) => void;
  dispatchPreferences: DispatchPreferences;
  updateDispatchPreferences: (patch: Partial<DispatchPreferences>) => void;
  appSettings: AppSettings;
  updateAppSettings: (patch: Partial<AppSettings>) => void;
  t: AppTranslations;
  avatarPreviewUrl: string | null;
  driverAvatarUrl: string | null;
  uploadingAvatar: boolean;
  uploadOrSetProfilePhoto: (file: File) => Promise<void>;
  clearProfilePhoto: () => void;
  stagedDocFiles: Partial<Record<DocumentType, File>>;
  stageDocumentFile: (docType: DocumentType, file: File) => void;
  feedback: ServiceFeedback | null;
  clearFeedback: () => void;
  setFeedback: (fb: ServiceFeedback | null) => void;
  refreshDriverWorkspace: () => Promise<void>;
  togglingDuty: boolean;
  toggleOnlineStatus: () => Promise<void>;
  directoryOpen: boolean;
  setDirectoryOpen: (open: boolean) => void;
  fareConfigs: FareConfigRecord[];
  liveIntegrationKeys: SystemIntegrationLiveKeys | null;
  topCaptains: CaptainLeaderboardEntry[];
  weeklyGoalInr: number;
  saveWeeklyGoal: (goalInr: number) => Promise<void>;
}

const DEFAULT_DRAFT: OnboardingDraft = {
  phone: '',
  fullName: '',
  email: '',
  city: '',
  dateOfBirth: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  vehicleCategory: 'cab',
  vehicleMake: '',
  vehicleModel: '',
  vehicleYear: '',
  vehicleColor: '',
  registrationNumber: '',
  permitNumber: '',
  insuranceExpiry: '',
  rcExpiry: '',
  selectedFiles: {},
};

const DEFAULT_PREFERENCES: DispatchPreferences = {
  autoAcceptEligible: false,
  acceptCashRides: true,
  homewardFilterEnabled: false,
  homewardDestination: '',
};

const DEFAULT_APP_SETTINGS: AppSettings = {
  appLanguage: 'en',
  preferredNavigationApp: 'in_app_gps',
  voiceGuidanceEnabled: true,
  highAccuracyGps: true,
  rideOfferRingtone: 'urgent_bell',
  payoutAlerts: true,
  kycAlerts: true,
  safetySmsAlerts: true,
  shareLiveLocationOnTrip: true,
  autoLockOtpOnAttempts: true,
  autoNotifyEmergencyOnSos: true,
};

const DriverAppContext = createContext<DriverAppContextValue | null>(null);

export const DriverAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [screenStack, setScreenStack] = useState<ScreenId[]>(['splash']);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = window.localStorage.getItem('shine_cab_driver_theme');
        if (saved === 'dark' || saved === 'light') return saved;
      } catch {
        // Ignore storage read restrictions
      }
    }
    return 'light';
  });
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingDuty, setTogglingDuty] = useState(false);
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(() =>
    getFallbackDriverProfile()
  );
  const [vehicle, setVehicle] = useState<VehicleRecord | null>(null);
  const [documents, setDocuments] = useState<DriverDocumentRecord[]>([]);
  const [onlineSince, setOnlineSince] = useState<string | null>(null);
  const [activeRide, setActiveRide] = useState<RideRecord | null>(null);
  const [lastCompletedRide, setLastCompletedRide] = useState<RideRecord | null>(null);
  const [incomingOffer, setIncomingOffer] = useState<RideRecord | null>(null);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsSummary['period']>('daily');
  const [wallet, setWallet] = useState<WalletAccount | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransactionRecord[]>([]);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [rideHistory, setRideHistory] = useState<RideRecord[]>([]);
  const [ratings, setRatings] = useState<DriverRatingRecord[]>([]);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [fareConfigs, setFareConfigs] = useState<FareConfigRecord[]>([]);
  const [liveIntegrationKeys, setLiveIntegrationKeys] = useState<SystemIntegrationLiveKeys | null>(null);
  const [topCaptains, setTopCaptains] = useState<CaptainLeaderboardEntry[]>([]);
  const [localWeeklyGoalInr, setLocalWeeklyGoalInr] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('shine_cab_weekly_goal_inr');
        const parsed = raw ? Number(raw) : NaN;
        if (Number.isFinite(parsed) && parsed >= 500) return Math.round(parsed);
      } catch {
        // Ignore storage read errors
      }
    }
    return 10000;
  });
  const [liveLocation, setLiveLocation] = useState<GeoPoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [watchingGps, setWatchingGps] = useState(false);
  const lastLocationSyncRef = useRef<number>(0);
  const activeRideRef = useRef<RideRecord | null>(null);
  const incomingOfferRef = useRef<RideRecord | null>(null);

  const [onboardingDraft, setOnboardingDraft] = useState<OnboardingDraft>(DEFAULT_DRAFT);
  const [dispatchPreferences, setDispatchPreferences] = useState<DispatchPreferences>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('shine_cab_driver_prefs');
        if (raw) return { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<DispatchPreferences>) };
      } catch {
        return DEFAULT_PREFERENCES;
      }
    }
    return DEFAULT_PREFERENCES;
  });
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('shine_cab_driver_app_settings');
        if (raw) return { ...DEFAULT_APP_SETTINGS, ...(JSON.parse(raw) as Partial<AppSettings>) };
      } catch {
        return DEFAULT_APP_SETTINGS;
      }
    }
    return DEFAULT_APP_SETTINGS;
  });
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        return window.localStorage.getItem('shine_cab_driver_avatar_preview');
      } catch {
        return null;
      }
    }
    return null;
  });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [stagedDocFiles, setStagedDocFiles] = useState<Partial<Record<DocumentType, File>>>({});
  const [feedback, setFeedback] = useState<ServiceFeedback | null>(null);
  const ringtoneRef = useRef(appSettings.rideOfferRingtone);

  useEffect(() => {
    ringtoneRef.current = appSettings.rideOfferRingtone;
  }, [appSettings.rideOfferRingtone]);

  useEffect(() => {
    activeRideRef.current = activeRide;
  }, [activeRide]);

  useEffect(() => {
    incomingOfferRef.current = incomingOffer;
  }, [incomingOffer]);

  const backendConfigured = isFirebaseConfigured();
  const integrationStatuses = useMemo(() => getAllIntegrationStatuses(), []);
  const t = useMemo(() => getTranslations(appSettings.appLanguage), [appSettings.appLanguage]);

  const earnings = useMemo(
    () => (driverProfile ? computeEarningsFromRides(rideHistory, earningsPeriod) : null),
    [driverProfile, rideHistory, earningsPeriod]
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('shine_cab_driver_theme', theme);
      } catch {
        // Ignore storage write restrictions
      }
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('shine_cab_driver_prefs', JSON.stringify(dispatchPreferences));
      } catch {
        // Ignore storage write restrictions
      }
    }
  }, [dispatchPreferences]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('shine_cab_driver_app_settings', JSON.stringify(appSettings));
      } catch {
        // Ignore storage write restrictions
      }
    }
  }, [appSettings]);

  // Verify Firestore connection on mount
  useEffect(() => {
    if (backendConfigured) {
      void testFirestoreConnection();
    }
  }, [backendConfigured]);

  // Auto-enable live GPS watch when driver goes online
  useEffect(() => {
    if (driverProfile?.is_online) {
      setWatchingGps(true);
    }
  }, [driverProfile?.is_online]);

  useEffect(() => {
    if (!watchingGps) return;
    setLocationError(null);
    const stop = liveLocationAdapter.watchPosition(
      (pt) => setLiveLocation(pt),
      (err) => setLocationError(err),
      appSettings.highAccuracyGps
    );
    return stop;
  }, [watchingGps, appSettings.highAccuracyGps]);

  const currentScreen = screenStack[screenStack.length - 1];
  const canGoBack = screenStack.length > 1;

  const navigate = useCallback((screen: ScreenId) => {
    setScreenStack((prev) => {
      if (prev[prev.length - 1] === screen) return prev;
      return [...prev.slice(-14), screen];
    });
    setDirectoryOpen(false);
  }, []);

  const goBack = useCallback(() => {
    setScreenStack((prev) => {
      if (prev.length > 1) return prev.slice(0, -1);
      if (prev[0] !== 'dashboard') return ['dashboard'];
      return prev;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const updateDraft = useCallback((patch: Partial<OnboardingDraft>) => {
    setOnboardingDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateDispatchPreferences = useCallback((patch: Partial<DispatchPreferences>) => {
    setDispatchPreferences((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateAppSettings = useCallback((patch: Partial<AppSettings>) => {
    setAppSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const stageDocumentFile = useCallback((docType: DocumentType, file: File) => {
    setStagedDocFiles((prev) => ({ ...prev, [docType]: file }));
    setOnboardingDraft((prev) => ({
      ...prev,
      selectedFiles: { ...prev.selectedFiles, [docType]: file.name },
    }));
  }, []);

  const uploadOrSetProfilePhoto = useCallback(
    async (file: File) => {
      try {
        const compressedUrl = await compressFileToFirestoreDataUrl(file, {
          maxDimension: 720,
          quality: 0.75,
        });
        setAvatarPreviewUrl(compressedUrl);
        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem('shine_cab_driver_avatar_preview', compressedUrl);
          } catch {
            // Keep in-memory preview
          }
        }
      } catch {
        // Fallback preview if compression couldn't decode image
      }

      if (!backendConfigured || !driverProfile) {
        setFeedback({
          type: 'info',
          title: 'Photo Preview Ready',
          message:
            'Your photo is compressed & ready. Sign in with Google or Phone OTP so it syncs permanently to Cloud Firestore & Super Admin.',
        });
        return;
      }

      setUploadingAvatar(true);
      const res = await driverBackendService.driver.uploadAvatar(driverProfile.driver_id, file);
      setUploadingAvatar(false);
      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'Firestore Photo Sync Failed',
          message: res.error?.message || 'Could not save compressed profile photo to Firestore.',
        });
        return;
      }
      if (res.data) {
        setDriverProfile(res.data);
      }
      setFeedback({
        type: 'success',
        title: 'Driver Photo Synced Live',
        message: 'Compressed photo saved directly in Firestore and visible to Super Admin.',
      });
    },
    [backendConfigured, driverProfile]
  );

  const driverAvatarUrl = driverProfile?.avatar_url || avatarPreviewUrl;

  const clearProfilePhoto = useCallback(() => {
    setAvatarPreviewUrl(null);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem('shine_cab_driver_avatar_preview');
      } catch {
        // Ignore storage errors
      }
    }
    setFeedback({
      type: 'info',
      title: 'Local Photo Preview Cleared',
      message: 'Capture or upload a new real photo whenever ready.',
    });
  }, []);

  const clearFeedback = useCallback(() => setFeedback(null), []);

  const toggleWatchGps = useCallback(() => {
    setWatchingGps((prev) => !prev);
  }, []);

  const requestGpsFix = useCallback(async (): Promise<GeoPoint | null> => {
    setLocationError(null);
    const result = await liveLocationAdapter.getCurrentPosition(appSettings.highAccuracyGps);
    if (result.ok && result.data) {
      setLiveLocation(result.data);
      return result.data;
    }
    setLocationError(result.error?.message || 'Unable to acquire device GPS fix.');
    return null;
  }, [appSettings.highAccuracyGps]);

  const clearSessionData = useCallback(() => {
    setDriverProfile(null);
    setVehicle(null);
    setDocuments([]);
    setActiveRide(null);
    setLastCompletedRide(null);
    setIncomingOffer(null);
    setWallet(null);
    setWalletTransactions([]);
    setPayouts([]);
    setRideHistory([]);
    setRatings([]);
    setNotifications([]);
    setSupportTickets([]);
    setOnlineSince(null);
  }, []);

  const refreshDriverWorkspace = useCallback(async () => {
    const fallback = getFallbackDriverProfile();
    if (!backendConfigured) {
      if (fallback) {
        setDriverProfile(fallback);
      } else {
        clearSessionData();
      }
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      if (fallback) {
        setDriverProfile(fallback);
        setOnboardingDraft((prev) => ({
          ...prev,
          phone: prev.phone || (fallback.phone || '').replace(/^\+91/, ''),
          fullName: prev.fullName || fallback.full_name || '',
          email: prev.email || fallback.email || '',
          city: prev.city || fallback.city || '',
        }));
      } else {
        clearSessionData();
      }
      return;
    }

    setLoading(true);
    try {
      const profileRes = await driverBackendService.driver.getProfile();
      if (!profileRes.ok || !profileRes.data) {
        if (fallback) {
          setDriverProfile(fallback);
        } else {
          clearSessionData();
        }
        return;
      }

      const profile = profileRes.data;
      saveFallbackDriverProfile(profile);
      setDriverProfile(profile);
      setOnlineSince((prev) => (profile.is_online ? prev || new Date().toISOString() : null));

      const [
        vehRes,
        docsRes,
        activeRideRes,
        walletRes,
        payoutRes,
        historyRes,
        ratingRes,
        notifRes,
        ticketRes,
      ] = await Promise.all([
        driverBackendService.vehicle.getActiveVehicle(profile.driver_id),
        driverBackendService.kyc.listDocuments(profile.driver_id),
        driverBackendService.rides.getActiveRide(profile.driver_id),
        driverBackendService.finance.getWallet(profile.driver_id),
        driverBackendService.finance.getPayoutHistory(profile.driver_id),
        driverBackendService.rides.getRideHistory(profile.driver_id),
        driverBackendService.account.getRatings(profile.driver_id),
        driverBackendService.account.getNotifications(profile.driver_id),
        driverBackendService.account.getSupportTickets(profile.driver_id),
      ]);

      const activeVehicle = vehRes.ok ? vehRes.data ?? null : null;
      if (vehRes.ok) setVehicle(activeVehicle);
      if (docsRes.ok && docsRes.data) setDocuments(docsRes.data);
      if (activeRideRes.ok) setActiveRide(activeRideRes.data ?? null);
      if (walletRes.ok) setWallet(walletRes.data ?? null);
      if (payoutRes.ok && payoutRes.data) setPayouts(payoutRes.data);
      if (historyRes.ok && historyRes.data) setRideHistory(historyRes.data);
      if (ratingRes.ok && ratingRes.data) setRatings(ratingRes.data);
      if (notifRes.ok && notifRes.data) setNotifications(notifRes.data);
      if (ticketRes.ok && ticketRes.data) setSupportTickets(ticketRes.data);

      setOnboardingDraft((prev) => ({
        ...prev,
        phone: prev.phone || (profile.phone || '').replace(/^\+91/, ''),
        fullName: prev.fullName || profile.full_name || '',
        email: prev.email || profile.email || '',
        city: prev.city || profile.city || '',
        dateOfBirth: prev.dateOfBirth || profile.date_of_birth || '',
        emergencyContactName: prev.emergencyContactName || profile.emergency_contact_name || '',
        emergencyContactPhone: prev.emergencyContactPhone || profile.emergency_contact_phone || '',
        vehicleCategory: activeVehicle?.category ?? prev.vehicleCategory,
        vehicleMake: prev.vehicleMake || activeVehicle?.make || '',
        vehicleModel: prev.vehicleModel || activeVehicle?.model || '',
        vehicleYear: prev.vehicleYear || (activeVehicle?.year ? String(activeVehicle.year) : ''),
        vehicleColor: prev.vehicleColor || activeVehicle?.color || '',
        registrationNumber: prev.registrationNumber || activeVehicle?.registration_number || '',
        permitNumber: prev.permitNumber || activeVehicle?.permit_number || '',
        insuranceExpiry: prev.insuranceExpiry || activeVehicle?.insurance_expiry || '',
        rcExpiry: prev.rcExpiry || activeVehicle?.rc_expiry || '',
      }));
    } finally {
      setLoading(false);
    }
  }, [backendConfigured, clearSessionData]);

  // Bind Firebase Auth state listener
  useEffect(() => {
    if (!backendConfigured) return;
    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        void refreshDriverWorkspace();
      } else {
        const fallback = getFallbackDriverProfile();
        if (fallback) {
          setDriverProfile(fallback);
        } else {
          clearSessionData();
        }
      }
    });
    return unsubAuth;
  }, [backendConfigured, refreshDriverWorkspace, clearSessionData]);

  // Real-time Firestore listeners for Profile, KYC Docs, Driver Rides, Wallet
  useEffect(() => {
    if (!backendConfigured || !driverProfile?.driver_id) return;
    const driverId = driverProfile.driver_id;

    const unsubProfile = subscribeDriverProfile(driverId, (updated) => {
      if (updated) {
        setDriverProfile(updated);
        setOnlineSince((prev) => (updated.is_online ? prev || new Date().toISOString() : null));
      }
    });

    const unsubDocs = subscribeDriverDocuments(driverId, (docs) => {
      setDocuments(docs);
    });

    const unsubRides = subscribeDriverRides(driverId, (rides) => {
      setRideHistory(rides);
      const currentActive =
        rides.find((r) => ['accepted', 'arriving', 'arrived', 'in_progress'].includes(r.status)) ?? null;
      setActiveRide(currentActive);
    });

    const unsubWallet = subscribeWalletAccount(driverId, (w) => {
      if (w) setWallet(w);
    });

    const unsubWalletTxs = subscribeWalletTransactions(driverId, (txs) => {
      setWalletTransactions(txs);
    });

    const unsubFareConfigs = subscribeFareConfigs((configs) => {
      setFareConfigs(configs);
    });

    const unsubLiveKeys = subscribeSystemIntegrationsLiveKeys((keys) => {
      setLiveIntegrationKeys(keys);
    });

    const unsubLeaderboard = subscribeTopCaptains((entries) => {
      setTopCaptains(entries);
    });

    return () => {
      unsubProfile();
      unsubDocs();
      unsubRides();
      unsubWallet();
      unsubWalletTxs();
      unsubFareConfigs();
      unsubLiveKeys();
      unsubLeaderboard();
    };
  }, [backendConfigured, driverProfile?.driver_id]);

  // Publish captain's live weekly summary to shared captain_leaderboard when authenticated
  useEffect(() => {
    if (!backendConfigured || !driverProfile?.driver_id) return;
    if (!driverProfile.profile_completed && rideHistory.length === 0) return;
    const weekly = computeEarningsFromRides(rideHistory, 'weekly');
    const category = vehicle?.category || onboardingDraft.vehicleCategory || 'cab';
    void syncCaptainLeaderboardEntry(
      driverProfile,
      category,
      weekly.net_earnings_inr,
      weekly.completed_rides
    );
  }, [
    backendConfigured,
    driverProfile,
    vehicle?.category,
    onboardingDraft.vehicleCategory,
    rideHistory,
  ]);

  // Stream live GPS coordinates (lat, lng, heading, speed_kmh) to Firestore every 4s while Online
  useEffect(() => {
    if (!backendConfigured || !driverProfile?.is_online || !liveLocation) return;
    if (activeRide && !appSettings.shareLiveLocationOnTrip) return;
    const now = Date.now();
    if (now - lastLocationSyncRef.current < 4000) return;
    lastLocationSyncRef.current = now;
    void driverBackendService.driver.updateLocation(
      driverProfile.driver_id,
      liveLocation,
      true,
      vehicle?.category,
      activeRide?.ride_id ?? null
    );
  }, [
    backendConfigured,
    driverProfile?.driver_id,
    driverProfile?.is_online,
    vehicle?.category,
    liveLocation,
    activeRide,
    appSettings.shareLiveLocationOnTrip,
  ]);

  // Real-time Incoming Ride Offer listener
  useEffect(() => {
    if (!backendConfigured || !driverProfile?.is_online) return;
    const category = vehicle?.category || onboardingDraft.vehicleCategory || 'cab';
    const unsubscribe = driverBackendService.rides.subscribeOffers(
      driverProfile.driver_id,
      category,
      (ride) => {
        if (activeRideRef.current) return;
        if (incomingOfferRef.current?.ride_id === ride.ride_id) return;
        playRideOfferAlert(ringtoneRef.current);
        setIncomingOffer(ride);
        navigate('incoming_ride');
      }
    );
    return unsubscribe;
  }, [
    backendConfigured,
    driverProfile?.driver_id,
    driverProfile?.is_online,
    vehicle?.category,
    onboardingDraft.vehicleCategory,
    navigate,
  ]);

  // Auto-expire incoming ride offer if offer_expires_at has elapsed
  useEffect(() => {
    if (!incomingOffer?.offer_expires_at) return;
    const expiresMs = new Date(incomingOffer.offer_expires_at).getTime() - Date.now();
    if (Number.isNaN(expiresMs)) return;
    if (expiresMs <= 0) {
      setIncomingOffer(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setIncomingOffer((cur) => (cur?.ride_id === incomingOffer.ride_id ? null : cur));
    }, expiresMs);
    return () => window.clearTimeout(timer);
  }, [incomingOffer]);

  // Real-time Ratings listener
  useEffect(() => {
    if (!backendConfigured || !driverProfile?.driver_id) return;
    const unsubscribe = driverBackendService.account.subscribeRatings(
      driverProfile.driver_id,
      (newRating) => {
        setRatings((prev) => {
          const updated = [
            newRating,
            ...prev.filter((r) => r.rating_id !== newRating.rating_id),
          ];
          const avg =
            updated.length > 0
              ? Number(
                  (
                    updated.reduce((sum, item) => sum + item.stars, 0) / updated.length
                  ).toFixed(2)
                )
              : null;
          setDriverProfile((cur) => (cur ? { ...cur, rating_average: avg } : cur));
          return updated;
        });
      }
    );
    return unsubscribe;
  }, [backendConfigured, driverProfile?.driver_id]);

  // Real-time Notifications listener
  useEffect(() => {
    if (!backendConfigured || !driverProfile?.driver_id) return;
    const unsubscribe = driverBackendService.account.subscribeNotifications(
      driverProfile.driver_id,
      (notif) => {
        setNotifications((prev) => [
          notif,
          ...prev.filter((n) => n.notification_id !== notif.notification_id),
        ]);
      }
    );
    return unsubscribe;
  }, [backendConfigured, driverProfile?.driver_id]);

  const onlineEligibility = useMemo(
    () => canDriverGoOnline(driverProfile, vehicle),
    [driverProfile, vehicle]
  );

  const toggleOnlineStatus = useCallback(async () => {
    if (togglingDuty) return;
    if (!backendConfigured) {
      setFeedback({
        type: 'error',
        title: 'Firebase Configuration Required',
        message: 'Check firebase-applet-config.json before going online.',
      });
      return;
    }

    if (!driverProfile) {
      setFeedback({
        type: 'error',
        title: 'Sign-In Required',
        message: 'Sign in with Google or Mobile OTP and complete KYC approval before going online.',
      });
      return;
    }

    const nextOnline = !driverProfile.is_online;
    if (nextOnline && !onlineEligibility.allowed) {
      setFeedback({
        type: 'error',
        title: 'Approval Gate Locked',
        message: onlineEligibility.blockers.join(' '),
      });
      return;
    }

    setTogglingDuty(true);
    try {
      const gps = nextOnline && !liveLocation ? await requestGpsFix() : liveLocation;
      const res = await driverBackendService.driver.setOnlineStatus(
        driverProfile.driver_id,
        nextOnline,
        gps ?? undefined,
        vehicle?.category
      );
      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'Duty Status Update Blocked',
          message: res.error?.message || 'Could not update duty status.',
        });
        return;
      }

      if (res.data) {
        setDriverProfile(res.data);
        setOnlineSince(res.data.is_online ? new Date().toISOString() : null);
        if (!res.data.is_online && gps) {
          void driverBackendService.driver.updateLocation(
            res.data.driver_id,
            gps,
            false,
            vehicle?.category
          );
        }
        setFeedback({
          type: 'success',
          title: res.data.is_online ? 'You are Online' : 'You are Offline',
          message: res.data.is_online
            ? 'Live GPS & Firestore Dispatch Radar are active for your vehicle.'
            : 'Ride dispatch paused.',
        });
      }
    } finally {
      setTogglingDuty(false);
    }
  }, [togglingDuty, backendConfigured, driverProfile, onlineEligibility, liveLocation, requestGpsFix, vehicle?.category]);

  const weeklyGoalInr =
    typeof driverProfile?.weekly_goal_inr === 'number' && driverProfile.weekly_goal_inr >= 500
      ? driverProfile.weekly_goal_inr
      : localWeeklyGoalInr;

  const saveWeeklyGoal = useCallback(
    async (goalInr: number) => {
      const rounded = Math.round(goalInr);
      if (!Number.isFinite(rounded) || rounded < 500 || rounded > 500000) {
        setFeedback({
          type: 'error',
          title: 'Invalid Weekly Goal',
          message: 'Enter a weekly target between ₹500 and ₹5,00,000.',
        });
        return;
      }
      setLocalWeeklyGoalInr(rounded);
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem('shine_cab_weekly_goal_inr', String(rounded));
        } catch {
          // Ignore storage write restriction
        }
      }
      if (backendConfigured && driverProfile?.driver_id) {
        const res = await driverBackendService.driver.updateWeeklyGoal(
          driverProfile.driver_id,
          rounded
        );
        if (!res.ok) {
          setFeedback({
            type: 'error',
            title: 'Weekly Goal Sync Failed',
            message: res.error?.message || 'Unable to save goal to Firestore.',
          });
          return;
        }
        if (res.data) {
          setDriverProfile(res.data);
        }
      }
      setFeedback({
        type: 'success',
        title: 'Weekly Goal Updated',
        message: `Target set to ₹${rounded.toLocaleString('en-IN')} for this week.`,
      });
    },
    [backendConfigured, driverProfile?.driver_id]
  );

  const value: DriverAppContextValue = {
    currentScreen,
    canGoBack,
    navigate,
    goBack,
    theme,
    toggleTheme,
    backendConfigured,
    integrationStatuses,
    loading,
    driverProfile,
    vehicle,
    documents,
    onlineEligibility,
    onlineSince,
    activeRide,
    setActiveRide,
    lastCompletedRide,
    setLastCompletedRide,
    incomingOffer,
    setIncomingOffer,
    earningsPeriod,
    setEarningsPeriod,
    earnings,
    wallet,
    setWallet,
    walletTransactions,
    payouts,
    rideHistory,
    ratings,
    notifications,
    supportTickets,
    setSupportTickets,
    liveLocation,
    locationError,
    watchingGps,
    toggleWatchGps,
    requestGpsFix,
    onboardingDraft,
    updateDraft,
    dispatchPreferences,
    updateDispatchPreferences,
    appSettings,
    updateAppSettings,
    t,
    avatarPreviewUrl,
    driverAvatarUrl,
    uploadingAvatar,
    uploadOrSetProfilePhoto,
    clearProfilePhoto,
    stagedDocFiles,
    stageDocumentFile,
    feedback,
    clearFeedback,
    setFeedback,
    refreshDriverWorkspace,
    togglingDuty,
    toggleOnlineStatus,
    directoryOpen,
    setDirectoryOpen,
    fareConfigs,
    liveIntegrationKeys,
    topCaptains,
    weeklyGoalInr,
    saveWeeklyGoal,
  };

  return <DriverAppContext.Provider value={value}>{children}</DriverAppContext.Provider>;
};

export function useDriverApp(): DriverAppContextValue {
  const ctx = useContext(DriverAppContext);
  if (!ctx) throw new Error('useDriverApp must be used inside DriverAppProvider');
  return ctx;
}
