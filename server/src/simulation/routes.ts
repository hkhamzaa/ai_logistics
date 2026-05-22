import type { Shipment, Vehicle } from '@prisma/client';
import { prisma } from '../db/client';
import { fetchRoute } from '../integrations/maps';
import { decodePolyline, totalDistanceKm } from './polyline';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('routes');

/** In-memory cache of waypoints + total distance per vehicle id. */
export const routeCache = new Map<
  string,
  { waypoints: { lat: number; lng: number }[]; distanceKm: number }
>();

export async function ensureVehicleRoute(
  shipment: Shipment & { vehicle: Vehicle | null },
): Promise<void> {
  if (!shipment.vehicle) return;
  const v = shipment.vehicle;

  if (routeCache.has(v.id)) return;

  let encodedPoly = v.routePolyline ?? null;
  let distanceKm = 0;

  if (!encodedPoly) {
    const result = await fetchRoute(
      { lat: shipment.originLat, lng: shipment.originLng },
      { lat: shipment.destLat, lng: shipment.destLng },
    );
    encodedPoly = result.encodedPolyline;
    distanceKm = result.distanceKm;

    await prisma.vehicle.update({
      where: { id: v.id },
      data: { routePolyline: encodedPoly },
    });
    log.info({ vehicleId: v.id, distanceKm }, 'Route fetched and stored');
  }

  const waypoints = decodePolyline(encodedPoly);
  distanceKm = distanceKm > 0 ? distanceKm : totalDistanceKm(waypoints);
  routeCache.set(v.id, { waypoints, distanceKm });
}
