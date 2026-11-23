export type VehicleCategory = 'bike' | 'auto' | 'cab';

export type KycStatus =
  | 'not_submitted'
  | 'pending'
  | 'under_review'
  | 'approved'
  | 'rejected';

export type DriverAccountStatus =
  | 'pending_setup'
  | 'pending_approval'
  | 'active'
  | 'suspended'
  | 'rejected';

export type RideStatus =
  | 'searching'
  | 'requested'
  | 'offered'
  | 'accepted'
  | 'arriving'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type DocumentType =
  | 'driving_license'
  | 'vehicle_rc'
  | 'vehicle_insurance'
  | 'vehicle_permit'
  | 'vehicle_puc'
  | 'vehicle_photo'
  | 'aadhaar_or_national_id'
  | 'pan_card'
  | 'driver_selfie';

export type PaymentMode = 'cash' | 'online_upi' | 'card' | 'wallet';

export type ScreenId =
  | 'splash'
  | 'onboarding'
  | 'login_otp'
  | 'registration'
  | 'personal_details'
  | 'vehicle_selection'
  | 'vehicle_details'
  | 'document_upload'
  | 'kyc_pending'
  | 'kyc_decision'
  | 'dashboard'
  | 'online_mode'
  | 'incoming_ride'
  | 'ride_accept_decision'
  | 'pickup_navigation'
  | 'customer_details'
  | 'pickup_otp'
  | 'active_ride'
  | 'ride_completion'
  | 'earnings'
  | 'wallet'
  | 'payout_history'
  | 'ride_history'
  | 'ratings'
  | 'top_captains'
  | 'notifications'
  | 'profile'
  | 'support'
  | 'emergency_sos'
  | 'ai_copilot';

export interface EcosystemActorIds {
  user_id: string;
  driver_id: string;
  vehicle_id?: string | null;
}

export interface DriverProfile {
  driver_id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  city: string;
  date_of_birth?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  avatar_url?: string | null;
  profile_completed: boolean;
  documents_uploaded: boolean;
  vehicle_verified: boolean;
  kyc_status: KycStatus;
  kyc_rejection_reason?: string | null;
  admin_approved: boolean;
  account_status: DriverAccountStatus;
  partner_rider_id?: string | null;
  short_id?: string | null;
  driverCode?: string | null;
  is_online: boolean;
  active_vehicle_id?: string | null;
  rating_average: number | null;
  total_rides: number;
  weekly_goal_inr?: number | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleRecord {
  vehicle_id: string;
  driver_id: string;
  category: VehicleCategory;
  make: string;
  model: string;
  year: number;
  color: string;
  registration_number: string;
  permit_number?: string | null;
  insurance_expiry?: string | null;
  rc_expiry?: string | null;
  verification_status: 'pending' | 'verified' | 'rejected';
  is_active: boolean;
}

export interface DriverDocumentRecord {
  document_id: string;
  driver_id: string;
  document_type: DocumentType;
  storage_path: string;
  file_url?: string | null;
  file_name: string;
  status: 'not_uploaded' | 'pending_review' | 'verified' | 'rejected';
  rejection_reason?: string | null;
  uploaded_at?: string | null;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  heading?: number | null;
  speed_kmh?: number | null;
  accuracy_m?: number | null;
  recorded_at: string;
}

export interface CustomerSummary {
  customer_id: string;
  display_name: string;
  masked_phone?: string | null;
  rating?: number | null;
  pickup_note?: string | null;
}

export interface RideRecord {
  ride_id: string;
  customer_id: string;
  driver_id: string | null;
  vehicle_id: string | null;
  vehicle_category: VehicleCategory;
  status: RideStatus;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_address: string;
  dropoff_lat: number;
  dropoff_lng: number;
  estimated_distance_km: number;
  estimated_duration_min: number;
  estimated_fare_inr: number;
  final_fare_inr?: number | null;
  commission_inr?: number | null;
  driver_net_inr?: number | null;
  payment_mode: PaymentMode;
  payment_status: 'pending' | 'paid' | 'failed';
  pickup_otp?: string | null;
  pickup_otp_verified: boolean;
  driver_lat?: number | null;
  driver_lng?: number | null;
  driver_heading?: number | null;
  driver_speed_kmh?: number | null;
  offer_expires_at?: string | null;
  customer?: CustomerSummary;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface RideMessageRecord {
  message_id: string;
  ride_id: string;
  driver_id?: string | null;
  customer_id?: string | null;
  sender_id: string;
  sender_role: 'driver' | 'customer' | 'admin';
  sender_name: string;
  text: string;
  created_at: string;
}

export interface EarningsSummary {
  period: 'daily' | 'weekly' | 'monthly';
  gross_fare_inr: number;
  platform_commission_inr: number;
  net_earnings_inr: number;
  cash_collected_inr: number;
  online_payments_inr: number;
  completed_rides: number;
  online_hours: number;
  currency: 'INR';
}

export interface WalletAccount {
  wallet_id: string;
  driver_id: string;
  available_balance_inr: number;
  pending_settlement_inr: number;
  cash_commission_due_inr: number;
  bank_account_verified: boolean;
  bank_account_masked?: string | null;
  account_holder_name?: string | null;
  upi_id?: string | null;
  updated_at: string;
}

export interface PayoutRecord {
  payout_id: string;
  driver_id: string;
  amount_inr: number;
  status: 'initiated' | 'processing' | 'settled' | 'failed';
  provider_reference?: string | null;
  destination_label: string;
  requested_at: string;
  settled_at?: string | null;
}

export interface WalletTransactionRecord {
  tx_id: string;
  wallet_id: string;
  driver_id: string;
  ride_id?: string | null;
  payout_id?: string | null;
  tx_type: 'ride_credit' | 'commission_debit' | 'payout_debit' | 'dues_settlement';
  amount_inr: number;
  description: string;
  created_at: string;
}

export interface DriverRatingRecord {
  rating_id: string;
  ride_id: string;
  customer_id: string;
  driver_id: string;
  stars: number;
  comment?: string | null;
  feedback_tags?: string[] | null;
  customer_name?: string | null;
  pickup_address?: string | null;
  dropoff_address?: string | null;
  created_at: string;
}

export interface DriverNotification {
  notification_id: string;
  driver_id: string;
  category: 'kyc' | 'ride' | 'payout' | 'system' | 'safety';
  title: string;
  body: string;
  read: boolean;
  created_at: string;
}

export interface SupportTicket {
  ticket_id: string;
  driver_id: string;
  ride_id?: string | null;
  subject: string;
  description: string;
  status: 'open' | 'in_review' | 'resolved';
  created_at: string;
}

export interface SosAlertRecord {
  alert_id: string;
  driver_id: string;
  ride_id?: string | null;
  lat?: number | null;
  lng?: number | null;
  status: 'triggered' | 'acknowledged' | 'resolved';
  created_at: string;
}

export interface FareConfigRecord {
  config_id: string;
  vehicle_category: VehicleCategory;
  base_fare_inr: number;
  per_km_inr: number;
  per_min_inr: number;
  min_fare_inr: number;
  commission_pct: number;
  surge_multiplier?: number | null;
  currency?: string;
  updated_at?: string;
}

export interface SystemIntegrationLiveKeys {
  firebase_phone_otp_enabled?: boolean;
  demo_otp_banner_enabled?: boolean;
  sms_provider?: string | null;
  updated_at?: string;
}

export interface CaptainLeaderboardEntry {
  driver_id: string;
  display_name: string;
  city: string;
  vehicle_category: VehicleCategory;
  partner_rider_id?: string | null;
  short_id?: string | null;
  driverCode?: string | null;
  weekly_earnings_inr: number;
  weekly_rides: number;
  rating_average: number | null;
  total_rides: number;
  avatar_url?: string | null;
  updated_at: string;
}

export interface DriverIdLookupResult {
  found: boolean;
  driver_code: string;
  driver_id?: string;
  display_name?: string;
  phone?: string | null;
  masked_phone?: string | null;
  city?: string | null;
  vehicle_category?: VehicleCategory | null;
  kyc_status?: KycStatus;
  admin_approved?: boolean;
  account_status?: DriverAccountStatus;
  wallet_balance_inr?: number;
  verified_on_device?: boolean;
}

export interface PhoneOtpLoginResult {
  user_id: string;
  driver_id: string;
  is_new_driver: boolean;
  status: 'approved' | 'pending_review' | 'rejected' | 'not_submitted';
  kyc_status: KycStatus;
  vehicle_category?: VehicleCategory | null;
  wallet_balance_inr: number;
  short_id?: string | null;
  driverCode?: string | null;
  route_to: 'dashboard' | 'kyc_pending' | 'kyc_decision' | 'registration';
}

export type AssistantRoleId =
  | 'maps_navigator'
  | 'dispatch_strategist'
  | 'earnings_analyst'
  | 'quick_helper';

export interface MapsGroundedPlace {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

export interface CaptainAiChatMessage {
  message_id: string;
  role_id: AssistantRoleId;
  sender: 'user' | 'model';
  model_used?: string | null;
  text: string;
  maps_sources?: MapsGroundedPlace[];
  created_at: string;
}

export interface ServiceResult<T> {
  ok: boolean;
  configured: boolean;
  data?: T;
  error?: {
    code:
      | 'BACKEND_NOT_CONFIGURED'
      | 'INTEGRATION_NOT_CONFIGURED'
      | 'UNAUTHENTICATED'
      | 'NOT_APPROVED'
      | 'RIDE_ALREADY_TAKEN'
      | 'INVALID_OTP'
      | 'INVALID_STATE_TRANSITION'
      | 'VALIDATION_ERROR'
      | 'NETWORK_ERROR'
      | 'UNKNOWN_ERROR';
    message: string;
    firebaseCode?: string;
    missingEnvVars?: string[];
  };
}
