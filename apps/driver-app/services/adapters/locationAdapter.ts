import type { LiveLocationAdapter } from '../../contracts/integrations';
import type { GeoPoint, ServiceResult } from '../../contracts/types';

function normalizeSpeedKmh(speedMps: number | null): number | null {
  if (speedMps === null || !Number.isFinite(speedMps)) return 0;
  const kmh = speedMps * 3.6;
  return kmh <= 1 ? 0 : Math.round(kmh);
}

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearingDegrees(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dLambda = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  const deg = (Math.atan2(y, x) * 180) / Math.PI;
  return (deg + 360) % 360;
}

export const liveLocationAdapter: LiveLocationAdapter = {
  getStatus() {
    const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
    return {
      id: 'live_gps',
      label: 'Device GPS Telemetry',
      configured: supported,
      mode: supported ? 'browser_native' : 'unconfigured',
      missingEnvVars: [],
      notes: supported
        ? 'Reads authentic coordinates via browser Geolocation API.'
        : 'Geolocation API not supported.',
    };
  },

  async getCurrentPosition(highAccuracy = true): Promise<ServiceResult<GeoPoint>> {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      return {
        ok: false,
        configured: false,
        error: {
          code: 'INTEGRATION_NOT_CONFIGURED',
          message: 'Device GPS / Geolocation API is not available in this browser.',
        },
      };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const speedKmh = normalizeSpeedKmh(pos.coords.speed);
          const validHeading =
            typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading)
              ? Math.round(pos.coords.heading)
              : null;
          resolve({
            ok: true,
            configured: true,
            data: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: speedKmh && speedKmh > 1 ? validHeading : validHeading,
              speed_kmh: speedKmh,
              accuracy_m: Math.round(pos.coords.accuracy),
              recorded_at: new Date(pos.timestamp).toISOString(),
            },
          });
        },
        (err) => {
          resolve({
            ok: false,
            configured: true,
            error: {
              code: 'NETWORK_ERROR',
              message:
                err.code === err.PERMISSION_DENIED
                  ? 'Location permission was denied. Enable GPS permission to broadcast driver position.'
                  : err.message || 'Unable to acquire GPS fix.',
            },
          });
        },
        { enableHighAccuracy: highAccuracy, timeout: 10000, maximumAge: 5000 }
      );
    });
  },

  watchPosition(onPoint, onError, highAccuracy = true) {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      onError('Device Geolocation API is unavailable.');
      return () => {};
    }

    let lastFix: { lat: number; lng: number; heading: number } | null = null;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const speedKmh = normalizeSpeedKmh(pos.coords.speed) ?? 0;

        let heading: number | null =
          typeof pos.coords.heading === 'number' && Number.isFinite(pos.coords.heading)
            ? Math.round(pos.coords.heading)
            : null;

        if (speedKmh <= 1) {
          // Hold steady heading when braked/stationary to prevent stationary compass jitter
          heading = lastFix?.heading ?? heading ?? 0;
        } else {
          if (heading === null && lastFix) {
            const movedMeters = haversineMeters(lastFix.lat, lastFix.lng, lat, lng);
            if (movedMeters >= 2.5) {
              heading = Math.round(computeBearingDegrees(lastFix.lat, lastFix.lng, lat, lng));
            } else {
              heading = lastFix.heading;
            }
          }
          lastFix = { lat, lng, heading: heading ?? lastFix?.heading ?? 0 };
        }

        if (!lastFix) {
          lastFix = { lat, lng, heading: heading ?? 0 };
        }

        onPoint({
          lat,
          lng,
          heading: heading ?? 0,
          speed_kmh: speedKmh,
          accuracy_m: Math.round(pos.coords.accuracy),
          recorded_at: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => {
        onError(err.message || 'GPS tracking interrupted.');
      },
      { enableHighAccuracy: highAccuracy, timeout: 15000, maximumAge: 3000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  },
};
