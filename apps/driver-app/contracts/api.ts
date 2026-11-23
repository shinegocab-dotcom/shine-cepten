import type {
  DriverDocumentRecord,
  DriverIdLookupResult,
  DriverNotification,
  DriverProfile,
  DriverRatingRecord,
  EarningsSummary,
  GeoPoint,
  PayoutRecord,
  PhoneOtpLoginResult,
  RideMessageRecord,
  RideRecord,
  ServiceResult,
  SosAlertRecord,
  SupportTicket,
  VehicleCategory,
  VehicleRecord,
  WalletAccount,
  WalletTransactionRecord,
} from './types';

export interface DriverRegistrationPayload {
  full_name: string;
  phone: string;
  email?: string;
  city: string;
  date_of_birth: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export interface VehicleUpsertPayload {
  category: VehicleCategory;
  make: string;
  model: string;
  year: number;
  color: string;
  registration_number: string;
  permit_number?: string;
  insurance_expiry: string;
  rc_expiry: string;
}

export interface AcceptRideResponse {
  ride: RideRecord;
  accepted_atomically: boolean;
  assigned_driver_id: string;
}

export interface VerifyPickupOtpPayload {
  ride_id: string;
  driver_id: string;
  otp_code: string;
}

export interface CompleteRidePayload {
  ride_id: string;
  driver_id: string;
  actual_distance_km: number;
  actual_duration_min: number;
  cash_collected_inr?: number;
}

export interface PayoutMethodPayload {
  upi_id?: string;
  account_holder_name?: string;
  bank_account_number?: string;
  ifsc_code?: string;
}

export interface SendRideMessagePayload {
  ride_id: string;
  driver_id: string;
  customer_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
}

export interface DriverBackendContract {
  auth: {
    signInWithGoogle(
      linkedPhone?: string
    ): Promise<ServiceResult<{ user_id: string; driver_id: string; email?: string | null; displayName?: string | null }>>;
    signInWithPhoneOtp(phone: string): Promise<ServiceResult<PhoneOtpLoginResult>>;
    lookupDriverByCode(driverCode: string): Promise<ServiceResult<DriverIdLookupResult>>;
    signInWithDriverIdOtp(
      driverCode: string,
      phoneHint?: string | null
    ): Promise<ServiceResult<PhoneOtpLoginResult>>;
    sendOtp(
      phone: string,
      options?: { recaptchaMode?: 'invisible' | 'normal'; containerId?: string }
    ): Promise<ServiceResult<{ expiresInSeconds: number }>>;
    verifyOtp(phone: string, token: string): Promise<ServiceResult<{ user_id: string; driver_id: string }>>;
    resetOtpSession?(): void;
    signOut(): Promise<ServiceResult<void>>;
  };
  driver: {
    getProfile(): Promise<ServiceResult<DriverProfile | null>>;
    upsertProfile(payload: DriverRegistrationPayload): Promise<ServiceResult<DriverProfile>>;
    uploadAvatar(driverId: string, file: File): Promise<ServiceResult<DriverProfile>>;
    updateWeeklyGoal(driverId: string, goalInr: number): Promise<ServiceResult<DriverProfile>>;
    setOnlineStatus(
      driverId: string,
      online: boolean,
      location?: GeoPoint,
      vehicleCategory?: VehicleCategory
    ): Promise<ServiceResult<DriverProfile>>;
    updateLocation(
      driverId: string,
      location: GeoPoint,
      isOnline?: boolean,
      vehicleCategory?: VehicleCategory,
      activeRideId?: string | null
    ): Promise<ServiceResult<void>>;
  };
  vehicle: {
    getActiveVehicle(driverId: string): Promise<ServiceResult<VehicleRecord | null>>;
    upsertVehicle(driverId: string, payload: VehicleUpsertPayload): Promise<ServiceResult<VehicleRecord>>;
  };
  kyc: {
    listDocuments(driverId: string): Promise<ServiceResult<DriverDocumentRecord[]>>;
    uploadDocument(
      driverId: string,
      docType: DriverDocumentRecord['document_type'],
      file: File
    ): Promise<ServiceResult<DriverDocumentRecord>>;
    submitForApproval(driverId: string): Promise<ServiceResult<DriverProfile>>;
  };
  rides: {
    subscribeOffers(
      driverId: string,
      category: VehicleCategory,
      onOffer: (ride: RideRecord) => void
    ): () => void;
    acceptRide(rideId: string, driverId: string, vehicleId?: string | null): Promise<ServiceResult<AcceptRideResponse>>;
    rejectRide(rideId: string, driverId: string, reason?: string): Promise<ServiceResult<void>>;
    markArrived(rideId: string, driverId: string): Promise<ServiceResult<RideRecord>>;
    verifyPickupOtp(payload: VerifyPickupOtpPayload): Promise<ServiceResult<RideRecord>>;
    completeRide(payload: CompleteRidePayload): Promise<ServiceResult<RideRecord>>;
    cancelRide(rideId: string, driverId: string, reason: string): Promise<ServiceResult<RideRecord>>;
    getActiveRide(driverId: string): Promise<ServiceResult<RideRecord | null>>;
    getRideHistory(driverId: string): Promise<ServiceResult<RideRecord[]>>;
    subscribeMessages(rideId: string, onMessages: (messages: RideMessageRecord[]) => void): () => void;
    sendMessage(payload: SendRideMessagePayload): Promise<ServiceResult<RideMessageRecord>>;
  };
  finance: {
    getEarnings(driverId: string, period: EarningsSummary['period']): Promise<ServiceResult<EarningsSummary>>;
    getWallet(driverId: string): Promise<ServiceResult<WalletAccount | null>>;
    updatePayoutMethod(driverId: string, payload: PayoutMethodPayload): Promise<ServiceResult<WalletAccount>>;
    getPayoutHistory(driverId: string): Promise<ServiceResult<PayoutRecord[]>>;
    requestPayout(driverId: string, amountInr: number): Promise<ServiceResult<PayoutRecord>>;
    settleCashDues(driverId: string, amountInr: number): Promise<ServiceResult<WalletAccount>>;
    subscribeWalletTransactions?(
      driverId: string,
      onTxs: (txs: WalletTransactionRecord[]) => void
    ): () => void;
  };
  account: {
    getRatings(driverId: string): Promise<ServiceResult<DriverRatingRecord[]>>;
    subscribeRatings(driverId: string, onRating: (rating: DriverRatingRecord) => void): () => void;
    getNotifications(driverId: string): Promise<ServiceResult<DriverNotification[]>>;
    subscribeNotifications(driverId: string, onNotification: (notification: DriverNotification) => void): () => void;
    markNotificationRead(notificationId: string): Promise<ServiceResult<void>>;
    markAllNotificationsRead(driverId: string): Promise<ServiceResult<void>>;
    getSupportTickets(driverId: string): Promise<ServiceResult<SupportTicket[]>>;
    createSupportTicket(
      driverId: string,
      subject: string,
      description: string,
      rideId?: string
    ): Promise<ServiceResult<SupportTicket>>;
    triggerSos(driverId: string, rideId?: string, location?: GeoPoint): Promise<ServiceResult<SosAlertRecord>>;
    subscribeSosAlerts(driverId: string, onAlerts: (alerts: SosAlertRecord[]) => void): () => void;
  };
}
