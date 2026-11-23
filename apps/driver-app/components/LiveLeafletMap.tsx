import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Compass, Gauge, LocateFixed, Navigation } from 'lucide-react';
import type { GeoPoint, VehicleCategory } from '../contracts/types';
import { fetchOsrmDrivingRoute, type OsrmRouteResult } from '../services/osrmRouteService';

export interface MapPinPoint {
  lat: number;
  lng: number;
  label: string;
}

export interface LiveLeafletMapProps {
  driverLocation: GeoPoint | null;
  vehicleCategory?: VehicleCategory;
  pickupLocation?: MapPinPoint | null;
  dropoffLocation?: MapPinPoint | null;
  destination?: {
    lat: number;
    lng: number;
    label: string;
    kind: 'pickup' | 'dropoff';
  } | null;
  heightClass?: string;
  showSpeedometer?: boolean;
  onCenterGps?: () => void;
}

function getVehicleSvgMarkup(category: VehicleCategory): string {
  if (category === 'bike') {
    return `
      <svg width="28" height="36" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
        <!-- Front tire -->
        <rect x="14.5" y="2" width="7" height="11" rx="3.5" fill="#111111" stroke="#FFFFFF" stroke-width="1.2"/>
        <!-- Rear tire -->
        <rect x="14" y="34" width="8" height="12" rx="4" fill="#111111" stroke="#FFFFFF" stroke-width="1.2"/>
        <!-- Handlebar & mirrors -->
        <path d="M5 13L13 10.5H23L31 13" stroke="#111111" stroke-width="3.2" stroke-linecap="round"/>
        <circle cx="5.5" cy="13" r="2.2" fill="#FFC928" stroke="#111111" stroke-width="1"/>
        <circle cx="30.5" cy="13" r="2.2" fill="#FFC928" stroke="#111111" stroke-width="1"/>
        <!-- Headlight beam -->
        <path d="M14 9H22L20 5H16L14 9Z" fill="#FEF08A"/>
        <!-- Yellow Tank & Frame -->
        <rect x="11.5" y="12" width="13" height="14" rx="6" fill="#FFC928" stroke="#111111" stroke-width="1.8"/>
        <!-- Seat -->
        <rect x="13" y="24" width="10" height="12" rx="4" fill="#1E1E1E" stroke="#FFC928" stroke-width="1.2"/>
        <!-- Tail Light -->
        <rect x="15" y="37" width="6" height="2.4" rx="1.2" fill="#EF4444"/>
      </svg>
    `;
  }

  if (category === 'auto') {
    return `
      <svg width="32" height="38" viewBox="0 0 40 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
        <!-- Front wheel -->
        <rect x="17" y="2" width="6" height="9" rx="3" fill="#111111" stroke="#FFFFFF" stroke-width="1.2"/>
        <!-- Rear wheels -->
        <rect x="4" y="31" width="5.5" height="11" rx="2.5" fill="#111111" stroke="#FFFFFF" stroke-width="1"/>
        <rect x="30.5" y="31" width="5.5" height="11" rx="2.5" fill="#111111" stroke="#FFFFFF" stroke-width="1"/>
        <!-- Front yellow nose -->
        <path d="M10 15C10 9.5 14.5 7 20 7C25.5 7 30 9.5 30 15V22H10V15Z" fill="#FFC928" stroke="#111111" stroke-width="1.8"/>
        <!-- Windshield -->
        <path d="M12.5 15.5C12.5 13 15.5 11.5 20 11.5C24.5 11.5 27.5 13 27.5 15.5L26.5 19H13.5L12.5 15.5Z" fill="#1E293B"/>
        <!-- Classic Black Auto Canopy -->
        <rect x="8.5" y="19" width="23" height="22" rx="5.5" fill="#111111" stroke="#FFC928" stroke-width="1.8"/>
        <!-- Canopy Stripes -->
        <path d="M13 24H27M13 30H27" stroke="#FFC928" stroke-opacity="0.55" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Headlight & Taillights -->
        <circle cx="20" cy="8.5" r="2.2" fill="#FEF08A"/>
        <rect x="10.5" y="40" width="5" height="2" rx="1" fill="#EF4444"/>
        <rect x="24.5" y="40" width="5" height="2" rx="1" fill="#EF4444"/>
      </svg>
    `;
  }

  // Cab (Top-down glossy SHINE CAB)
  return `
    <svg width="30" height="42" viewBox="0 0 38 52" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 4px 8px rgba(0,0,0,0.48));">
      <!-- Wheels -->
      <rect x="3" y="9" width="3.5" height="9" rx="1.5" fill="#111111"/>
      <rect x="31.5" y="9" width="3.5" height="9" rx="1.5" fill="#111111"/>
      <rect x="3" y="34" width="3.5" height="9" rx="1.5" fill="#111111"/>
      <rect x="31.5" y="34" width="3.5" height="9" rx="1.5" fill="#111111"/>
      <!-- Side mirrors -->
      <path d="M5 17L7.5 18M33 17L30.5 18" stroke="#111111" stroke-width="2.5" stroke-linecap="round"/>
      <!-- Yellow Sedan Chassis -->
      <rect x="6.5" y="3" width="25" height="46" rx="8.5" fill="#FFC928" stroke="#111111" stroke-width="2"/>
      <!-- Headlights -->
      <rect x="8.5" y="4" width="5.5" height="2.6" rx="1.3" fill="#FFFFFF"/>
      <rect x="24" y="4" width="5.5" height="2.6" rx="1.3" fill="#FFFFFF"/>
      <!-- Windshield & Cabin Glass -->
      <path d="M10 15.5C10 13.8 11.4 12.5 13.2 12.5H24.8C26.6 12.5 28 13.8 28 15.5L26.5 21H11.5L10 15.5Z" fill="#111111"/>
      <rect x="11.5" y="21" width="15" height="12.5" rx="2.5" fill="#1E1E1E"/>
      <!-- SHINE Roof Top Emblem -->
      <rect x="14.5" y="24.5" width="9" height="4.5" rx="1.5" fill="#FFC928"/>
      <!-- Rear Glass -->
      <path d="M11.5 34H26.5L25 39.5C24.7 40.5 23.8 41 22.8 41H15.2C14.2 41 13.3 40.5 13 39.5L11.5 34Z" fill="#111111"/>
      <!-- Taillights -->
      <rect x="9" y="46" width="6" height="2.2" rx="1.1" fill="#EF4444"/>
      <rect x="23" y="46" width="6" height="2.2" rx="1.1" fill="#EF4444"/>
    </svg>
  `;
}

function buildDriverIcon(category: VehicleCategory, heading?: number | null): L.DivIcon {
  const rot = typeof heading === 'number' && Number.isFinite(heading) ? heading : 0;
  return L.divIcon({
    className: 'shine-driver-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
    html: `
      <div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <div class="shine-vehicle-rotator" style="display:flex;align-items:center;justify-content:center;transform:rotate(${rot}deg);transition:transform 180ms linear;">
          ${getVehicleSvgMarkup(category)}
        </div>
      </div>
    `,
  });
}

function buildTargetIcon(kind: 'pickup' | 'dropoff'): L.DivIcon {
  const color = kind === 'pickup' ? '#16A34A' : '#DC2626';
  const label = kind === 'pickup' ? 'P' : 'D';
  return L.divIcon({
    className: 'shine-target-marker',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `
      <div style="width:30px;height:30px;border-radius:9999px;background:${color};border:3px solid #FFFFFF;color:#FFFFFF;font-weight:800;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;">
        ${label}
      </div>
    `,
  });
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

export const LiveLeafletMap: React.FC<LiveLeafletMapProps> = ({
  driverLocation,
  vehicleCategory = 'cab',
  pickupLocation = null,
  dropoffLocation = null,
  destination = null,
  heightClass = 'h-56',
  showSpeedometer = true,
  onCenterGps,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const pickupMarkerRef = useRef<L.Marker | null>(null);
  const dropoffMarkerRef = useRef<L.Marker | null>(null);
  const primaryRouteRef = useRef<L.Polyline | null>(null);
  const secondaryRouteRef = useRef<L.Polyline | null>(null);
  const markerCategoryRef = useRef<VehicleCategory>(vehicleCategory);
  const animFrameRef = useRef<number | null>(null);
  const animatedPosRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const hasFittedBoundsRef = useRef<string>('');
  const [routeMeta, setRouteMeta] = useState<OsrmRouteResult | null>(null);

  // Derive normalized pickup/dropoff points supporting both explicit props and legacy `destination`
  const resolvedPickup: MapPinPoint | null =
    pickupLocation ?? (destination?.kind === 'pickup' ? { lat: destination.lat, lng: destination.lng, label: destination.label } : null);
  const resolvedDropoff: MapPinPoint | null =
    dropoffLocation ?? (destination?.kind === 'dropoff' ? { lat: destination.lat, lng: destination.lng, label: destination.label } : null);

  const primaryDestination: MapPinPoint | null =
    destination ?? resolvedPickup ?? resolvedDropoff ?? null;

  const centerLat = driverLocation?.lat ?? resolvedPickup?.lat ?? resolvedDropoff?.lat ?? null;
  const centerLng = driverLocation?.lng ?? resolvedPickup?.lng ?? resolvedDropoff?.lng ?? null;

  const rawSpeedKmh = driverLocation?.speed_kmh ?? 0;
  const speedKmh = rawSpeedKmh <= 1 ? 0 : Math.round(rawSpeedKmh);
  const isMoving = speedKmh > 1;

  // Initialize Leaflet map once we have any valid focal coordinate
  useEffect(() => {
    if (!containerRef.current || centerLat === null || centerLng === null) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      map.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
      pickupMarkerRef.current = null;
      dropoffMarkerRef.current = null;
      primaryRouteRef.current = null;
      secondaryRouteRef.current = null;
      animatedPosRef.current = null;
      hasFittedBoundsRef.current = '';
    };
  }, [centerLat !== null && centerLng !== null]);

  // Smoothly update vehicle marker with stationary brake lock + category icon fidelity
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!driverLocation) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (driverMarkerRef.current) {
        driverMarkerRef.current.remove();
        driverMarkerRef.current = null;
      }
      animatedPosRef.current = null;
      return;
    }

    const targetLat = driverLocation.lat;
    const targetLng = driverLocation.lng;
    const incomingHeading =
      typeof driverLocation.heading === 'number' && Number.isFinite(driverLocation.heading)
        ? driverLocation.heading
        : animatedPosRef.current?.heading ?? 0;

    if (!driverMarkerRef.current) {
      const icon = buildDriverIcon(vehicleCategory, incomingHeading);
      driverMarkerRef.current = L.marker([targetLat, targetLng], {
        icon,
        zIndexOffset: 500,
      })
        .addTo(map)
        .bindTooltip(`You (${vehicleCategory.toUpperCase()})`, { direction: 'top' });
      markerCategoryRef.current = vehicleCategory;
      animatedPosRef.current = { lat: targetLat, lng: targetLng, heading: incomingHeading };
      return;
    }

    // Rebuild marker icon only when vehicle category changes (prevents animation jitter)
    if (markerCategoryRef.current !== vehicleCategory) {
      markerCategoryRef.current = vehicleCategory;
      const lockedHeading = animatedPosRef.current?.heading ?? incomingHeading;
      driverMarkerRef.current.setIcon(buildDriverIcon(vehicleCategory, lockedHeading));
      driverMarkerRef.current.setTooltipContent(`You (${vehicleCategory.toUpperCase()})`);
    }

    const startPos = animatedPosRef.current ?? {
      lat: targetLat,
      lng: targetLng,
      heading: incomingHeading,
    };

    const distMeters = haversineMeters(startPos.lat, startPos.lng, targetLat, targetLng);

    // Stationary brake lock: if speed <= 1 km/h and small GPS noise (< 45m), halt movement/rotation completely
    if (!isMoving && distMeters < 45) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    // Update rotation cleanly via CSS transform without replacing DOM icon
    const nextHeading = isMoving ? incomingHeading : startPos.heading;
    const markerEl = driverMarkerRef.current.getElement();
    const rotator = markerEl?.querySelector<HTMLElement>('.shine-vehicle-rotator');
    if (rotator) {
      rotator.style.transform = `rotate(${nextHeading}deg)`;
    }

    // Large relocation jump (> 250m) snaps immediately rather than gliding across town
    if (distMeters > 250 || distMeters < 0.4) {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      driverMarkerRef.current.setLatLng([targetLat, targetLng]);
      animatedPosRef.current = { lat: targetLat, lng: targetLng, heading: nextHeading };
      return;
    }

    // Smooth 380ms animation along route updates
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
    }

    const durationMs = 380;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / durationMs);
      const eased = 1 - (1 - progress) * (1 - progress);
      const lat = startPos.lat + (targetLat - startPos.lat) * eased;
      const lng = startPos.lng + (targetLng - startPos.lng) * eased;
      driverMarkerRef.current?.setLatLng([lat, lng]);
      animatedPosRef.current = { lat, lng, heading: nextHeading };

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);
  }, [driverLocation?.lat, driverLocation?.lng, driverLocation?.heading, isMoving, vehicleCategory]);

  // Manage Pickup ('P') & Dropoff ('D') markers + initial/route framing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (resolvedPickup) {
      const pIcon = buildTargetIcon('pickup');
      if (!pickupMarkerRef.current) {
        pickupMarkerRef.current = L.marker([resolvedPickup.lat, resolvedPickup.lng], {
          icon: pIcon,
          zIndexOffset: 250,
        })
          .addTo(map)
          .bindTooltip(`Pickup: ${resolvedPickup.label}`, { direction: 'top' });
      } else {
        pickupMarkerRef.current.setLatLng([resolvedPickup.lat, resolvedPickup.lng]);
        pickupMarkerRef.current.setTooltipContent(`Pickup: ${resolvedPickup.label}`);
      }
    } else if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
      pickupMarkerRef.current = null;
    }

    if (resolvedDropoff) {
      const dIcon = buildTargetIcon('dropoff');
      if (!dropoffMarkerRef.current) {
        dropoffMarkerRef.current = L.marker([resolvedDropoff.lat, resolvedDropoff.lng], {
          icon: dIcon,
          zIndexOffset: 250,
        })
          .addTo(map)
          .bindTooltip(`Drop: ${resolvedDropoff.label}`, { direction: 'top' });
      } else {
        dropoffMarkerRef.current.setLatLng([resolvedDropoff.lat, resolvedDropoff.lng]);
        dropoffMarkerRef.current.setTooltipContent(`Drop: ${resolvedDropoff.label}`);
      }
    } else if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
      dropoffMarkerRef.current = null;
    }

    const points: [number, number][] = [];
    if (driverLocation) points.push([driverLocation.lat, driverLocation.lng]);
    if (resolvedPickup) points.push([resolvedPickup.lat, resolvedPickup.lng]);
    if (resolvedDropoff) points.push([resolvedDropoff.lat, resolvedDropoff.lng]);

    const boundsKey = [
      resolvedPickup ? `${resolvedPickup.lat.toFixed(4)},${resolvedPickup.lng.toFixed(4)}` : '-',
      resolvedDropoff ? `${resolvedDropoff.lat.toFixed(4)},${resolvedDropoff.lng.toFixed(4)}` : '-',
      driverLocation ? 'drv' : 'nodrv',
    ].join('|');

    if (points.length >= 2 && hasFittedBoundsRef.current !== boundsKey) {
      hasFittedBoundsRef.current = boundsKey;
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 16 });
    } else if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 15), { animate: true });
    }
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    resolvedPickup?.lat,
    resolvedPickup?.lng,
    resolvedPickup?.label,
    resolvedDropoff?.lat,
    resolvedDropoff?.lng,
    resolvedDropoff?.label,
  ]);

  // Fetch free OSRM driving route(s): primary active leg + optional preview trip leg
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const controller = new AbortController();

    const clearRoutes = () => {
      if (primaryRouteRef.current) {
        primaryRouteRef.current.remove();
        primaryRouteRef.current = null;
      }
      if (secondaryRouteRef.current) {
        secondaryRouteRef.current.remove();
        secondaryRouteRef.current = null;
      }
      setRouteMeta(null);
    };

    // Case 1: Active driver + primary target (pickup or dropoff)
    if (driverLocation && primaryDestination) {
      void fetchOsrmDrivingRoute(
        driverLocation.lat,
        driverLocation.lng,
        primaryDestination.lat,
        primaryDestination.lng,
        controller.signal
      ).then((res) => {
        if (controller.signal.aborted || !mapRef.current) return;
        setRouteMeta(res);
        if (primaryRouteRef.current) primaryRouteRef.current.remove();
        primaryRouteRef.current = L.polyline(res.coordinates, {
          color: '#FFC928',
          weight: 5,
          opacity: 0.94,
          dashArray: res.isFallback ? '8 8' : undefined,
        }).addTo(mapRef.current);
      });

      // Also draw Pickup -> Dropoff preview leg when en-route to pickup and both pins are present
      if (destination?.kind === 'pickup' && resolvedPickup && resolvedDropoff) {
        void fetchOsrmDrivingRoute(
          resolvedPickup.lat,
          resolvedPickup.lng,
          resolvedDropoff.lat,
          resolvedDropoff.lng,
          controller.signal
        ).then((tripRes) => {
          if (controller.signal.aborted || !mapRef.current) return;
          if (secondaryRouteRef.current) secondaryRouteRef.current.remove();
          secondaryRouteRef.current = L.polyline(tripRes.coordinates, {
            color: '#64748B',
            weight: 3.5,
            opacity: 0.72,
            dashArray: '6 8',
          }).addTo(mapRef.current);
        });
      } else if (secondaryRouteRef.current) {
        secondaryRouteRef.current.remove();
        secondaryRouteRef.current = null;
      }

      return () => controller.abort();
    }

    // Case 2: Offer preview with both Pickup & Dropoff even before GPS lock or prior to accept
    if (resolvedPickup && resolvedDropoff) {
      void fetchOsrmDrivingRoute(
        resolvedPickup.lat,
        resolvedPickup.lng,
        resolvedDropoff.lat,
        resolvedDropoff.lng,
        controller.signal
      ).then((res) => {
        if (controller.signal.aborted || !mapRef.current) return;
        setRouteMeta(res);
        if (primaryRouteRef.current) primaryRouteRef.current.remove();
        primaryRouteRef.current = L.polyline(res.coordinates, {
          color: '#FFC928',
          weight: 5,
          opacity: 0.94,
          dashArray: res.isFallback ? '8 8' : undefined,
        }).addTo(mapRef.current);
      });

      return () => controller.abort();
    }

    clearRoutes();
    return () => controller.abort();
  }, [
    driverLocation?.lat,
    driverLocation?.lng,
    primaryDestination?.lat,
    primaryDestination?.lng,
    destination?.kind,
    resolvedPickup?.lat,
    resolvedPickup?.lng,
    resolvedDropoff?.lat,
    resolvedDropoff?.lng,
  ]);

  if (centerLat === null || centerLng === null) {
    return (
      <div
        className={`flex ${heightClass} flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-[#111111] p-5 text-center text-white`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFC928]/15 text-[#FFC928]">
          <Compass className="h-6 w-6" />
        </div>
        <p className="mt-2.5 text-sm font-bold">OpenStreetMap Live GPS Ready</p>
        <p className="mt-1 max-w-xs text-xs text-neutral-400">
          Tap Sync GPS to acquire your device coordinates and render your live{' '}
          {vehicleCategory.toUpperCase()} marker on OpenStreetMap.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 ${heightClass}`}
    >
      <div ref={containerRef} className="z-0 h-full w-full" />

      {/* Top-Left Live Speedometer HUD Badge */}
      {showSpeedometer && (
        <div className="pointer-events-none absolute top-2.5 left-2.5 z-[400] flex items-center gap-2 rounded-xl border border-[#FFC928]/50 bg-[#111111]/95 px-2.5 py-1.5 text-white shadow-lg backdrop-blur-xs">
          <Gauge className="h-4 w-4 text-[#FFC928]" />
          <div className="leading-none">
            <span className="font-mono-num text-sm font-extrabold text-[#FFC928]">
              {speedKmh}
            </span>
            <span className="ml-1 text-[10px] font-bold text-neutral-300">km/h</span>
          </div>
          <span className="border-l border-neutral-700 pl-2 text-[10px] font-bold uppercase text-neutral-300">
            {vehicleCategory}
          </span>
          {driverLocation?.accuracy_m != null && (
            <span className="font-mono-num border-l border-neutral-700 pl-2 text-[10px] text-emerald-400">
              ±{driverLocation.accuracy_m}m
            </span>
          )}
        </div>
      )}

      {/* Top-Right Route Distance & ETA Pill (from free OSRM) */}
      {routeMeta && (
        <div className="pointer-events-none absolute top-2.5 right-2.5 z-[400] flex items-center gap-1.5 rounded-xl border border-neutral-700 bg-[#111111]/95 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-lg">
          <Navigation className="h-3.5 w-3.5 text-[#FFC928]" />
          <span className="font-mono-num">
            {routeMeta.distanceKm} km · {routeMeta.durationMin} min
          </span>
        </div>
      )}

      {/* Bottom-Right Re-Center GPS Button */}
      {onCenterGps && (
        <button
          type="button"
          onClick={onCenterGps}
          aria-label="Center map on GPS location"
          className="absolute right-2.5 bottom-7 z-[400] flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-700 bg-[#111111]/95 text-[#FFC928] shadow-md active:scale-95"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};
