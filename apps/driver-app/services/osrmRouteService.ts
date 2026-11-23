export interface OsrmRouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  isFallback: boolean;
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

export async function fetchOsrmDrivingRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  signal?: AbortSignal
): Promise<OsrmRouteResult> {
  const fallbackDist = Math.max(0.1, haversineDistanceKm(fromLat, fromLng, toLat, toLng));
  const fallbackResult: OsrmRouteResult = {
    coordinates: [
      [fromLat, fromLng],
      [toLat, toLng],
    ],
    distanceKm: fallbackDist,
    durationMin: Math.max(1, Math.round((fallbackDist / 26) * 60)),
    isFallback: true,
  };

  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${fromLng.toFixed(
      6
    )},${fromLat.toFixed(6)};${toLng.toFixed(6)},${toLat.toFixed(
      6
    )}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal });
    if (!response.ok) return fallbackResult;

    const payload = (await response.json()) as {
      code?: string;
      routes?: Array<{
        distance: number;
        duration: number;
        geometry?: { coordinates?: Array<[number, number]> };
      }>;
    };

    const route = payload.routes?.[0];
    if (!route || !route.geometry?.coordinates?.length) {
      return fallbackResult;
    }

    const latLngPoints: [number, number][] = route.geometry.coordinates.map(
      ([lng, lat]) => [lat, lng]
    );

    return {
      coordinates: latLngPoints,
      distanceKm: Number((route.distance / 1000).toFixed(2)),
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      isFallback: false,
    };
  } catch {
    return fallbackResult;
  }
}
