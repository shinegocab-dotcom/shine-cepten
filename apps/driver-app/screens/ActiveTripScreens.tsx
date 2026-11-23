import React, { useState } from 'react';
import {
  Banknote,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  MapPin,
  Navigation,
  Phone,
  Share2,
  ShieldAlert,
  Star,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { LiveLeafletMap } from '../components/LiveLeafletMap';
import { RideChatDrawer } from '../components/RideChatDrawer';
import { PrimaryButton, ScreenHeader, StateNotice } from '../components/UiPrimitives';
import { mapsProviderAdapter } from '../services/adapters/externalAdapters';
import { driverBackendService } from '../services/driverBackendService';
import { useDriverApp } from '../state/DriverAppContext';

const CANCEL_REASONS = [
  'Customer requested cancellation',
  'Unable to reach pickup point / heavy blockage',
  'Vehicle mechanical issue / puncture',
  'Rider did not arrive after waiting',
] as const;

const CancelRideDrawer: React.FC<{
  rideId: string;
  driverId: string;
  onCancelled: () => Promise<void>;
}> = ({ rideId, driverId, onCancelled }) => {
  const { setFeedback } = useDriverApp();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(CANCEL_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const handleConfirmCancel = async () => {
    setBusy(true);
    const res = await driverBackendService.rides.cancelRide(rideId, driverId, reason);
    setBusy(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Cancellation Failed',
        message: res.error?.message || 'Unable to cancel active ride.',
      });
      return;
    }
    setOpen(false);
    setFeedback({
      type: 'info',
      title: 'Ride Cancelled',
      message: `Cancellation logged with reason: ${reason}`,
    });
    await onCancelled();
  };

  if (!open) {
    return (
      <PrimaryButton variant="outline" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4 text-red-600" />
        Cancel Ride
      </PrimaryButton>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/50 dark:bg-red-950/20">
      <p className="text-xs font-bold text-red-700 dark:text-red-300">
        Select Cancellation Reason
      </p>
      <div className="space-y-1.5">
        {CANCEL_REASONS.map((opt) => (
          <label
            key={opt}
            className="flex min-h-[38px] cursor-pointer items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-xs font-medium dark:bg-[#14161A]"
          >
            <input
              type="radio"
              name={`cancel-reason-${rideId}`}
              checked={reason === opt}
              onChange={() => setReason(opt)}
              className="accent-red-600"
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <PrimaryButton
          variant="danger"
          disabled={busy}
          onClick={() => void handleConfirmCancel()}
        >
          {busy ? 'Cancelling…' : 'Confirm Cancel Ride'}
        </PrimaryButton>
        <PrimaryButton variant="outline" onClick={() => setOpen(false)}>
          Keep Ride
        </PrimaryButton>
      </div>
    </div>
  );
};

export const PickupNavigationScreen: React.FC = () => {
  const {
    activeRide,
    setActiveRide,
    driverProfile,
    liveLocation,
    requestGpsFix,
    refreshDriverWorkspace,
    setFeedback,
    navigate,
  } = useDriverApp();
  const [arriving, setArriving] = useState(false);

  const handleMarkArrived = async () => {
    if (!activeRide || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'No Active Assigned Ride',
        message: 'Arrival updates require an active ride accepted in Cloud Firestore.',
      });
      return;
    }
    setArriving(true);
    const res = await driverBackendService.rides.markArrived(
      activeRide.ride_id,
      driverProfile.driver_id
    );
    setArriving(false);
    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Status Update Failed',
        message: res.error?.message || 'Unable to mark arrival.',
      });
      return;
    }
    if (res.data) setActiveRide(res.data);
    navigate('pickup_otp');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Pickup Navigation"
        subtitle="Free OpenStreetMap (Leaflet) + OSRM route to customer pickup point"
        action={
          <PrimaryButton variant="outline" onClick={() => void requestGpsFix()}>
            <Navigation className="h-4 w-4" />
            Sync GPS
          </PrimaryButton>
        }
      />

      {!activeRide ? (
        <StateNotice
          variant="empty"
          title="No Assigned Pickup Route"
          description="Pickup navigation populates strictly from an accepted Firestore ride (pickup_lat, pickup_lng, pickup_address)."
          actionLabel="View Customer Details Screen"
          onAction={() => navigate('customer_details')}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
            <LiveLeafletMap
              driverLocation={liveLocation}
              vehicleCategory={activeRide.vehicle_category || 'cab'}
              pickupLocation={{
                lat: activeRide.pickup_lat,
                lng: activeRide.pickup_lng,
                label: activeRide.pickup_address,
              }}
              dropoffLocation={{
                lat: activeRide.dropoff_lat,
                lng: activeRide.dropoff_lng,
                label: activeRide.dropoff_address,
              }}
              destination={{
                lat: activeRide.pickup_lat,
                lng: activeRide.pickup_lng,
                label: activeRide.pickup_address,
                kind: 'pickup',
              }}
              heightClass="h-56"
              showSpeedometer
              onCenterGps={() => void requestGpsFix()}
            />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-neutral-500">Pickup Address</p>
                <p className="mt-1 text-base font-bold">{activeRide.pickup_address}</p>
                <p className="font-mono-num mt-1 text-xs text-neutral-500">
                  Target: {Number(activeRide.pickup_lat ?? 0).toFixed(5)},{' '}
                  {Number(activeRide.pickup_lng ?? 0).toFixed(5)}
                  {liveLocation
                    ? ` · GPS: ${liveLocation.lat.toFixed(5)}, ${liveLocation.lng.toFixed(5)}`
                    : ''}
                </p>
              </div>
              <MapPin className="h-6 w-6 shrink-0 text-[#F5C518]" />
            </div>

            <div className="flex flex-wrap gap-2.5">
              <a
                href={mapsProviderAdapter.openExternalTurnByTurn(
                  activeRide.pickup_lat,
                  activeRide.pickup_lng,
                  activeRide.pickup_address
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                <span>Open Maps App</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              {activeRide.customer?.masked_phone && (
                <a
                  href={`tel:${activeRide.customer.masked_phone}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold dark:border-neutral-700"
                >
                  <Phone className="h-4 w-4 text-[#F5C518]" />
                  Call Rider
                </a>
              )}
              <PrimaryButton variant="brand" disabled={arriving} onClick={() => void handleMarkArrived()}>
                {arriving ? 'Updating…' : 'Arrived at Pickup'}
              </PrimaryButton>
              {driverProfile && (
                <CancelRideDrawer
                  rideId={activeRide.ride_id}
                  driverId={driverProfile.driver_id}
                  onCancelled={async () => {
                    setActiveRide(null);
                    await refreshDriverWorkspace();
                    navigate('dashboard');
                  }}
                />
              )}
            </div>
          </div>

          {driverProfile && (
            <RideChatDrawer
              rideId={activeRide.ride_id}
              driverId={driverProfile.driver_id}
              driverName={driverProfile.full_name}
              customerId={activeRide.customer_id}
              customerName={activeRide.customer?.display_name}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const CustomerDetailsScreen: React.FC = () => {
  const { activeRide, driverProfile, navigate } = useDriverApp();

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Customer Details"
        subtitle="Shared customer identity, live chat & pickup instructions for assigned ride"
      />

      {!activeRide?.customer ? (
        <StateNotice
          variant="empty"
          title="No Assigned Customer"
          description="Customer details (name, masked phone, rating, pickup instructions) are visible strictly after a real ride is assigned to you."
          actionLabel="Proceed to Pickup OTP Screen"
          onAction={() => navigate('pickup_otp')}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#1E1E1E] text-[#F5C518]">
                  <UserCheck className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold">
                    {activeRide.customer.display_name}
                  </h2>
                  <p className="font-mono-num flex items-center gap-2 text-xs text-neutral-500">
                    <span>ID: {activeRide.customer.customer_id}</span>
                    {activeRide.customer.rating != null && (
                      <span className="inline-flex items-center gap-1 font-bold text-[#1E1E1E] dark:text-[#F5C518]">
                        <Star className="h-3.5 w-3.5 fill-[#F5C518] text-[#F5C518]" />
                        {activeRide.customer.rating.toFixed(1)}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              {activeRide.customer.masked_phone && (
                <a
                  href={`tel:${activeRide.customer.masked_phone}`}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#F5C518] px-4 text-xs font-bold text-[#1E1E1E]"
                >
                  <Phone className="h-4 w-4" />
                  Call Customer
                </a>
              )}
            </div>

            <div className="space-y-2 rounded-xl bg-[#F7F8FA] p-3.5 text-xs dark:bg-[#1A1D23]">
              <p>
                <span className="font-semibold text-neutral-500">Pickup: </span>
                <span className="font-semibold">{activeRide.pickup_address}</span>
              </p>
              <p>
                <span className="font-semibold text-neutral-500">Dropoff: </span>
                <span className="font-semibold">{activeRide.dropoff_address}</span>
              </p>
              <p className="font-mono-num text-neutral-500">
                {activeRide.estimated_distance_km ?? 0} km · {activeRide.estimated_duration_min ?? 0} min ·{' '}
                {(activeRide.payment_mode || 'cash').toUpperCase()} · ₹
                {Number(activeRide.estimated_fare_inr ?? 0).toFixed(0)}
              </p>
            </div>

            {activeRide.customer.pickup_note && (
              <p className="rounded-xl border border-[#F5C518]/40 bg-[#F5C518]/10 p-3 text-xs font-medium text-neutral-800 dark:text-neutral-200">
                Pickup note: {activeRide.customer.pickup_note}
              </p>
            )}

            <div className="flex flex-wrap gap-2.5">
              <PrimaryButton variant="outline" onClick={() => navigate('pickup_navigation')}>
                <MapPin className="h-4 w-4" />
                Pickup Map
              </PrimaryButton>
              <PrimaryButton variant="brand" onClick={() => navigate('pickup_otp')}>
                <KeyRound className="h-4 w-4" />
                Enter Pickup OTP
              </PrimaryButton>
            </div>
          </div>

          {driverProfile && (
            <RideChatDrawer
              rideId={activeRide.ride_id}
              driverId={driverProfile.driver_id}
              driverName={driverProfile.full_name}
              customerId={activeRide.customer_id}
              customerName={activeRide.customer.display_name}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const PickupOtpScreen: React.FC = () => {
  const {
    backendConfigured,
    activeRide,
    setActiveRide,
    driverProfile,
    setFeedback,
    navigate,
  } = useDriverApp();
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 4) {
      setFeedback({
        type: 'error',
        title: '4-Digit OTP Required',
        message: 'Ask the customer for their 4-digit SHINE CAPTAIN ride start PIN.',
      });
      return;
    }

    if (!backendConfigured || !activeRide || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'No Assigned Ride Active',
        message:
          'Accept an assigned customer ride first before verifying the 4-digit Pickup OTP.',
      });
      return;
    }

    setVerifying(true);
    const res = await driverBackendService.rides.verifyPickupOtp({
      ride_id: activeRide.ride_id,
      driver_id: driverProfile.driver_id,
      otp_code: otp,
    });
    setVerifying(false);

    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'OTP Verification Failed',
        message: res.error?.message || 'Incorrect pickup OTP.',
      });
      return;
    }
    if (res.data) setActiveRide(res.data);
    navigate('active_ride');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Pickup OTP Verification"
        subtitle="Verify the customer's 4-digit PIN before starting the trip"
      />

      <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
        <form onSubmit={handleVerify} className="max-w-sm space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-[#F5C518]" />
            <span>Customer Ride PIN</span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            placeholder="••••"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
            className="font-mono-num min-h-[54px] w-full rounded-xl border border-neutral-300 bg-neutral-50 px-4 text-center text-2xl font-bold tracking-[0.5em] outline-none focus:border-[#F5C518] dark:border-neutral-700 dark:bg-[#1A1D23]"
          />
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Validated strictly in Cloud Firestore against the ride&apos;s Customer App PIN. Trips
            cannot transition to active until verified.
          </p>
          <PrimaryButton type="submit" variant="brand" disabled={verifying} className="w-full">
            {verifying ? 'Verifying PIN…' : 'Verify OTP & Start Ride'}
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
};

export const ActiveRideScreen: React.FC = () => {
  const {
    activeRide,
    setActiveRide,
    setLastCompletedRide,
    driverProfile,
    liveLocation,
    requestGpsFix,
    setFeedback,
    refreshDriverWorkspace,
    navigate,
  } = useDriverApp();
  const [completing, setCompleting] = useState(false);

  const handleShareTrip = async () => {
    if (!activeRide) return;
    const gpsText = liveLocation
      ? `https://www.openstreetmap.org/?mlat=${liveLocation.lat.toFixed(5)}&mlon=${liveLocation.lng.toFixed(5)}#map=16/${liveLocation.lat.toFixed(5)}/${liveLocation.lng.toFixed(5)}`
      : `https://www.openstreetmap.org/?mlat=${activeRide.dropoff_lat.toFixed(5)}&mlon=${activeRide.dropoff_lng.toFixed(5)}#map=16/${activeRide.dropoff_lat.toFixed(5)}/${activeRide.dropoff_lng.toFixed(5)}`;
    const shareText = `SHINE CAPTAIN Live Trip (${activeRide.ride_id})\nFrom: ${activeRide.pickup_address}\nTo: ${activeRide.dropoff_address}\nTrack GPS: ${gpsText}`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'SHINE CAPTAIN Live Trip', text: shareText });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        setFeedback({
          type: 'success',
          title: 'Trip Link Copied',
          message: 'Live trip status & GPS coordinates copied to clipboard.',
        });
        return;
      } catch {
        // Clipboard permission denied
      }
    }
    setFeedback({
      type: 'info',
      title: 'Live Trip Coordinates',
      message: gpsText,
    });
  };

  const handleCompleteRide = async () => {
    if (!activeRide || !driverProfile) {
      setFeedback({
        type: 'error',
        title: 'No Active In-Progress Ride',
        message: 'Only rides with verified pickup OTP in progress can be completed.',
      });
      return;
    }

    setCompleting(true);
    const res = await driverBackendService.rides.completeRide({
      ride_id: activeRide.ride_id,
      driver_id: driverProfile.driver_id,
      actual_distance_km: activeRide.estimated_distance_km,
      actual_duration_min: activeRide.estimated_duration_min,
    });
    setCompleting(false);

    if (!res.ok) {
      setFeedback({
        type: 'error',
        title: 'Completion Blocked',
        message: res.error?.message || 'Unable to complete ride.',
      });
      return;
    }
    if (res.data) setLastCompletedRide(res.data);
    setActiveRide(null);
    await refreshDriverWorkspace();
    navigate('ride_completion');
  };

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Active Ride Screen"
        subtitle="OpenStreetMap dropoff route, speedometer telemetry, live chat & SOS"
        action={
          <PrimaryButton variant="danger" onClick={() => navigate('emergency_sos')}>
            <ShieldAlert className="h-4 w-4" />
            SOS
          </PrimaryButton>
        }
      />

      {!activeRide ? (
        <StateNotice
          variant="empty"
          title="No Ride Currently In Progress"
          description="Active trip telemetry and OSRM route navigation appear once a customer's 4-digit Pickup OTP is verified."
          actionLabel="View Ride Completion Layout"
          onAction={() => navigate('ride_completion')}
        />
      ) : (
        <div className="space-y-4">
          <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-[#14161A]">
            <LiveLeafletMap
              driverLocation={liveLocation}
              vehicleCategory={activeRide.vehicle_category || 'cab'}
              pickupLocation={{
                lat: activeRide.pickup_lat,
                lng: activeRide.pickup_lng,
                label: activeRide.pickup_address,
              }}
              dropoffLocation={{
                lat: activeRide.dropoff_lat,
                lng: activeRide.dropoff_lng,
                label: activeRide.dropoff_address,
              }}
              destination={{
                lat: activeRide.dropoff_lat,
                lng: activeRide.dropoff_lng,
                label: activeRide.dropoff_address,
                kind: 'dropoff',
              }}
              heightClass="h-56"
              showSpeedometer
              onCenterGps={() => void requestGpsFix()}
            />

            <div>
              <p className="text-xs font-semibold text-neutral-500">Dropoff Destination</p>
              <p className="mt-1 text-base font-bold">{activeRide.dropoff_address}</p>
              <p className="font-mono-num mt-1.5 text-xs text-neutral-500">
                Fare: ₹{Number(activeRide.estimated_fare_inr ?? 0).toFixed(2)} ·{' '}
                {(activeRide.payment_mode || 'cash').toUpperCase()} · {activeRide.estimated_distance_km ?? 0} km
                {liveLocation ? ` · GPS ${liveLocation.lat.toFixed(4)}, ${liveLocation.lng.toFixed(4)}` : ''}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={mapsProviderAdapter.openExternalTurnByTurn(
                  activeRide.dropoff_lat,
                  activeRide.dropoff_lng,
                  activeRide.dropoff_address
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold dark:border-neutral-700"
              >
                Open Maps App
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {activeRide.customer?.masked_phone && (
                <a
                  href={`tel:${activeRide.customer.masked_phone}`}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-neutral-300 px-3.5 text-xs font-semibold dark:border-neutral-700"
                >
                  <Phone className="h-3.5 w-3.5 text-[#F5C518]" />
                  Call Rider
                </a>
              )}
              <PrimaryButton variant="outline" onClick={() => void handleShareTrip()}>
                <Share2 className="h-3.5 w-3.5" />
                Share Trip
              </PrimaryButton>
            </div>

            <PrimaryButton
              variant="brand"
              className="w-full"
              disabled={completing}
              onClick={() => void handleCompleteRide()}
            >
              {completing ? 'Finalizing Ledger…' : 'Complete Ride & Settle Fare'}
            </PrimaryButton>

            {driverProfile && (
              <CancelRideDrawer
                rideId={activeRide.ride_id}
                driverId={driverProfile.driver_id}
                onCancelled={async () => {
                  setActiveRide(null);
                  await refreshDriverWorkspace();
                  navigate('dashboard');
                }}
              />
            )}
          </div>

          {driverProfile && (
            <RideChatDrawer
              rideId={activeRide.ride_id}
              driverId={driverProfile.driver_id}
              driverName={driverProfile.full_name}
              customerId={activeRide.customer_id}
              customerName={activeRide.customer?.display_name}
            />
          )}
        </div>
      )}
    </div>
  );
};

export const RideCompletionScreen: React.FC = () => {
  const { lastCompletedRide, rideHistory, navigate } = useDriverApp();
  const latestCompleted = lastCompletedRide || rideHistory.find((r) => r.status === 'completed');

  const finalFare = latestCompleted?.final_fare_inr ?? latestCompleted?.estimated_fare_inr ?? 0;
  const isCash = latestCompleted?.payment_mode === 'cash';

  return (
    <div className="space-y-4">
      <ScreenHeader
        title="Ride Completion & Fare Summary"
        subtitle="Firestore transaction-calculated fare, commission, and net driver payout"
      />

      {!latestCompleted ? (
        <StateNotice
          variant="empty"
          title="No Verified Completed Ride Summary"
          description="Fare breakdowns, commission deductions, and cash/UPI collection confirmations appear immediately after completing a live trip."
          actionLabel="Go to Earnings Dashboard"
          onAction={() => navigate('earnings')}
        />
      ) : (
        <div className="space-y-4">
          <div
            className={`rounded-2xl border p-4 ${
              isCash
                ? 'border-[#F5C518] bg-[#F5C518]/15 text-[#1E1E1E] dark:text-white'
                : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200'
            }`}
          >
            <div className="flex items-center gap-3">
              {isCash ? (
                <Banknote className="h-6 w-6 shrink-0 text-[#1E1E1E] dark:text-[#F5C518]" />
              ) : (
                <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
              <div>
                <p className="text-sm font-extrabold">
                  {isCash
                    ? `Collect ₹${Number(finalFare ?? 0).toFixed(2)} Cash from Customer`
                    : `Paid Online (${(latestCompleted.payment_mode || 'online').replace('_', ' ').toUpperCase()})`}
                </p>
                <p className="text-xs opacity-80">
                  {isCash
                    ? 'Net earnings & platform commission due updated in Partner Wallet.'
                    : 'Net driver payout credited directly to your Firestore wallet balance.'}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-neutral-800 dark:bg-[#14161A]">
            <p className="font-mono-num text-xs text-neutral-500">
              Ride {latestCompleted.ride_id} · {latestCompleted.estimated_distance_km} km ·{' '}
              {latestCompleted.estimated_duration_min} min
            </p>
            <div className="mt-3 space-y-1 text-xs">
              <p className="truncate font-semibold">From: {latestCompleted.pickup_address}</p>
              <p className="truncate text-neutral-600 dark:text-neutral-300">
                To: {latestCompleted.dropoff_address}
              </p>
            </div>
            <div className="mt-4 space-y-2.5 border-t border-neutral-200 pt-3.5 text-sm dark:border-neutral-800">
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Final Gross Fare</span>
                <span className="font-mono-num font-semibold">₹{Number(finalFare ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-600 dark:text-neutral-400">Platform Commission</span>
                <span className="font-mono-num text-red-600 dark:text-red-400">
                  -₹{Number(latestCompleted.commission_inr ?? 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-2.5 text-base font-bold dark:border-neutral-800">
                <span>Net Driver Earnings</span>
                <span className="font-mono-num text-emerald-700 dark:text-emerald-400">
                  ₹{Number(latestCompleted.driver_net_inr ?? finalFare ?? 0).toFixed(2)}
                </span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <PrimaryButton variant="brand" className="flex-1" onClick={() => navigate('dashboard')}>
                Back to Home Cockpit
              </PrimaryButton>
              <PrimaryButton variant="outline" onClick={() => navigate('earnings')}>
                Earnings
              </PrimaryButton>
              <PrimaryButton variant="outline" onClick={() => navigate('ride_history')}>
                History
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
