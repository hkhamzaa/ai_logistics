import { decode, encode } from '@googlemaps/polyline-codec';
import { haversineKm, type LatLng } from '../integrations/maps';

export { encode as encodePolyline };

export function decodePolyline(encoded: string): LatLng[] {
  return decode(encoded, 5).map(([lat, lng]) => ({ lat, lng }));
}

/** Sum of haversine distances between consecutive waypoints, in km. */
export function totalDistanceKm(waypoints: LatLng[]): number {
  let d = 0;
  for (let i = 1; i < waypoints.length; i++) {
    d += haversineKm(waypoints[i - 1]!, waypoints[i]!);
  }
  return d;
}

/**
 * Interpolate a position along the polyline at a given progress fraction (0–1).
 * Uses cumulative distance for accurate placement.
 */
export function interpolatePosition(waypoints: LatLng[], progress: number): LatLng {
  if (waypoints.length === 0) return { lat: 0, lng: 0 };
  if (waypoints.length === 1) return waypoints[0]!;
  if (progress <= 0) return waypoints[0]!;
  if (progress >= 1) return waypoints[waypoints.length - 1]!;

  const total = totalDistanceKm(waypoints);
  if (total === 0) return waypoints[0]!;

  const target = total * progress;
  let accumulated = 0;

  for (let i = 1; i < waypoints.length; i++) {
    const segLen = haversineKm(waypoints[i - 1]!, waypoints[i]!);
    if (accumulated + segLen >= target) {
      const t = segLen === 0 ? 0 : (target - accumulated) / segLen;
      const a = waypoints[i - 1]!;
      const b = waypoints[i]!;
      return {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      };
    }
    accumulated += segLen;
  }

  return waypoints[waypoints.length - 1]!;
}

/** Generate a straight-line set of points between two coords (used as fallback). */
export function straightLine(origin: LatLng, dest: LatLng, steps = 24): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    pts.push({
      lat: origin.lat + (dest.lat - origin.lat) * (i / steps),
      lng: origin.lng + (dest.lng - origin.lng) * (i / steps),
    });
  }
  return pts;
}
