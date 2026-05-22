import { Client, TravelMode, UnitSystem } from '@googlemaps/google-maps-services-js';
import { encode } from '@googlemaps/polyline-codec';
import { env } from '../config/env';
import { createChildLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';

const log = createChildLogger('maps');

const mapsClient = new Client({});

export interface RouteResult {
  encodedPolyline: string;
  distanceKm: number;
  durationMin: number;
  waypointsCount: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

/** Encode a straight-line fallback route (used in dry-run or when Maps call fails). */
function syntheticRoute(origin: LatLng, dest: LatLng, steps = 24): RouteResult {
  const points: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    points.push({
      lat: origin.lat + (dest.lat - origin.lat) * (i / steps),
      lng: origin.lng + (dest.lng - origin.lng) * (i / steps),
    });
  }
  const encodedPolyline = encode(points.map((p) => [p.lat, p.lng]));
  const distanceKm = haversineKm(origin, dest);
  const durationMin = (distanceKm / 50) * 60; // assume 50 kph average
  return { encodedPolyline, distanceKm, durationMin, waypointsCount: points.length };
}

export async function fetchRoute(origin: LatLng, dest: LatLng): Promise<RouteResult> {
  if (env.AGENT_DRY_RUN) {
    return syntheticRoute(origin, dest);
  }

  try {
    const result = await withRetry(() =>
      mapsClient.directions({
        params: {
          origin: `${origin.lat},${origin.lng}`,
          destination: `${dest.lat},${dest.lng}`,
          mode: TravelMode.driving,
          units: UnitSystem.metric,
          departure_time: 'now' as unknown as number,
          key: env.GOOGLE_MAPS_SERVER_KEY,
        },
      }),
    );

    const route = result.data.routes[0];
    if (!route) throw new Error('No route returned from Maps API');

    const leg = route.legs[0];
    if (!leg) throw new Error('No leg in Maps route');

    const distanceKm = (leg.distance?.value ?? 0) / 1000;
    const durationMin = (leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0) / 60;
    const encodedPolyline = route.overview_polyline.points;

    log.debug({ distanceKm, durationMin }, 'Fetched route from Maps');
    return { encodedPolyline, distanceKm, durationMin, waypointsCount: 0 };
  } catch (err) {
    log.warn({ err }, 'Maps API failed — falling back to synthetic route');
    return syntheticRoute(origin, dest);
  }
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
