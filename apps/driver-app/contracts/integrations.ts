import type { GeoPoint, ServiceResult } from './types';

export interface IntegrationStatus {
  id: 'supabase' | 'google_maps' | 'firebase_fcm' | 'razorpay' | 'sms_otp' | 'live_gps' | 'payouts';
  label: string;
  configured: boolean;
  mode: 'live' | 'browser_native' | 'unconfigured';
  missingEnvVars: string[];
  notes: string;
}

export interface RoutePreview {
  distanceMeters: number;
  durationSeconds: number;
  polyline?: string;
  origin: GeoPoint;
  destination: GeoPoint;
}

export interface MapsProviderAdapter {
  isConfigured(): boolean;
  getStatus(): IntegrationStatus;
  calculateRoute(origin: GeoPoint, destination: GeoPoint): Promise<ServiceResult<RoutePreview>>;
  openExternalTurnByTurn(destinationLat: number, destinationLng: number, label?: string): string;
}

export interface PushNotificationAdapter {
  isConfigured(): boolean;
  getStatus(): IntegrationStatus;
  requestDeviceToken(): Promise<ServiceResult<{ token: string }>>;
}

export interface PaymentGatewayAdapter {
  isConfigured(): boolean;
  getStatus(): IntegrationStatus;
  createDuesSettlementOrder(amountInr: number, driverId: string): Promise<ServiceResult<{ orderId: string }>>;
}

export interface SmsOtpAdapter {
  isConfigured(): boolean;
  getStatus(): IntegrationStatus;
  sendLoginOtp(phone: string): Promise<ServiceResult<{ requestId: string }>>;
}

export interface LiveLocationAdapter {
  getStatus(): IntegrationStatus;
  getCurrentPosition(highAccuracy?: boolean): Promise<ServiceResult<GeoPoint>>;
  watchPosition(
    onPoint: (point: GeoPoint) => void,
    onError: (message: string) => void,
    highAccuracy?: boolean
  ): () => void;
}

export interface PayoutProviderAdapter {
  isConfigured(): boolean;
  getStatus(): IntegrationStatus;
  initiateBankPayout(
    driverId: string,
    amountInr: number,
    channel?: 'bank' | 'upi'
  ): Promise<ServiceResult<{ payoutReference: string }>>;
}
