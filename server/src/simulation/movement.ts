import type { Vehicle, Shipment, Incident } from '@prisma/client';
import { interpolatePosition } from './polyline';
import { routeCache } from './routes';
import type { LatLng } from '../integrations/maps';

const BASE_SPEED_KPH: Record<string, number> = {
  Truck: 55,
  Van: 45,
};

export interface MovementResult {
  lat: number;
  lng: number;
  speedKph: number;
  routeProgress: number;
  completed: boolean;
}

export function computeMovement(
  vehicle: Vehicle,
  shipment: Shipment,
  activeIncidents: Incident[],
  tickMs: number,
): MovementResult {
  const cached = routeCache.get(vehicle.id);
  const waypoints = cached?.waypoints ?? [];
  const distanceKm = cached?.distanceKm ?? 1;

  // Determine effective speed considering incidents
  let speed = vehicle.speedKph;
  if (speed === 0) {
    // Start from a base speed if vehicle was idle/created
    const prefix = vehicle.label.split(' ')[0] ?? 'Van';
    speed = BASE_SPEED_KPH[prefix] ?? 50;
  }

  const hasDelay = activeIncidents.some((i) => i.type === 'delay' || i.type === 'lost');
  const hasTraffic = activeIncidents.some((i) => i.type === 'traffic');

  if (hasDelay) {
    speed = 0;
  } else if (hasTraffic) {
    speed = speed * 0.4; // 60% reduction
  }

  const distanceThisTick = speed * (tickMs / 3_600_000); // km
  const progressDelta = distanceKm > 0 ? distanceThisTick / distanceKm : 0;
  const newProgress = Math.min(1, vehicle.routeProgress + progressDelta);
  const completed = newProgress >= 1;

  let position: LatLng;
  if (waypoints.length >= 2) {
    position = interpolatePosition(waypoints, newProgress);
  } else {
    // Fallback: interpolate directly between origin and dest
    const t = newProgress;
    position = {
      lat: shipment.originLat + (shipment.destLat - shipment.originLat) * t,
      lng: shipment.originLng + (shipment.destLng - shipment.originLng) * t,
    };
  }

  return {
    lat: position.lat,
    lng: position.lng,
    speedKph: speed,
    routeProgress: newProgress,
    completed,
  };
}
