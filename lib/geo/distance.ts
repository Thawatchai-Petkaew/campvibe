/**
 * lib/geo/distance.ts — CAM-449.
 *
 * Pure haversine great-circle distance helper — no external geocoding API,
 * no network call, no new dependency. Backs `distanceFromBangkokKm` on the
 * guest-safe camp-detail read (lib/ai/tools/get-camp-detail.ts) so the
 * in-chat assistant can answer "how far from Bangkok" from data CampVibe
 * already stores (CampSite.latitude/longitude).
 */

const EARTH_RADIUS_KM = 6371;

/** Fixed origin point (Victory Monument area, Bangkok) — a constant, never a DB/seed lookup. */
export const BANGKOK_ORIGIN = { lat: 13.7563, lng: 100.5018 } as const;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Great-circle distance between two lat/lng points, in kilometers. Pure
 * function — deterministic, no I/O.
 */
export function haversineDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);

  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Distance from the fixed Bangkok origin, rounded to 1 decimal place.
 * Returns `null` when either coordinate is missing/non-finite (e.g. a
 * legacy row with incomplete geo data) — callers must never treat `null` as
 * 0km.
 */
export function distanceFromBangkokKm(
  lat: number | null | undefined,
  lng: number | null | undefined
): number | null {
  if (
    typeof lat !== 'number' ||
    typeof lng !== 'number' ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }
  return Math.round(haversineDistanceKm(BANGKOK_ORIGIN, { lat, lng }) * 10) / 10;
}
