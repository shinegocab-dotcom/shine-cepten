import type { IntegrationStatus } from '../contracts/integrations';
import type { ServiceResult } from '../contracts/types';
import { firebaseConfig, isFirebaseReady } from './firebaseClient';

export const ENV_CONFIG = {
  firebaseApiKey: firebaseConfig.apiKey,
  firebaseProjectId: firebaseConfig.projectId,
  firebaseDatabaseId: firebaseConfig.firestoreDatabaseId,
  firebaseAppId: firebaseConfig.appId,
};

export function isFirebaseConfigured(): boolean {
  return isFirebaseReady();
}

export function isSupabaseConfigured(): boolean {
  return isFirebaseConfigured();
}

export function getMissingFirebaseVars(): string[] {
  const missing: string[] = [];
  if (!firebaseConfig?.apiKey) missing.push('firebase-applet-config.json (apiKey)');
  if (!firebaseConfig?.projectId) missing.push('firebase-applet-config.json (projectId)');
  if (!firebaseConfig?.firestoreDatabaseId) {
    missing.push('firebase-applet-config.json (firestoreDatabaseId)');
  }
  return missing;
}

export function getAllIntegrationStatuses(): IntegrationStatus[] {
  const fbReady = isFirebaseConfigured();
  const fbMissing = getMissingFirebaseVars();
  const hasGeoApi = typeof navigator !== 'undefined' && 'geolocation' in navigator;

  return [
    {
      id: 'supabase',
      label: 'Firebase Auth & Cloud Firestore',
      configured: fbReady,
      mode: fbReady ? 'live' : 'unconfigured',
      missingEnvVars: fbMissing,
      notes: fbReady
        ? `Connected live to Firestore (${firebaseConfig.firestoreDatabaseId}) for Auth, KYC, Ride Dispatch, Chat, Wallet & SOS.`
        : 'Firebase project config missing in firebase-applet-config.json.',
    },
    {
      id: 'google_maps',
      label: 'OpenStreetMap (Leaflet) & OSRM Routing',
      configured: true,
      mode: 'live',
      missingEnvVars: [],
      notes: '100% free interactive Leaflet map tiles and OSRM turn-by-turn route polylines (zero billing required).',
    },
    {
      id: 'live_gps',
      label: 'Device GPS Telemetry & Speedometer',
      configured: hasGeoApi,
      mode: hasGeoApi ? 'browser_native' : 'unconfigured',
      missingEnvVars: [],
      notes: hasGeoApi
        ? 'Real-time watchPosition with live km/h speedometer and Firestore driver_locations streaming.'
        : 'Geolocation API is unavailable in this environment.',
    },
    {
      id: 'sms_otp',
      label: 'Firebase Authentication (Google & Phone OTP)',
      configured: fbReady,
      mode: fbReady ? 'live' : 'unconfigured',
      missingEnvVars: fbMissing,
      notes: 'Supports instant Firebase Google Sign-In and Firebase Phone Auth OTP.',
    },
    {
      id: 'firebase_fcm',
      label: 'Firestore Real-Time Dispatch Listeners',
      configured: fbReady,
      mode: fbReady ? 'live' : 'unconfigured',
      missingEnvVars: fbMissing,
      notes: 'Real-time onSnapshot listeners stream rides, chat messages, ratings, and alerts immediately.',
    },
    {
      id: 'razorpay',
      label: 'In-App Cash / UPI Dues Ledger',
      configured: fbReady,
      mode: fbReady ? 'live' : 'unconfigured',
      missingEnvVars: fbMissing,
      notes: 'Direct Firestore transaction settlement for cash commission dues and UPI receipts.',
    },
    {
      id: 'payouts',
      label: 'Partner Wallet & Bank/UPI Withdrawals',
      configured: fbReady,
      mode: fbReady ? 'live' : 'unconfigured',
      missingEnvVars: fbMissing,
      notes: 'Atomic Firestore wallet ledger transfers to registered Bank Account or UPI ID.',
    },
  ];
}

export function backendNotConfigured<T>(actionDescription: string): ServiceResult<T> {
  return {
    ok: false,
    configured: false,
    error: {
      code: 'BACKEND_NOT_CONFIGURED',
      message: `${actionDescription} requires a valid Firebase configuration in firebase-applet-config.json.`,
      missingEnvVars: getMissingFirebaseVars(),
    },
  };
}
