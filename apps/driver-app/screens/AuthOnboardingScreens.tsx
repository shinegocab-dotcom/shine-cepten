import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bike,
  Car,
  CheckCircle2,
  Compass,
  ExternalLink,
  FileUp,
  Globe,
  KeyRound,
  Lock,
  LogIn,
  MapPin,
  Navigation,
  Phone,
  RefreshCw,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Trash2,
  User,
  UserPlus,
} from 'lucide-react';
import bikeDriverImg from '../../../src/assets/images/real_bike_driver_shine_1795249498860.jpg';
import autoDriverImg from '../../../src/assets/images/real_auto_driver_1795249484808.jpg';
import cabDriverImg from '../../../src/assets/images/real_cab_driver_1795249484707.jpg';
import { BrandLogo } from '../branding/BrandLogo';
import { LiveLeafletMap } from '../components/LiveLeafletMap';
import { PhotoActionButtons } from '../components/PhotoCaptureControl';
import {
  LoadingSpinner,
  PrimaryButton,
  ScreenHeader,
  StateNotice,
} from '../components/UiPrimitives';
import type { DocumentType, DriverIdLookupResult } from '../contracts/types';
import {
  generateSixDigitOtp,
  validateAdultDob,
  validateDriverCode,
  validateEmail,
  validateIndianPhone,
  validateVehicleRegNumber,
  validateVehicleYear,
} from '../contracts/validators';
import { INDIAN_LANGUAGES } from '../i18n/translations';
import { mapsProviderAdapter } from '../services/adapters/externalAdapters';
import {
  driverBackendService,
  ensureDriverSeedDocs,
  mapFirebasePhoneAuthError,
} from '../services/driverBackendService';
import { firebaseConfig, getFirebaseAuth } from '../services/firebaseClient';
import { useDriverApp } from '../state/DriverAppContext';
import { ALL_KYC_DOCUMENTS } from './KycOnboardingScreens';

const CORE_KYC_DOC_TYPES: DocumentType[] = [
  'driver_selfie',
  'driving_license',
  'aadhaar_or_national_id',
  'vehicle_rc',
];

const TOP_INDIAN_CITIES = [
  'Delhi NCR',
  'Mumbai',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
  'Pune',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Patna',
  'Chandigarh',
];

export const SplashScreen: React.FC = () => {
  const { navigate, t } = useDriverApp();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate('onboarding');
    }, 2400);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="relative flex min-h-full flex-1 flex-col justify-between bg-[#1E1E1E] px-4 py-5 text-white">
      {/* Top-Left Skip Icon & Button -> Direct Redirect to Driver Home */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('dashboard')}
          aria-label="Skip to Home"
          className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-neutral-800 bg-[#262626] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:border-[#F5C518] hover:text-[#F5C518]"
        >
          <SkipForward className="h-4 w-4 text-[#F5C518]" />
          <span>{t.skip}</span>
        </button>

        <span className="font-mono-num text-[11px] font-semibold tracking-widest text-neutral-400">
          01 / 07
        </span>
      </div>

      <div className="mx-auto flex w-full flex-1 flex-col items-center justify-center py-6 text-center">
        <BrandLogo variant="dark" size="lg" showTagline className="justify-center" />
        <h1 className="mt-7 font-display text-2xl font-extrabold tracking-tight text-balance text-white">
          {t.splashTitle}
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-neutral-300">
          {t.splashSubtitle}
        </p>

        <div className="mt-7 grid w-full grid-cols-3 gap-2.5 text-left">
          <div className="rounded-2xl border border-neutral-800 bg-[#252525] p-3">
            <Bike className="h-5 w-5 text-[#F5C518]" />
            <p className="mt-2 text-xs font-bold text-white">Bike</p>
            <p className="text-[11px] text-neutral-400">Fast hops</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-[#252525] p-3">
            <ShieldCheck className="h-5 w-5 text-[#F5C518]" />
            <p className="mt-2 text-xs font-bold text-white">Auto</p>
            <p className="text-[11px] text-neutral-400">Daily trips</p>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-[#252525] p-3">
            <Car className="h-5 w-5 text-[#F5C518]" />
            <p className="mt-2 text-xs font-bold text-white">Cab</p>
            <p className="text-[11px] text-neutral-400">Sedan &amp; SUV</p>
          </div>
        </div>

        <div className="mt-7 flex w-full flex-col gap-2.5">
          <PrimaryButton
            variant="brand"
            className="w-full"
            onClick={() => navigate('onboarding')}
          >
            <span>{t.continueBtn}</span>
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
          <PrimaryButton
            variant="outline"
            className="w-full border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
            onClick={() => navigate('login_otp')}
          >
            <LogIn className="h-4 w-4" />
            <span>{t.loginBtn}</span>
          </PrimaryButton>
        </div>
      </div>

      <p className="text-center text-xs tracking-[0.18em] text-neutral-400">
        SHINE CAPTAIN · DRIVER APP • PARTNER
      </p>
    </div>
  );
};

export const OnboardingScreen: React.FC = () => {
  const {
    navigate,
    t,
    appSettings,
    updateAppSettings,
    onboardingDraft,
    updateDraft,
    liveLocation,
    locationError,
    watchingGps,
    toggleWatchGps,
    requestGpsFix,
    refreshDriverWorkspace,
    setFeedback,
  } = useDriverApp();

  const [step, setStep] = useState(0); // 0: Bike, 1: Auto, 2: Cab, 3: Language & City, 4: Map & Auto GPS, 5: Login & Sign Up
  const [failedSlides, setFailedSlides] = useState<Record<number, boolean>>({});
  const [slidePaused, setSlidePaused] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const totalSteps = 6;
  const isVehicleCarousel = step <= 2;

  useEffect(() => {
    if (!isVehicleCarousel || slidePaused) return;
    const timer = window.setInterval(() => {
      setStep((prev) => (prev < 2 ? prev + 1 : 0));
    }, 3500);
    return () => window.clearInterval(timer);
  }, [isVehicleCarousel, slidePaused, step]);

  const vehicleSlides = [
    {
      label: 'Bike',
      badge: '01 · BIKE TAXI PARTNER',
      title: t.bikeTitle,
      body: t.bikeBody,
      image: bikeDriverImg,
      alt: 'Real Indian bike taxi driver partner smiling on a black and yellow motorbike',
      highlights: ['Instant Bike Ride Dispatch', 'Direct UPI & Cash Fares', '24×7 SOS Protection'],
      Icon: Bike,
    },
    {
      label: 'Auto',
      badge: '02 · AUTO RICKSHAW PARTNER',
      title: t.autoTitle,
      body: t.autoBody,
      image: autoDriverImg,
      alt: 'Real Indian auto-rickshaw driver standing beside a yellow and black CNG auto',
      highlights: ['Metro & Market Hub Demand', '4-Digit Customer Pickup OTP', 'Clear Trip Accounting'],
      Icon: ShieldCheck,
    },
    {
      label: 'Cab',
      badge: '03 · CAB PARTNER (SEDAN & SUV)',
      title: t.cabTitle,
      body: t.cabBody,
      image: cabDriverImg,
      alt: 'Real Indian commercial taxi driver standing next to a white sedan cab',
      highlights: ['City & Airport Transfers', 'Free OpenStreetMap + OSRM Routing', 'Verified Bank Settlements'],
      Icon: Car,
    },
  ];

  const activeLanguageMeta =
    INDIAN_LANGUAGES.find((l) => l.code === appSettings.appLanguage) || INDIAN_LANGUAGES[0];

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    const res = await driverBackendService.auth.signInWithGoogle();
    setGoogleBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: res.error?.message || 'Unable to sign in with Google.',
      });
      return;
    }
    await refreshDriverWorkspace();
    const profileCheck = await driverBackendService.driver.getProfile();
    if (profileCheck.ok && profileCheck.data?.profile_completed && profileCheck.data?.admin_approved) {
      navigate('dashboard');
      return;
    }
    navigate('registration');
  };

  return (
    <div className="flex min-h-full flex-1 flex-col justify-between bg-[#1E1E1E] px-4 py-4 text-white">
      {/* Universal SHINE CAPTAIN Logo Bar on All Onboarding Pages */}
      <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-2.5">
        <BrandLogo variant="dark" size="xs" showTagline />
        <span className="font-mono-num text-[11px] font-bold text-neutral-400">
          0{step + 2} / 07
        </span>
      </div>

      {/* Top Bar: Vehicle Tabs on Slides 1-3 (No Skip button); Skip + Back on Steps 4-6 */}
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!isVehicleCarousel ? (
            <>
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                aria-label="Skip onboarding and open Home"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl border border-neutral-800 bg-[#262626] px-3.5 py-2 text-xs font-bold text-white transition-colors hover:border-[#F5C518] hover:text-[#F5C518]"
              >
                <SkipForward className="h-4 w-4 text-[#F5C518]" />
                <span>{t.skip}</span>
              </button>
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                aria-label="Previous onboarding page"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border border-neutral-800 bg-[#262626] text-neutral-300 hover:border-neutral-600 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-1 rounded-2xl border border-neutral-800 bg-[#262626] p-1">
              {vehicleSlides.map((slide, idx) => (
                <button
                  key={slide.label}
                  type="button"
                  onClick={() => setStep(idx)}
                  className={`min-h-[36px] rounded-xl px-3 text-xs font-bold whitespace-nowrap transition-colors ${
                    step === idx
                      ? 'bg-[#F5C518] text-[#1E1E1E]'
                      : 'text-neutral-300 hover:text-white'
                  }`}
                >
                  {slide.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              aria-label={`Go to onboarding page ${idx + 1}`}
              onClick={() => setStep(idx)}
              className={`h-2 rounded-full transition-all ${
                idx === step ? 'w-7 bg-[#F5C518]' : 'w-2 bg-neutral-700 hover:bg-neutral-500'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Main Content Card */}
      <div className="my-4 w-full flex-1">
        {/* Steps 0..2: Auto-Slide Real Photo Carousel for Bike, Auto & Cab */}
        {isVehicleCarousel && (
          <div
            onMouseEnter={() => setSlidePaused(true)}
            onMouseLeave={() => setSlidePaused(false)}
            onTouchStart={() => setSlidePaused(true)}
            onTouchEnd={() => setSlidePaused(false)}
            onTouchCancel={() => setSlidePaused(false)}
            className="overflow-hidden rounded-3xl border border-neutral-800 bg-[#252525]"
          >
            <div className="overflow-hidden">
              <div
                className="flex transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
                style={{ transform: `translateX(-${step * 100}%)` }}
              >
                {vehicleSlides.map((slide, idx) => {
                  const SlideIcon = slide.Icon;
                  const imageFailed = failedSlides[idx];
                  return (
                    <div key={slide.badge} className="w-full shrink-0">
                      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#161616]">
                        {!imageFailed ? (
                          <img
                            src={slide.image}
                            alt={slide.alt}
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedSlides((prev) => ({ ...prev, [idx]: true }))
                            }
                            className="h-full w-full object-cover object-center"
                          />
                        ) : (
                          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#252525] via-[#1E1E1E] to-[#141414] p-6 text-center">
                            <SlideIcon className="h-12 w-12 text-[#F5C518]" />
                            <p className="mt-3 text-sm font-bold text-white">{slide.title}</p>
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#252525] via-[#252525]/50 to-transparent" />
                      </div>

                      <div className="space-y-3.5 p-4 pt-2">
                        <div className="flex items-center justify-between gap-2 text-xs text-neutral-400">
                          <span className="font-bold tracking-wider text-[#F5C518]">
                            {slide.badge}
                          </span>
                          <span className="font-mono-num text-[11px] font-semibold">
                            Auto-Slide {idx + 1}/3
                          </span>
                        </div>
                        <h1 className="font-display text-xl font-extrabold tracking-tight text-balance text-white">
                          {slide.title}
                        </h1>
                        <p className="text-xs leading-relaxed text-neutral-300">
                          {slide.body}
                        </p>
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {slide.highlights.map((item) => (
                            <div
                              key={item}
                              className="flex items-center gap-2 rounded-xl border border-neutral-800 bg-[#1B1B1B] px-3 py-2 text-xs font-semibold text-neutral-200"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#F5C518]" />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: All Indian Languages + Location Select */}
        {step === 3 && (
          <div className="space-y-4 rounded-3xl border border-neutral-800 bg-[#252525] p-4">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-[#F5C518]">
                  04 · LANGUAGE &amp; OPERATING LOCATION
                </p>
                <h1 className="font-display mt-1 text-2xl font-extrabold text-white">
                  {t.langLocationTitle}
                </h1>
                <p className="mt-1 text-xs text-neutral-400">{t.langLocationSubtitle}</p>
              </div>
              <Globe className="h-6 w-6 shrink-0 text-[#F5C518]" />
            </div>

            <div>
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-300">
                  All Indian Languages (Live App Translation)
                </span>
                <span className="text-xs font-bold text-[#F5C518]">
                  Active: {activeLanguageMeta.nativeLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {INDIAN_LANGUAGES.map((lang) => {
                  const selected = appSettings.appLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => updateAppSettings({ appLanguage: lang.code })}
                      className={`flex min-h-[54px] flex-col items-start justify-center rounded-2xl border px-3 py-2 text-left transition-colors ${
                        selected
                          ? 'border-[#F5C518] bg-[#F5C518] text-[#1E1E1E]'
                          : 'border-neutral-800 bg-[#1B1B1B] text-white hover:border-neutral-600'
                      }`}
                    >
                      <span className="text-sm font-extrabold">{lang.nativeLabel}</span>
                      <span
                        className={`text-[10px] font-medium ${
                          selected ? 'text-[#1E1E1E]/80' : 'text-neutral-400'
                        }`}
                      >
                        {lang.englishName} · {lang.regionHint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 border-t border-neutral-800 pt-4">
              <label htmlFor="onboarding-city" className="block text-xs font-bold text-neutral-300">
                {t.selectCityLabel}
              </label>
              <div className="flex flex-wrap gap-2">
                {TOP_INDIAN_CITIES.map((city) => {
                  const activeCity = onboardingDraft.city.toLowerCase() === city.toLowerCase();
                  return (
                    <button
                      key={city}
                      type="button"
                      onClick={() => updateDraft({ city })}
                      className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
                        activeCity
                          ? 'border-[#F5C518] bg-[#F5C518] text-[#1E1E1E]'
                          : 'border-neutral-800 bg-[#1B1B1B] text-neutral-300 hover:border-neutral-600'
                      }`}
                    >
                      {city}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-neutral-800 bg-[#1B1B1B] px-3.5">
                <MapPin className="h-4 w-4 shrink-0 text-[#F5C518]" />
                <input
                  id="onboarding-city"
                  type="text"
                  placeholder="Or type your Indian city / district name"
                  value={onboardingDraft.city}
                  onChange={(e) => updateDraft({ city: e.target.value })}
                  className="min-h-[46px] w-full bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Live Free OpenStreetMap (Leaflet) + Auto GPS Speedometer */}
        {step === 4 && (
          <div className="space-y-4 rounded-3xl border border-neutral-800 bg-[#252525] p-4">
            <div className="flex items-start justify-between gap-3 border-b border-neutral-800 pb-4">
              <div>
                <p className="text-xs font-bold tracking-wider text-[#F5C518]">
                  05 · LIVE OPENSTREETMAP &amp; GPS SPEEDOMETER
                </p>
                <h1 className="font-display mt-1 text-2xl font-extrabold text-white">
                  {t.mapTitle}
                </h1>
                <p className="mt-1 text-xs text-neutral-400">{t.mapSubtitle}</p>
              </div>
              <Compass className="h-6 w-6 shrink-0 text-[#F5C518]" />
            </div>

            <LiveLeafletMap
              driverLocation={liveLocation}
              vehicleCategory={onboardingDraft.vehicleCategory}
              showSpeedometer
              heightClass="h-56"
              onCenterGps={() => void requestGpsFix()}
            />

            {liveLocation && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-[#1B1B1B] px-4 py-3">
                <div>
                  <p className="text-[11px] font-bold text-emerald-400">
                    GPS Location &amp; Speedometer Active
                  </p>
                  <p className="font-mono-num text-xs font-semibold text-white">
                    {liveLocation.lat.toFixed(5)}, {liveLocation.lng.toFixed(5)} ·{' '}
                    {Math.round(liveLocation.speed_kmh ?? 0)} km/h
                  </p>
                </div>
                <a
                  href={mapsProviderAdapter.openExternalTurnByTurn(
                    liveLocation.lat,
                    liveLocation.lng,
                    onboardingDraft.city || 'My Location'
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-700 px-3 text-xs font-semibold text-white hover:border-[#F5C518]"
                >
                  Open in Maps
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            )}

            {locationError && (
              <p className="rounded-xl border border-red-800/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
                {locationError}
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <PrimaryButton
                variant="brand"
                className="flex-1"
                onClick={() => void requestGpsFix()}
              >
                <Navigation className="h-4 w-4" />
                <span>{t.autoDetectGpsBtn}</span>
              </PrimaryButton>
              <PrimaryButton
                variant={watchingGps ? 'dark' : 'outline'}
                className="border-neutral-700 bg-[#1B1B1B] text-white hover:border-[#F5C518]"
                onClick={toggleWatchGps}
              >
                {watchingGps ? 'Live GPS Tracking ON' : 'Enable Live GPS Stream'}
              </PrimaryButton>
            </div>
          </div>
        )}

        {/* Step 5: Partner Account Gateway (Google Sign-In + Mobile OTP + KYC Signup) */}
        {step === 5 && (
          <div className="space-y-5 rounded-3xl border border-neutral-800 bg-[#252525] p-4">
            <div className="flex flex-col items-center text-center">
              <BrandLogo variant="dark" size="md" showTagline />
              <p className="mt-4 text-xs font-bold tracking-wider text-[#F5C518]">
                06 · PARTNER ACCOUNT ACCESS
              </p>
              <h1 className="font-display mt-1 text-xl font-extrabold text-white">
                {t.authTitle}
              </h1>
              <p className="mt-2 text-xs leading-relaxed text-neutral-300">
                {t.authSubtitle}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-neutral-800 bg-[#1B1B1B] p-3.5">
              <div>
                <p className="text-[11px] text-neutral-400">Language</p>
                <p className="mt-0.5 text-sm font-bold text-[#F5C518]">
                  {activeLanguageMeta.nativeLabel}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-neutral-400">Operating City</p>
                <p className="mt-0.5 text-sm font-bold text-white">
                  {onboardingDraft.city || 'Not selected yet'}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-neutral-400">GPS Coordinate Fix</p>
                <p className="font-mono-num mt-0.5 text-sm font-bold text-emerald-400">
                  {liveLocation
                    ? `${liveLocation.lat.toFixed(3)}, ${liveLocation.lng.toFixed(3)}`
                    : 'Optional / Later'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <PrimaryButton
                variant="brand"
                disabled={googleBusy}
                className="min-h-[52px] w-full text-sm"
                onClick={() => void handleGoogleSignIn()}
              >
                <Sparkles className="h-4 w-4" />
                <span>{googleBusy ? 'Connecting Google…' : 'Continue with Google (Instant)'}</span>
              </PrimaryButton>
              <PrimaryButton
                variant="outline"
                className="min-h-[48px] w-full border-neutral-700 bg-[#1B1B1B] text-sm text-white hover:border-[#F5C518]"
                onClick={() => navigate('login_otp')}
              >
                <LogIn className="h-4 w-4 text-[#F5C518]" />
                <span>{t.loginBtn} (Mobile OTP)</span>
              </PrimaryButton>
              <PrimaryButton
                variant="outline"
                className="min-h-[48px] w-full border-[#F5C518] bg-[#1B1B1B] text-sm text-[#F5C518] hover:bg-[#F5C518] hover:text-[#1E1E1E]"
                onClick={() => navigate('registration')}
              >
                <UserPlus className="h-4 w-4" />
                <span>{t.signupBtn}</span>
              </PrimaryButton>
            </div>

            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => navigate('dashboard')}
                className="inline-flex min-h-[44px] items-center gap-2 text-xs font-semibold text-neutral-400 transition-colors hover:text-[#F5C518]"
              >
                <SkipForward className="h-4 w-4" />
                <span>
                  {t.skip} → {t.navHome}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Onboarding Navigation Bar */}
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 pb-1">
        {isVehicleCarousel ? (
          <PrimaryButton
            variant="brand"
            className="min-h-[48px] w-full"
            onClick={() => setStep((s) => s + 1)}
          >
            <span>{t.next}</span>
            <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        ) : (
          <>
            <PrimaryButton
              variant="outline"
              className="border-neutral-700 bg-transparent text-white hover:bg-neutral-800"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t.back}</span>
            </PrimaryButton>

            {step < totalSteps - 1 ? (
              <PrimaryButton variant="brand" onClick={() => setStep((s) => s + 1)}>
                <span>{t.next}</span>
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            ) : (
              <PrimaryButton variant="brand" onClick={() => navigate('login_otp')}>
                <LogIn className="h-4 w-4" />
                <span>{t.loginBtn}</span>
              </PrimaryButton>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export const LoginOtpScreen: React.FC = () => {
  const {
    backendConfigured,
    liveIntegrationKeys,
    onboardingDraft,
    updateDraft,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
    t,
  } = useDriverApp();
  const [loginMethod, setLoginMethod] = useState<'phone' | 'driver_id'>('phone');
  const [driverIdInput, setDriverIdInput] = useState('');
  const [driverIdLookup, setDriverIdLookup] = useState<DriverIdLookupResult | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [generatedBannerOtp, setGeneratedBannerOtp] = useState<string | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [authPhase, setAuthPhase] = useState<
    'idle' | 'sending_otp' | 'verifying_otp' | 'google_signing_in'
  >('idle');
  const [resendSeconds, setResendSeconds] = useState(0);
  const [recaptchaMode, setRecaptchaMode] = useState<'invisible' | 'normal'>('invisible');
  const [useRealSmsMode, setUseRealSmsMode] = useState(false);
  const [otpError, setOtpError] = useState<{ firebaseCode?: string; message: string } | null>(null);

  const otpInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const autoFillTimerRef = useRef<number | null>(null);

  const clearRecaptchaWidget = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // Ignore cleanup failures if widget is already detached
      }
      recaptchaVerifierRef.current = null;
    }
    if (recaptchaContainerRef.current) {
      recaptchaContainerRef.current.innerHTML = '';
    }
  }, []);

  const resetOtpFlow = useCallback(() => {
    clearRecaptchaWidget();
    confirmationResultRef.current = null;
    if (autoFillTimerRef.current) {
      window.clearTimeout(autoFillTimerRef.current);
      autoFillTimerRef.current = null;
    }
  }, [clearRecaptchaWidget]);

  useEffect(() => {
    return () => {
      resetOtpFlow();
    };
  }, [resetOtpFlow]);

  useEffect(() => {
    if (!otpSent || resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [otpSent, resendSeconds]);

  const phoneValidation = validateIndianPhone(onboardingDraft.phone);
  const driverCodeValidation = validateDriverCode(driverIdInput);
  const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
  const otpCode = otpDigits.join('');
  const liveSmsConfigured = Boolean(liveIntegrationKeys?.firebase_phone_otp_enabled);

  const handleSwitchLoginMethod = (nextMethod: 'phone' | 'driver_id') => {
    if (nextMethod === loginMethod || busy) return;
    resetOtpFlow();
    setLoginMethod(nextMethod);
    setOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    setGeneratedBannerOtp(null);
    setBannerDismissed(false);
    setResendSeconds(0);
    setOtpError(null);
    setDriverIdLookup(null);
  };

  const handleGoogleSignIn = async (linkedPhone?: string) => {
    setOtpError(null);
    setGoogleBusy(true);
    setAuthPhase('google_signing_in');
    try {
      const targetPhone =
        linkedPhone || (phoneValidation.valid ? phoneValidation.normalized : undefined);
      const res = await driverBackendService.auth.signInWithGoogle(targetPhone);
      if (!res.ok) {
        const msg = res.error?.message || 'Unable to connect Google Sign-In.';
        setFeedback({
          type: 'info',
          title: 'Google Sign-In Cancelled',
          message: msg,
        });
        return;
      }
      try {
        await refreshDriverWorkspace();
      } catch {
        // Non-fatal workspace sync fallback
      }
      let profileData = null;
      try {
        const profileCheck = await driverBackendService.driver.getProfile();
        if (profileCheck.ok) {
          profileData = profileCheck.data ?? null;
        }
      } catch {
        // Non-fatal profile fetch fallback
      }

      if (profileData?.admin_approved && profileData?.account_status === 'active') {
        navigate('dashboard');
        return;
      }
      if (profileData?.kyc_status === 'under_review') {
        navigate('kyc_pending');
        return;
      }
      const codeSuffix = profileData?.driverCode ? ` · Driver ID: ${profileData.driverCode}` : '';
      setFeedback({
        type: 'success',
        title: 'Signed In to SHINE CAPTAIN',
        message: targetPhone
          ? `Mobile ${targetPhone} linked cleanly${codeSuffix}. Complete your Captain KYC & vehicle details.`
          : `Account connected${codeSuffix}. Complete your Captain KYC & vehicle details to go online.`,
      });
      navigate('registration');
    } finally {
      setGoogleBusy(false);
      setAuthPhase('idle');
    }
  };

  const withOtpTimeout = <T,>(promise: Promise<T>, ms: number, timeoutCode: string): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        reject(Object.assign(new Error(timeoutCode), { code: timeoutCode }));
      }, ms);
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (err) => {
          window.clearTimeout(timer);
          reject(err);
        }
      );
    });

  const completeLoginNavigation = useCallback(
    async (loginData: {
      route_to: 'dashboard' | 'kyc_pending' | 'kyc_decision' | 'registration';
      driverCode?: string | null;
      short_id?: string | null;
      wallet_balance_inr: number;
    }) => {
      try {
        await refreshDriverWorkspace();
      } catch {
        // Never block navigation if background listener hasn't hydrated yet
      }
      setGeneratedBannerOtp(null);
      setBannerDismissed(true);

      const displayCode = loginData.driverCode || loginData.short_id || '';
      const shortIdLabel = displayCode ? ` (${displayCode})` : '';
      if (loginData.route_to === 'dashboard') {
        setFeedback({
          type: 'success',
          title: `Welcome Back, Captain${shortIdLabel}`,
          message: `Approved profile loaded · Wallet ₹${loginData.wallet_balance_inr.toFixed(0)} · Ready to go online.`,
        });
        navigate('dashboard');
        return;
      }
      if (loginData.route_to === 'kyc_pending') {
        setFeedback({
          type: 'info',
          title: `KYC Under Admin Review${shortIdLabel}`,
          message: 'Your documents are submitted and waiting for Super Admin verification.',
        });
        navigate('kyc_pending');
        return;
      }
      if (loginData.route_to === 'kyc_decision') {
        navigate('kyc_decision');
        return;
      }

      setFeedback({
        type: 'success',
        title: `Account Verified${shortIdLabel}`,
        message: 'Complete your Captain registration & KYC upload to start taking rides.',
      });
      navigate('registration');
    },
    [navigate, refreshDriverWorkspace, setFeedback]
  );

  const dispatchOtp = async (overrideMode?: 'invisible' | 'normal') => {
    setOtpError(null);

    if (loginMethod === 'driver_id') {
      if (!driverCodeValidation.valid) {
        setFeedback({
          type: 'info',
          title: 'Enter 10-Character Driver ID',
          message: 'Type your SHINE Captain ID in the format SHNRA4829K (10 alphanumeric characters).',
        });
        return;
      }
      setBusy(true);
      setAuthPhase('sending_otp');
      try {
        const lookupRes = await driverBackendService.auth.lookupDriverByCode(
          driverCodeValidation.normalized
        );
        const lookup = lookupRes.ok ? lookupRes.data : null;
        setDriverIdLookup(lookup ?? null);
        if (lookup?.phone) {
          updateDraft({ phone: lookup.phone.replace(/^\+91/, '') });
        }

        const freshOtp = generateSixDigitOtp();
        setGeneratedBannerOtp(freshOtp);
        setBannerDismissed(false);
        setOtpSent(true);
        setOtpDigits(['', '', '', '', '', '']);
        setResendSeconds(30);
        setOtpError(null);
        setFeedback({
          type: 'success',
          title: lookup?.found
            ? `Captain Found · ${driverCodeValidation.normalized}`
            : `OTP Ready · ${driverCodeValidation.normalized}`,
          message: lookup?.masked_phone
            ? `Verification OTP ready for registered mobile ${lookup.masked_phone}.`
            : `Enter the 6-digit OTP shown below to verify & access Captain ${driverCodeValidation.normalized}.`,
        });
        window.setTimeout(() => otpInputRefs.current[0]?.focus(), 80);
      } finally {
        setBusy(false);
        setAuthPhase('idle');
      }
      return;
    }

    if (!phoneValidation.valid) {
      setFeedback({
        type: 'info',
        title: 'Enter 10-Digit Mobile Number',
        message: 'Enter a valid 10-digit Indian mobile number starting with 6–9.',
      });
      return;
    }

    const shouldTryLiveSms = (useRealSmsMode || liveSmsConfigured) && backendConfigured;
    setBusy(true);
    setAuthPhase('sending_otp');

    try {
      clearRecaptchaWidget();
      confirmationResultRef.current = null;

      if (shouldTryLiveSms) {
        const auth = getFirebaseAuth();
        const containerEl = recaptchaContainerRef.current;
        if (auth && containerEl) {
          try {
            const modeToUse = overrideMode || recaptchaMode;
            auth.useDeviceLanguage();
            const verifier = new RecaptchaVerifier(auth, containerEl, {
              size: modeToUse,
              'expired-callback': () => {
                clearRecaptchaWidget();
              },
              'error-callback': () => {
                clearRecaptchaWidget();
              },
            });
            recaptchaVerifierRef.current = verifier;
            await withOtpTimeout(verifier.render(), 12000, 'auth/captcha-check-failed');
            const confirmationResult = await withOtpTimeout(
              signInWithPhoneNumber(auth, phoneValidation.normalized, verifier),
              modeToUse === 'normal' ? 60000 : 20000,
              'auth/captcha-check-failed'
            );
            confirmationResultRef.current = confirmationResult;
            setGeneratedBannerOtp(null);
            setBannerDismissed(true);
            setOtpSent(true);
            setOtpDigits(['', '', '', '', '', '']);
            setResendSeconds(30);
            setFeedback({
              type: 'success',
              title: 'Live Firebase SMS OTP Sent',
              message: `6-digit SMS code sent to ${phoneValidation.normalized}.`,
            });
            window.setTimeout(() => otpInputRefs.current[0]?.focus(), 80);
            return;
          } catch (smsErr) {
            clearRecaptchaWidget();
            confirmationResultRef.current = null;
            if (useRealSmsMode) {
              const parsed = mapFirebasePhoneAuthError(smsErr);
              setOtpError({ firebaseCode: parsed.firebaseCode, message: parsed.message });
              return;
            }
          }
        }
      }

      // Customer-Style Instant 6-Digit OTP Banner Flow
      const freshOtp = generateSixDigitOtp();
      setGeneratedBannerOtp(freshOtp);
      setBannerDismissed(false);
      setOtpSent(true);
      setOtpDigits(['', '', '', '', '', '']);
      setResendSeconds(30);
      setOtpError(null);
      setFeedback({
        type: 'success',
        title: 'OTP Generated',
        message: `Enter the 6-digit verification code shown below for ${phoneValidation.normalized}.`,
      });
      window.setTimeout(() => otpInputRefs.current[0]?.focus(), 80);
    } finally {
      setBusy(false);
      setAuthPhase('idle');
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await dispatchOtp();
  };

  const handleDirectDriverIdLogin = async () => {
    if (busy || !driverCodeValidation.valid) return;
    setBusy(true);
    setAuthPhase('verifying_otp');
    try {
      const loginRes = await driverBackendService.auth.signInWithDriverIdOtp(
        driverCodeValidation.normalized,
        driverIdLookup?.phone || null
      );
      if (loginRes.ok && loginRes.data) {
        await completeLoginNavigation(loginRes.data);
      }
    } finally {
      setBusy(false);
      setAuthPhase('idle');
    }
  };

  const verifyOtpCode = useCallback(
    async (cleanedOtp: string) => {
      if (busy) return;
      setOtpError(null);
      if (!/^\d{6}$/.test(cleanedOtp)) {
        setFeedback({
          type: 'info',
          title: '6-Digit OTP Required',
          message: 'Enter all 6 digits of the verification code shown above.',
        });
        return;
      }

      setBusy(true);
      setAuthPhase('verifying_otp');
      try {
        const confirmationResult = confirmationResultRef.current;
        if (confirmationResult) {
          const userCredential = await confirmationResult.confirm(cleanedOtp);
          confirmationResultRef.current = null;
          clearRecaptchaWidget();
          await ensureDriverSeedDocs(userCredential.user.uid, {
            phone: userCredential.user.phoneNumber || phoneValidation.normalized,
          }).catch(() => {});
        } else {
          if (!generatedBannerOtp || cleanedOtp !== generatedBannerOtp) {
            setFeedback({
              type: 'info',
              title: 'Check 6-Digit OTP',
              message: 'The digits entered do not match the verification notice code. Tap the OTP card to auto-fill.',
            });
            return;
          }
        }

        const loginRes =
          loginMethod === 'driver_id'
            ? await driverBackendService.auth.signInWithDriverIdOtp(
                driverCodeValidation.normalized,
                driverIdLookup?.phone || null
              )
            : await driverBackendService.auth.signInWithPhoneOtp(phoneValidation.normalized);

        if (loginRes.ok && loginRes.data) {
          await completeLoginNavigation(loginRes.data);
          return;
        }

        setFeedback({
          type: 'info',
          title: 'Continue Registration',
          message: 'OTP verified. Complete your Captain registration details below.',
        });
        navigate('registration');
      } catch (err) {
        const parsed = mapFirebasePhoneAuthError(err);
        if (parsed.isExpiredSession) {
          confirmationResultRef.current = null;
          clearRecaptchaWidget();
        }
        setFeedback({
          type: 'info',
          title: 'Verification Retry Needed',
          message: parsed.message,
        });
      } finally {
        setBusy(false);
        setAuthPhase('idle');
      }
    },
    [
      busy,
      clearRecaptchaWidget,
      completeLoginNavigation,
      driverCodeValidation.normalized,
      driverIdLookup?.phone,
      generatedBannerOtp,
      loginMethod,
      navigate,
      phoneValidation.normalized,
      setFeedback,
    ]
  );

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyOtpCode(otpCode);
  };

  const handleOtpDigitChange = (index: number, rawValue: string) => {
    setOtpError(null);
    const digitsOnly = rawValue.replace(/\D/g, '');
    if (digitsOnly.length > 1) {
      const next = [...otpDigits];
      for (let i = 0; i < 6; i += 1) {
        next[i] = digitsOnly[i] || '';
      }
      setOtpDigits(next);
      const focusIdx = Math.min(5, digitsOnly.length - 1);
      otpInputRefs.current[focusIdx]?.focus();
      const joined = next.join('');
      if (/^\d{6}$/.test(joined)) {
        void verifyOtpCode(joined);
      }
      return;
    }

    const single = digitsOnly.slice(-1);
    const next = [...otpDigits];
    next[index] = single;
    setOtpDigits(next);

    if (single && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
    const joined = next.join('');
    if (single && index === 5 && /^\d{6}$/.test(joined)) {
      void verifyOtpCode(joined);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        const next = [...otpDigits];
        next[index] = '';
        setOtpDigits(next);
      } else if (index > 0) {
        const next = [...otpDigits];
        next[index - 1] = '';
        setOtpDigits(next);
        otpInputRefs.current[index - 1]?.focus();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    setOtpError(null);
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || '');
    setOtpDigits(next);
    otpInputRefs.current[Math.min(5, pasted.length - 1)]?.focus();
    if (pasted.length === 6) {
      void verifyOtpCode(pasted);
    }
  };

  const handleAutoFillOtp = () => {
    if (!generatedBannerOtp || busy) return;
    setOtpError(null);
    const digits = generatedBannerOtp.split('').slice(0, 6);
    setOtpDigits(digits);
    otpInputRefs.current[5]?.focus();
    if (autoFillTimerRef.current) {
      window.clearTimeout(autoFillTimerRef.current);
    }
    autoFillTimerRef.current = window.setTimeout(() => {
      void verifyOtpCode(digits.join(''));
    }, 280);
  };

  const handleChangePhoneNumber = () => {
    resetOtpFlow();
    setOtpSent(false);
    setOtpDigits(['', '', '', '', '', '']);
    setGeneratedBannerOtp(null);
    setBannerDismissed(false);
    setResendSeconds(0);
    setOtpError(null);
  };

  const handleToggleRecaptchaMode = () => {
    const nextMode = recaptchaMode === 'invisible' ? 'normal' : 'invisible';
    resetOtpFlow();
    setRecaptchaMode(nextMode);
    setOtpError(null);
  };

  const isConsoleConfigError =
    otpError?.firebaseCode === 'auth/operation-not-allowed' ||
    otpError?.firebaseCode === 'auth/admin-restricted-operation' ||
    otpError?.firebaseCode === 'auth/billing-not-enabled' ||
    otpError?.firebaseCode === 'auth/unauthorized-domain';

  const isCaptchaError =
    otpError?.firebaseCode === 'auth/captcha-check-failed' ||
    otpError?.firebaseCode === 'auth/invalid-app-credential';

  return (
    <div className="space-y-4">
      {/* High-Visibility Yellow / Black Customer-Style Top OTP Notification Banner */}
      {otpSent && generatedBannerOtp && !bannerDismissed && (
        <div
          role="region"
          aria-label="SHINE CAPTAIN Verification Code Banner"
          className="sticky top-[94px] z-30 rounded-2xl border-2 border-[#FFC928] bg-[#111111] p-3.5 text-white shadow-xl"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#F5C518] px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[#111111]">
                  SHINE CAPTAIN SMS
                </span>
                <span className="font-mono-num text-[11px] font-semibold text-neutral-300">
                  {phoneValidation.normalized}
                </span>
              </div>
              <p className="text-xs leading-snug text-neutral-200">
                Your 6-digit login verification code is{' '}
                <strong className="font-mono-num ml-1 inline-block rounded-lg bg-[#F5C518] px-2 py-0.5 text-base font-extrabold tracking-[0.2em] text-[#111111]">
                  {generatedBannerOtp}
                </strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss OTP banner"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300 hover:text-white"
            >
              ×
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-neutral-800 pt-2.5">
            <span className="font-mono-num text-[11px] text-neutral-400">
              {resendSeconds > 0 ? `Resend ready in ${resendSeconds}s` : 'Ready to resend OTP'}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={handleAutoFillOtp}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#F5C518] px-3.5 text-xs font-extrabold text-[#111111] transition-transform active:scale-95 disabled:opacity-60"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Auto-fill OTP
            </button>
          </div>
        </div>
      )}

      {/* Top-Left Skip Icon & Button -> Home + Signup Cross-Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('dashboard')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-bold text-[#1E1E1E] transition-colors hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1B1E24] dark:text-white"
        >
          <SkipForward className="h-4 w-4 text-[#F5C518]" />
          <span>
            {t.skip} → {t.navHome}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('registration')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#F5C518] px-3.5 text-xs font-bold text-[#1E1E1E]"
        >
          <UserPlus className="h-4 w-4" />
          <span>{t.signupBtn}</span>
        </button>
      </div>

      <div className="rounded-2xl bg-[#111111] px-4 py-3.5 text-white shadow-xs dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <BrandLogo variant="dark" size="sm" showTagline />
      </div>

      <ScreenHeader
        title="Captain Partner Sign-In"
        subtitle="Fast 6-digit Mobile OTP verification & Firebase sync"
      />

      {!backendConfigured && (
        <StateNotice
          variant="unconfigured"
          title="Firebase Auth Configuration Missing"
          description="Verify firebase-applet-config.json so Google Sign-In and Phone OTP connect cleanly."
        />
      )}

      {/* Customer-Style Mobile Number / Driver ID + 6-Box OTP Verification Card */}
      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="mb-3 flex items-center justify-between gap-2 border-b border-neutral-100 pb-3 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#F5C518] text-[#1E1E1E]">
              <KeyRound className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-display text-sm font-bold">
                {loginMethod === 'driver_id'
                  ? 'Captain Driver ID Sign-In'
                  : 'Mobile Number Verification'}
              </h2>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                {loginMethod === 'driver_id'
                  ? 'Enter your 10-character PAN-style Driver ID (e.g. SHNRA4829K)'
                  : 'Enter your 10-digit +91 mobile number to continue'}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            SHINE Auth
          </span>
        </div>

        {/* Clean 2-Tab Toggle: Mobile Number vs Driver ID */}
        <div
          role="tablist"
          aria-label="Captain Login Method"
          className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-[#F7F8FA] p-1 dark:bg-[#1A1D23]"
        >
          <button
            type="button"
            role="tab"
            aria-selected={loginMethod === 'phone'}
            disabled={busy}
            onClick={() => handleSwitchLoginMethod('phone')}
            className={`min-h-[40px] rounded-xl px-3 text-xs font-bold transition-colors ${
              loginMethod === 'phone'
                ? 'bg-[#111111] text-[#FFC928] shadow-xs dark:bg-[#FFC928] dark:text-[#111111]'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
            }`}
          >
            Mobile Number
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={loginMethod === 'driver_id'}
            disabled={busy}
            onClick={() => handleSwitchLoginMethod('driver_id')}
            className={`min-h-[40px] rounded-xl px-3 text-xs font-bold transition-colors ${
              loginMethod === 'driver_id'
                ? 'bg-[#111111] text-[#FFC928] shadow-xs dark:bg-[#FFC928] dark:text-[#111111]'
                : 'text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
            }`}
          >
            Driver ID
          </button>
        </div>

        <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp} className="space-y-4">
          {loginMethod === 'phone' ? (
            <div className="space-y-1.5">
              <label htmlFor="driver-phone" className="block text-xs font-semibold">
                10-Digit Captain Mobile Number
              </label>
              <div className="flex items-center rounded-xl border border-neutral-300 bg-neutral-50 px-3 focus-within:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]">
                <Phone className="h-4 w-4 text-neutral-500" />
                <span className="font-mono-num px-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300">
                  +91
                </span>
                <input
                  id="driver-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  maxLength={10}
                  disabled={otpSent || busy}
                  placeholder="9876543210"
                  value={onboardingDraft.phone}
                  onChange={(e) => {
                    setOtpError(null);
                    updateDraft({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) });
                  }}
                  className="font-mono-num min-h-[48px] w-full bg-transparent text-sm outline-none disabled:opacity-60"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="driver-code-input" className="block text-xs font-semibold">
                10-Character PAN-Style Driver ID
              </label>
              <div className="flex items-center rounded-xl border border-neutral-300 bg-neutral-50 px-3 focus-within:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]">
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#F5C518]" />
                <input
                  id="driver-code-input"
                  type="text"
                  autoCapitalize="characters"
                  autoComplete="username"
                  maxLength={10}
                  disabled={otpSent || busy}
                  placeholder="SHNRA4829K"
                  value={driverIdInput}
                  onChange={(e) => {
                    setOtpError(null);
                    setDriverIdInput(
                      e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)
                    );
                  }}
                  className="font-mono-num min-h-[48px] w-full bg-transparent px-2.5 text-sm font-bold tracking-widest uppercase outline-none disabled:opacity-60"
                />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Format: SHN + 2 Letters + 4 Digits + Check Letter (case-insensitive)
              </p>
            </div>
          )}

          {!otpSent && loginMethod === 'phone' && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span>
                Mode:{' '}
                <strong className="text-neutral-800 dark:text-neutral-200">
                  {useRealSmsMode || liveSmsConfigured
                    ? `Live Firebase SMS (${recaptchaMode === 'normal' ? 'Checkbox' : 'Auto'})`
                    : 'Instant 6-Digit OTP Banner'}
                </strong>
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetOtpFlow();
                    setUseRealSmsMode((prev) => !prev);
                    setOtpError(null);
                  }}
                  className="font-semibold text-[#1E1E1E] underline dark:text-[#F5C518]"
                >
                  {useRealSmsMode ? 'Use Instant OTP' : 'Use Real SMS'}
                </button>
                {useRealSmsMode && (
                  <button
                    type="button"
                    onClick={handleToggleRecaptchaMode}
                    className="font-semibold text-neutral-700 underline dark:text-neutral-300"
                  >
                    {recaptchaMode === 'invisible' ? 'Checkbox' : 'Invisible'}
                  </button>
                )}
              </div>
            </div>
          )}

          <div
            ref={recaptchaContainerRef}
            id="shine-recaptcha-container"
            className={
              useRealSmsMode && recaptchaMode === 'normal' && loginMethod === 'phone'
                ? 'flex min-h-[78px] items-center justify-center overflow-x-auto rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-[#1A1D23]'
                : 'min-h-[1px]'
            }
          />

          {otpSent && (
            <div className="space-y-3.5">
              {/* Driver ID Account Match Summary (when logging in by Driver ID) */}
              {loginMethod === 'driver_id' && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#FFC928]/40 bg-[#141414] px-3.5 py-2.5 text-white">
                  <div className="min-w-0">
                    <p className="font-mono-num text-xs font-extrabold tracking-wider text-[#FFC928]">
                      {driverCodeValidation.normalized}
                      {driverIdLookup?.display_name ? ` · ${driverIdLookup.display_name}` : ''}
                    </p>
                    <p className="font-mono-num text-[11px] text-neutral-300">
                      {driverIdLookup?.masked_phone
                        ? `Registered mobile: ${driverIdLookup.masked_phone}`
                        : driverIdLookup?.found
                          ? `Status: ${(driverIdLookup.kyc_status || 'pending').replace('_', ' ')}`
                          : 'Enter 6-digit OTP below to verify & continue'}
                    </p>
                  </div>
                  {driverIdLookup?.verified_on_device && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleDirectDriverIdLogin()}
                      className="rounded-xl bg-[#FFC928] px-3 py-1.5 text-[11px] font-extrabold text-[#111111]"
                    >
                      Verified Device · Login
                    </button>
                  )}
                </div>
              )}

              {/* Exact Customer-App Style Dark "OTP Verification Notice" Card */}
              {generatedBannerOtp && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleAutoFillOtp}
                  className="w-full space-y-2 rounded-2xl border border-[#2A2A2A] bg-[#141414] p-4 text-left transition-transform active:scale-[0.99] disabled:opacity-60"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FFC928]">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#FFC928]" />
                      OTP Verification Notice
                    </span>
                    <span className="rounded-md bg-[#FFC928]/15 px-2 py-0.5 text-[10px] font-bold text-[#FFC928]">
                      Tap to Auto-fill
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-300">
                    Your SHINE CAPTAIN Verification OTP is{' '}
                    <strong className="font-mono-num text-white">{generatedBannerOtp}</strong>. Enter
                    it below to verify &amp; login.
                  </p>
                  <p className="font-mono text-xl font-extrabold tracking-[0.35em] text-[#FFC928]">
                    {generatedBannerOtp.split('').join(' ')}
                  </p>
                </button>
              )}

              <div className="space-y-2.5 rounded-2xl border border-neutral-200 bg-[#F7F8FA] p-3.5 dark:border-neutral-800 dark:bg-[#1A1D23]">
                <div className="flex items-center justify-between gap-2">
                  <span className="block text-xs font-bold text-[#1E1E1E] dark:text-white">
                    6-Digit OTP Code
                  </span>
                  <button
                    type="button"
                    onClick={handleChangePhoneNumber}
                    className="text-xs font-semibold text-[#1E1E1E] underline dark:text-[#F5C518]"
                  >
                    {loginMethod === 'driver_id' ? 'Change Driver ID' : 'Change Number'}
                  </button>
                </div>
                <p className="font-mono-num text-[11px] text-neutral-500 dark:text-neutral-400">
                  {loginMethod === 'driver_id'
                    ? `For Driver ID ${driverCodeValidation.normalized}${
                        driverIdLookup?.masked_phone ? ` (${driverIdLookup.masked_phone})` : ''
                      }`
                    : `Sent to ${phoneValidation.normalized}`}
                </p>

                {/* 6 Individual Auto-Advancing Numeric OTP Boxes */}
                <div className="grid grid-cols-6 gap-2">
                  {otpDigits.map((digit, index) => (
                    <input
                      key={index}
                      ref={(el) => {
                        otpInputRefs.current[index] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      maxLength={6}
                      placeholder={index === 0 ? '•' : '•'}
                      aria-label={`Enter 6-digit OTP digit ${index + 1}`}
                      value={digit}
                      disabled={busy}
                      onChange={(e) => handleOtpDigitChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      className="font-mono-num h-12 w-full rounded-xl border-2 border-neutral-300 bg-white text-center text-lg font-extrabold text-[#1E1E1E] outline-none transition-colors focus:border-[#FFC928] dark:border-neutral-700 dark:bg-[#14161A] dark:text-white dark:focus:border-[#FFC928]"
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <span className="font-medium text-neutral-500 dark:text-neutral-400">
                    Need a new code?
                  </span>
                  <div className="flex items-center gap-3">
                    {resendSeconds > 0 ? (
                      <span className="font-mono-num font-semibold text-neutral-600 dark:text-neutral-300">
                        Resend in {resendSeconds}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void dispatchOtp()}
                        className="inline-flex items-center gap-1 font-bold text-[#1E1E1E] underline disabled:opacity-40 dark:text-[#FFC928]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Resend OTP
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {otpError && (
            <div
              role="alert"
              className="space-y-3 rounded-2xl border border-[#FFC928]/45 bg-[#141414] p-4 text-xs text-white shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFC928]" />
                <div className="min-w-0 space-y-1">
                  <p className="font-bold text-[#FFC928]">
                    Verification Notice{' '}
                    {otpError.firebaseCode ? `(${otpError.firebaseCode})` : ''}
                  </p>
                  <p className="leading-relaxed text-neutral-200">{otpError.message}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {useRealSmsMode && (
                  <button
                    type="button"
                    disabled={busy || googleBusy}
                    onClick={() => {
                      resetOtpFlow();
                      setUseRealSmsMode(false);
                      setOtpError(null);
                      const freshOtp = generateSixDigitOtp();
                      setGeneratedBannerOtp(freshOtp);
                      setBannerDismissed(false);
                      setOtpSent(true);
                      setOtpDigits(['', '', '', '', '', '']);
                      setResendSeconds(30);
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#FFC928] px-3 py-1.5 text-[11px] font-extrabold text-[#111111]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Switch to Instant OTP Notice
                  </button>
                )}

                {isCaptchaError && !otpSent && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setRecaptchaMode('normal');
                      void dispatchOtp('normal');
                    }}
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-[#2A2A2A] bg-[#1F1F1F] px-3 py-1.5 text-[11px] font-bold text-[#FFC928]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Try Visible Checkbox reCAPTCHA
                  </button>
                )}

                {isConsoleConfigError && (
                  <button
                    type="button"
                    disabled={busy || googleBusy}
                    onClick={() =>
                      void handleGoogleSignIn(
                        phoneValidation.valid ? phoneValidation.normalized : undefined
                      )
                    }
                    className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl bg-[#FFC928] px-3.5 py-1.5 text-[11px] font-extrabold text-[#111111]"
                  >
                    <LogIn className="h-3.5 w-3.5" />
                    {phoneValidation.valid
                      ? `Continue with Google & Link ${phoneValidation.normalized}`
                      : 'Continue with Google'}
                  </button>
                )}
              </div>

              {isConsoleConfigError && (
                <div className="space-y-1 rounded-xl border border-[#2A2A2A] bg-[#1C1C1C] p-2.5 text-[11px] leading-relaxed text-neutral-300">
                  <p className="font-semibold text-white">
                    Firebase Project:{' '}
                    <code className="font-mono-num text-[#FFC928]">{firebaseConfig.projectId}</code>
                    {currentHost ? (
                      <>
                        {' '}
                        · Host: <code className="font-mono-num break-all">{currentHost}</code>
                      </>
                    ) : null}
                  </p>
                  <a
                    href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#FFC928] underline"
                  >
                    <span>Open Firebase Auth Sign-In Providers</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {(busy || googleBusy) && (
            <div className="rounded-xl border border-[#F5C518]/60 bg-[#F5C518]/10 p-3 dark:bg-[#F5C518]/5">
              <LoadingSpinner
                size="md"
                label={
                  authPhase === 'verifying_otp'
                    ? 'Verifying 6-Digit OTP…'
                    : authPhase === 'google_signing_in'
                      ? 'Connecting Firebase Google Sign-In…'
                      : 'Preparing Verification Code…'
                }
                sublabel={
                  authPhase === 'verifying_otp'
                    ? 'Signing in persistently & checking your SHINE CAPTAIN status in Cloud Firestore.'
                    : authPhase === 'google_signing_in'
                      ? 'Loading your Captain account & wallet from Cloud Firestore.'
                      : `Generating secure OTP for ${phoneValidation.normalized || 'your mobile'}.`
                }
              />
            </div>
          )}

          <div className="flex flex-wrap gap-3 pt-1">
            {otpSent ? (
              <button
                type="submit"
                disabled={busy || googleBusy}
                className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl bg-[#141414] px-4 py-2.5 text-sm font-bold text-[#FFC928] transition-all active:scale-[0.98] hover:bg-neutral-900 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Verifying OTP…</span>
                  </>
                ) : (
                  'Verify & Continue'
                )}
              </button>
            ) : (
              <PrimaryButton type="submit" variant="brand" className="flex-1" disabled={busy || googleBusy}>
                {busy ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>{loginMethod === 'driver_id' ? 'Finding ID…' : 'Sending OTP…'}</span>
                  </>
                ) : loginMethod === 'driver_id' ? (
                  'Find Account & Send OTP'
                ) : (
                  'Send OTP'
                )}
              </PrimaryButton>
            )}
            <PrimaryButton
              type="button"
              variant="outline"
              disabled={busy || googleBusy}
              onClick={() => navigate('registration')}
            >
              {t.signupBtn}
            </PrimaryButton>
          </div>
        </form>
      </div>

      {/* Instant Firebase Google Sign-In Card */}
      <section className="rounded-2xl bg-[#1E1E1E] p-4 text-white dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold tracking-wider text-[#F5C518]">
              1-TAP FIREBASE AUTH · WORKS INSTANTLY
            </p>
            <h2 className="font-display mt-1 text-base font-extrabold">
              Instant Captain Sign-In with Google
            </h2>
            <p className="mt-1 text-xs text-neutral-300">
              Syncs your Driver Profile, KYC Uploads, Live Rides &amp; Wallet directly to Cloud Firestore.
            </p>
          </div>
          <Sparkles className="h-5 w-5 shrink-0 text-[#F5C518]" />
        </div>
        <PrimaryButton
          type="button"
          variant="brand"
          disabled={googleBusy || busy}
          className="mt-4 w-full"
          onClick={() => void handleGoogleSignIn()}
        >
          {googleBusy ? (
            <LoadingSpinner size="sm" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          <span>{googleBusy ? 'Signing in with Google…' : 'Continue with Google'}</span>
        </PrimaryButton>
      </section>
    </div>
  );
};

export const RegistrationScreen: React.FC = () => {
  const {
    backendConfigured,
    driverProfile,
    documents,
    onboardingDraft,
    updateDraft,
    avatarPreviewUrl,
    driverAvatarUrl,
    uploadingAvatar,
    uploadOrSetProfilePhoto,
    clearProfilePhoto,
    stagedDocFiles,
    stageDocumentFile,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
    t,
  } = useDriverApp();

  const [submittingAll, setSubmittingAll] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogleQuickAuth = async () => {
    setGoogleBusy(true);
    const res = await driverBackendService.auth.signInWithGoogle();
    setGoogleBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Google Sign-In Failed',
        message: res.error?.message || 'Unable to sign in.',
      });
      return;
    }
    await refreshDriverWorkspace();
    setFeedback({
      type: 'success',
      title: 'Firebase Session Connected',
      message: 'Your camera & document uploads now sync directly to Super Admin KYC.',
    });
  };

  const attachDocument = async (docType: DocumentType, file: File) => {
    stageDocumentFile(docType, file);
    if (docType === 'driver_selfie' && file.type.startsWith('image/')) {
      await uploadOrSetProfilePhoto(file);
    }
    if (backendConfigured && driverProfile) {
      const res = await driverBackendService.kyc.uploadDocument(driverProfile.driver_id, docType, file);
      if (!res.ok) {
        setFeedback({
          type: 'error',
          title: 'Document Sync Failed',
          message: res.error?.message || 'Unable to compress & save file to Firestore.',
        });
        return;
      }
      setFeedback({
        type: 'success',
        title: 'Document Compressed & Saved',
        message: `${file.name} uploaded to Firestore for Super Admin approval.`,
      });
    }
  };

  const attachedCoreCount = CORE_KYC_DOC_TYPES.filter(
    (docType) =>
      documents.some((d) => d.document_type === docType) ||
      Boolean(stagedDocFiles[docType] || onboardingDraft.selectedFiles[docType])
  ).length;

  const attachedCount = ALL_KYC_DOCUMENTS.filter(
    (doc) =>
      documents.some((d) => d.document_type === doc.type) ||
      Boolean(stagedDocFiles[doc.type] || onboardingDraft.selectedFiles[doc.type])
  ).length;

  const handleSubmitAllRegistration = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!onboardingDraft.fullName.trim() || !onboardingDraft.city.trim()) {
      setFeedback({
        type: 'error',
        title: 'Personal Details Required',
        message: 'Enter your full legal name and operating city before creating your Driver ID.',
      });
      return;
    }

    const phoneRes = validateIndianPhone(onboardingDraft.phone);
    if (!phoneRes.valid) {
      setFeedback({
        type: 'error',
        title: 'Invalid Mobile Number',
        message: 'Enter a valid 10-digit Indian mobile number starting with 6–9.',
      });
      return;
    }

    if (onboardingDraft.email.trim() && !validateEmail(onboardingDraft.email)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Email Address',
        message: 'Enter a valid email address or leave the optional field blank.',
      });
      return;
    }

    if (onboardingDraft.dateOfBirth && !validateAdultDob(onboardingDraft.dateOfBirth)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Date of Birth',
        message: 'Driver partners must be at least 18 years old with a valid date of birth.',
      });
      return;
    }

    if (
      onboardingDraft.emergencyContactPhone.trim() &&
      !validateIndianPhone(onboardingDraft.emergencyContactPhone).valid
    ) {
      setFeedback({
        type: 'error',
        title: 'Invalid Emergency Contact Phone',
        message: 'Enter a valid 10-digit Indian mobile number for your emergency contact.',
      });
      return;
    }

    if (!validateVehicleRegNumber(onboardingDraft.registrationNumber)) {
      setFeedback({
        type: 'error',
        title: 'Valid Vehicle Plate Required',
        message: 'Enter a valid vehicle registration number (e.g. KA01AB1234).',
      });
      return;
    }

    if (!validateVehicleYear(onboardingDraft.vehicleYear)) {
      setFeedback({
        type: 'error',
        title: 'Invalid Vehicle Model Year',
        message: `Enter a valid manufacturing year between 1995 and ${new Date().getFullYear() + 1}.`,
      });
      return;
    }

    if (attachedCoreCount < CORE_KYC_DOC_TYPES.length) {
      setFeedback({
        type: 'error',
        title: 'Upload 4 Core KYC Documents',
        message: `${attachedCoreCount} of ${CORE_KYC_DOC_TYPES.length} required documents attached (Selfie, Driving Licence, Aadhaar, Vehicle RC).`,
      });
      return;
    }

    if (!backendConfigured) {
      setFeedback({
        type: 'error',
        title: 'Firebase Configuration Required',
        message: 'Verify firebase-applet-config.json before submitting KYC to Super Admin.',
      });
      return;
    }

    setSubmittingAll(true);
    try {
      if (!driverProfile) {
        const authRes = await driverBackendService.auth.signInWithPhoneOtp(phoneRes.normalized);
        if (!authRes.ok) {
          setFeedback({
            type: 'error',
            title: 'Session Init Failed',
            message: authRes.error?.message || 'Unable to establish Captain session in Firebase.',
          });
          return;
        }
      }

      const profileRes = await driverBackendService.driver.upsertProfile({
        full_name: onboardingDraft.fullName.trim(),
        phone: phoneRes.normalized,
        email: onboardingDraft.email.trim() || undefined,
        city: onboardingDraft.city.trim(),
        date_of_birth: onboardingDraft.dateOfBirth,
        emergency_contact_name: onboardingDraft.emergencyContactName.trim(),
        emergency_contact_phone: onboardingDraft.emergencyContactPhone.trim(),
      });

      if (!profileRes.ok || !profileRes.data) {
        setFeedback({
          type: 'error',
          title: 'Profile Save Failed',
          message: profileRes.error?.message || 'Unable to save Captain profile.',
        });
        return;
      }

      const createdDriverId = profileRes.data.driver_id;

      const vehRes = await driverBackendService.vehicle.upsertVehicle(createdDriverId, {
        category: onboardingDraft.vehicleCategory,
        make: onboardingDraft.vehicleMake.trim() || 'Partner Vehicle',
        model: onboardingDraft.vehicleModel.trim() || 'Standard',
        year: Number(onboardingDraft.vehicleYear) || new Date().getFullYear(),
        color: onboardingDraft.vehicleColor.trim() || 'White',
        registration_number: onboardingDraft.registrationNumber.trim().toUpperCase(),
        permit_number: onboardingDraft.permitNumber.trim() || undefined,
        insurance_expiry: onboardingDraft.insuranceExpiry,
        rc_expiry: onboardingDraft.rcExpiry,
      });

      if (!vehRes.ok) {
        setFeedback({
          type: 'error',
          title: 'Vehicle Registration Failed',
          message: vehRes.error?.message || 'Unable to save vehicle record.',
        });
        return;
      }

      for (const doc of ALL_KYC_DOCUMENTS) {
        const file = stagedDocFiles[doc.type];
        if (file) {
          const uploadRes = await driverBackendService.kyc.uploadDocument(
            createdDriverId,
            doc.type,
            file
          );
          if (!uploadRes.ok) {
            setFeedback({
              type: 'error',
              title: `Failed Uploading ${doc.title}`,
              message: uploadRes.error?.message || 'Document upload error.',
            });
            return;
          }
          if (doc.type === 'driver_selfie' && file.type.startsWith('image/')) {
            await driverBackendService.driver.uploadAvatar(createdDriverId, file);
          }
        }
      }

      const submitRes = await driverBackendService.kyc.submitForApproval(createdDriverId);
      if (!submitRes.ok) {
        setFeedback({
          type: 'error',
          title: 'Admin Submission Failed',
          message: submitRes.error?.message || 'Could not submit application.',
        });
        return;
      }

      await refreshDriverWorkspace();
      setFeedback({
        type: 'success',
        title: 'Submitted for Super Admin Review',
        message:
          'All compressed KYC photos & vehicle details synced to Cloud Firestore. Your Partner Rider ID unlocks automatically once Admin approves.',
      });
      navigate('kyc_pending');
    } finally {
      setSubmittingAll(false);
    }
  };

  const driverDocs = ALL_KYC_DOCUMENTS.filter((d) => d.group === 'driver');
  const vehicleDocs = ALL_KYC_DOCUMENTS.filter((d) => d.group === 'vehicle');

  return (
    <div className="space-y-5">
      {/* Top-Left Skip Icon & Button -> Home + Login Cross-Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => navigate('dashboard')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-bold text-[#1E1E1E] transition-colors hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1B1E24] dark:text-white"
        >
          <SkipForward className="h-4 w-4 text-[#F5C518]" />
          <span>
            {t.skip} → {t.navHome}
          </span>
        </button>

        <button
          type="button"
          onClick={() => navigate('login_otp')}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 bg-white px-3.5 text-xs font-bold text-[#1E1E1E] transition-colors hover:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1B1E24] dark:text-white"
        >
          <LogIn className="h-4 w-4 text-[#F5C518]" />
          <span>{t.loginBtn}</span>
        </button>
      </div>

      {/* SHINE CAPTAIN ID Creation Hero */}
      <section className="rounded-3xl bg-[#111111] p-4 text-white shadow-sm dark:border dark:border-neutral-800 dark:bg-[#14161A]">
        <div className="flex flex-col gap-3">
          <BrandLogo variant="dark" size="sm" showTagline />
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#FFC928]">
              UNIFIED DRIVER ID &amp; VEHICLE KYC APPLICATION
            </p>
            <h1 className="font-display mt-1 text-xl font-extrabold text-white">
              Create Driver ID &amp; Upload All Docs
            </h1>
            <p className="mt-1 text-xs text-neutral-300">
              Photos auto-compress on device &amp; sync directly to Firestore so Super Admin sees them immediately.
            </p>
          </div>

          {!driverProfile && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <PrimaryButton
                type="button"
                variant="brand"
                disabled={googleBusy}
                className="w-full"
                onClick={() => void handleGoogleQuickAuth()}
              >
                <Sparkles className="h-4 w-4" />
                {googleBusy ? 'Connecting Google…' : 'Sign In with Google'}
              </PrimaryButton>
              <PrimaryButton
                type="button"
                variant="outline"
                className="w-full border-neutral-600 bg-[#262626] text-white hover:border-[#F5C518] hover:text-[#F5C518]"
                onClick={() => navigate('login_otp')}
              >
                <Phone className="h-4 w-4 text-[#F5C518]" />
                Verify via Mobile OTP
              </PrimaryButton>
            </div>
          )}

          <div className="rounded-2xl border border-neutral-800 bg-[#262626] px-3.5 py-2.5 text-left">
            <p className="text-[11px] text-neutral-400">Captain Driver ID</p>
            <p className="font-mono-num mt-0.5 flex items-center gap-1.5 text-sm font-bold text-[#F5C518]">
              {driverProfile?.driverCode || driverProfile?.short_id ? (
                <>
                  <BadgeCheck className="h-4 w-4" />
                  {driverProfile.driverCode || driverProfile.short_id}
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5" />
                  Generated On Sign-In
                </>
              )}
            </p>
          </div>
        </div>
      </section>

      <form onSubmit={handleSubmitAllRegistration} className="space-y-4">
        {/* 1. Driver Profile Photo (Syncs to Header Avatar & Super Admin) */}
        <section className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3.5">
              {driverAvatarUrl ? (
                <img
                  src={driverAvatarUrl}
                  alt="Driver Portrait"
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover ring-2 ring-[#F5C518]"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#1E1E1E] text-[#F5C518]">
                  <User className="h-6 w-6" />
                </span>
              )}
              <div>
                <h2 className="font-display text-sm font-bold">1. Real Driver Profile Photo</h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Capture via camera or upload from gallery — auto-syncs to Super Admin &amp; Header Avatar
                </p>
              </div>
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
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-neutral-300 px-3 text-xs font-semibold text-neutral-600 hover:border-red-400 hover:text-red-600 dark:border-neutral-700 dark:text-neutral-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear Local Photo Preview
                </button>
              )}
            </div>
          </div>
        </section>

        {/* 2. Personal & Emergency Details */}
        <section className="space-y-3.5 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
          <h2 className="font-display border-b border-neutral-200 pb-2.5 text-sm font-bold dark:border-neutral-800">
            2. Personal &amp; Emergency Details
          </h2>
          <div className="grid grid-cols-1 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Full Legal Name</label>
              <input
                type="text"
                placeholder="As printed on Driving License"
                value={onboardingDraft.fullName}
                onChange={(e) => updateDraft({ fullName: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Mobile Number</label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={onboardingDraft.phone}
                onChange={(e) =>
                  updateDraft({ phone: e.target.value.replace(/\D/g, '').slice(0, 10) })
                }
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Operating City</label>
              <input
                type="text"
                placeholder="e.g. Bengaluru, Delhi, Mumbai"
                value={onboardingDraft.city}
                onChange={(e) => updateDraft({ city: e.target.value })}
                className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Date of Birth</label>
              <input
                type="date"
                value={onboardingDraft.dateOfBirth}
                onChange={(e) => updateDraft({ dateOfBirth: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Emergency Contact Name &amp; Phone</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Contact name"
                  value={onboardingDraft.emergencyContactName}
                  onChange={(e) => updateDraft({ emergencyContactName: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="Emergency phone"
                  value={onboardingDraft.emergencyContactPhone}
                  onChange={(e) =>
                    updateDraft({
                      emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 10),
                    })
                  }
                  className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3. Vehicle Category & Registration */}
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <h2 className="font-display text-base font-bold">3. Vehicle Details &amp; Permit</h2>
            <div className="flex items-center gap-1 rounded-xl bg-[#F7F8FA] p-1 dark:bg-[#1A1D23]">
              {(['bike', 'auto', 'cab'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => updateDraft({ vehicleCategory: cat })}
                  className={`min-h-[34px] rounded-lg px-3 text-xs font-semibold uppercase ${
                    onboardingDraft.vehicleCategory === cat
                      ? 'bg-[#1E1E1E] text-white dark:bg-[#F5C518] dark:text-[#1E1E1E]'
                      : 'text-neutral-600 dark:text-neutral-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Registration Number</label>
              <input
                type="text"
                placeholder="KA01AB1234"
                value={onboardingDraft.registrationNumber}
                onChange={(e) => updateDraft({ registrationNumber: e.target.value.toUpperCase() })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm uppercase outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Make &amp; Model</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Make"
                  value={onboardingDraft.vehicleMake}
                  onChange={(e) => updateDraft({ vehicleMake: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
                <input
                  type="text"
                  placeholder="Model"
                  value={onboardingDraft.vehicleModel}
                  onChange={(e) => updateDraft({ vehicleModel: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Permit Number (Commercial)</label>
              <input
                type="text"
                placeholder="State permit / badge no."
                value={onboardingDraft.permitNumber}
                onChange={(e) => updateDraft({ permitNumber: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Insurance Expiry</label>
              <input
                type="date"
                value={onboardingDraft.insuranceExpiry}
                onChange={(e) => updateDraft({ insuranceExpiry: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">RC Validity Expiry</label>
              <input
                type="date"
                value={onboardingDraft.rcExpiry}
                onChange={(e) => updateDraft({ rcExpiry: e.target.value })}
                className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3.5 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Year &amp; Color</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="2024"
                  value={onboardingDraft.vehicleYear}
                  onChange={(e) => updateDraft({ vehicleYear: e.target.value })}
                  className="font-mono-num min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
                <input
                  type="text"
                  placeholder="White"
                  value={onboardingDraft.vehicleColor}
                  onChange={(e) => updateDraft({ vehicleColor: e.target.value })}
                  className="min-h-[44px] w-full rounded-xl border border-neutral-300 bg-[#F7F8FA] px-3 text-sm outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4. All Driver & Vehicle Documents Together */}
        <section className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-3 dark:border-neutral-800">
            <div>
              <h2 className="font-display text-base font-bold">
                4. All Driver &amp; Vehicle Authentication Documents
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Click camera photos or upload files — compressed &amp; synced straight to Super Admin
              </p>
            </div>
            <span className="font-mono-num text-xs font-bold text-[#1E1E1E] dark:text-[#F5C518]">
              {attachedCoreCount} / {CORE_KYC_DOC_TYPES.length} Core · {attachedCount} / {ALL_KYC_DOCUMENTS.length} Total
            </span>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
              Driver Identity &amp; License Documents
            </p>
            <div className="grid grid-cols-1 gap-3">
              {driverDocs.map((doc) => {
                const remote = documents.find((d) => d.document_type === doc.type);
                const localName = onboardingDraft.selectedFiles[doc.type];
                const isCore = CORE_KYC_DOC_TYPES.includes(doc.type);
                const previewSrc =
                  remote?.file_url && remote.file_url.startsWith('data:image/')
                    ? remote.file_url
                    : null;
                return (
                  <div
                    key={doc.type}
                    className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-[#F7F8FA] p-3.5 dark:border-neutral-800 dark:bg-[#1A1D23]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold">{doc.title}</p>
                        <span className="text-[11px] font-semibold text-neutral-500">
                          {remote ? remote.status : localName ? 'Attached' : isCore ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{doc.hint}</p>
                      {(remote?.file_name || localName) && (
                        <p className="font-mono-num mt-1.5 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {remote?.file_name || localName}
                        </p>
                      )}
                      {previewSrc && (
                        <img
                          src={previewSrc}
                          alt={doc.title}
                          className="mt-2 h-24 w-36 rounded-lg border border-neutral-300 object-cover dark:border-neutral-700"
                        />
                      )}
                    </div>
                    <div className="mt-3">
                      <PhotoActionButtons
                        onSelectFile={(file) => void attachDocument(doc.type, file)}
                        facingMode={doc.type === 'driver_selfie' ? 'user' : 'environment'}
                        cameraTitle={`Capture ${doc.title}`}
                        cameraLabel="Click Photo"
                        uploadLabel="Upload"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-bold tracking-wide text-neutral-500 uppercase">
              Vehicle Authentication Documents
            </p>
            <div className="grid grid-cols-1 gap-3">
              {vehicleDocs.map((doc) => {
                const remote = documents.find((d) => d.document_type === doc.type);
                const localName = onboardingDraft.selectedFiles[doc.type];
                const isCore = CORE_KYC_DOC_TYPES.includes(doc.type);
                const previewSrc =
                  remote?.file_url && remote.file_url.startsWith('data:image/')
                    ? remote.file_url
                    : null;
                return (
                  <div
                    key={doc.type}
                    className="flex flex-col justify-between rounded-xl border border-neutral-200 bg-[#F7F8FA] p-3.5 dark:border-neutral-800 dark:bg-[#1A1D23]"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-bold">{doc.title}</p>
                        <span className="text-[11px] font-semibold text-neutral-500">
                          {remote ? remote.status : localName ? 'Attached' : isCore ? 'Required' : 'Optional'}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{doc.hint}</p>
                      {(remote?.file_name || localName) && (
                        <p className="font-mono-num mt-1.5 truncate text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {remote?.file_name || localName}
                        </p>
                      )}
                      {previewSrc && (
                        <img
                          src={previewSrc}
                          alt={doc.title}
                          className="mt-2 h-24 w-36 rounded-lg border border-neutral-300 object-cover dark:border-neutral-700"
                        />
                      )}
                    </div>
                    <div className="mt-3">
                      <PhotoActionButtons
                        onSelectFile={(file) => void attachDocument(doc.type, file)}
                        facingMode="environment"
                        cameraTitle={`Capture ${doc.title}`}
                        cameraLabel="Click Photo"
                        uploadLabel="Upload"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 5. Submit Complete Application -> Admin Review -> Partner Rider ID */}
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton type="submit" variant="brand" disabled={submittingAll}>
            <FileUp className="h-4 w-4" />
            {submittingAll
              ? 'Syncing ID & Documents…'
              : 'Create Driver ID & Submit All Docs to Admin'}
          </PrimaryButton>
          <PrimaryButton type="button" variant="outline" onClick={() => navigate('kyc_pending')}>
            Check Admin Approval &amp; Rider ID
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
};
