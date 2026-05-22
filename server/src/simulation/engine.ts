import type { Server } from 'socket.io';
import { prisma } from '../db/client';
import { env } from '../config/env';
import { ensureVehicleRoute } from './routes';
import { computeMovement } from './movement';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('simulation');

let tickHandle: ReturnType<typeof setInterval> | null = null;

export async function startSimulation(io: Server): Promise<void> {
  log.info({ tickMs: env.SIMULATION_TICK_MS }, 'Simulation engine starting');

  // Pre-fetch routes for all active shipments
  const active = await prisma.shipment.findMany({
    where: { status: { in: ['enroute', 'created'] } },
    include: { vehicle: true },
  });

  for (const s of active) {
    if (s.vehicle) {
      await ensureVehicleRoute(s as typeof s & { vehicle: NonNullable<typeof s.vehicle> });
    }
  }

  log.info({ count: active.length }, 'Routes initialised');

  tickHandle = setInterval(() => runTick(io), env.SIMULATION_TICK_MS);
}

export function stopSimulation(): void {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

async function runTick(io: Server): Promise<void> {
  try {
    const shipments = await prisma.shipment.findMany({
      where: { status: 'enroute' },
      include: {
        vehicle: true,
        incidents: { where: { resolvedAt: null } },
      },
    });

    for (const shipment of shipments) {
      if (!shipment.vehicle) continue;

      const movement = computeMovement(
        shipment.vehicle,
        shipment,
        shipment.incidents,
        env.SIMULATION_TICK_MS,
      );

      // Detect anomaly: vehicle is enroute but not moving and no explicit delay incident
      const stuckWithNoIncident =
        movement.speedKph === 0 &&
        !shipment.incidents.some((i) => i.type === 'delay' || i.type === 'lost');

      const anomalyDelta = stuckWithNoIncident ? 3 : 0;
      const lostAnomalyBoost = shipment.incidents.some((i) => i.type === 'lost') ? 5 : 0;
      const newAnomaly = Math.min(100, shipment.anomalyScore + anomalyDelta + lostAnomalyBoost);

      // Recalculate ETA based on remaining distance and current speed
      const newEta = movement.speedKph > 0
        ? new Date(Date.now() + estimateRemainingMs(shipment.vehicle.id, movement.routeProgress, movement.speedKph))
        : shipment.currentEta;

      const updatedVehicle = await prisma.vehicle.update({
        where: { id: shipment.vehicle.id },
        data: {
          currentLat: movement.lat,
          currentLng: movement.lng,
          speedKph: movement.speedKph,
          routeProgress: movement.routeProgress,
          status: movement.speedKph === 0 ? 'stopped' : 'enroute',
        },
      });

      const updatedShipment = await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          anomalyScore: newAnomaly,
          currentEta: newEta,
          ...(movement.completed ? { status: 'delivered' } : {}),
        },
        include: { customer: true, vehicle: true },
      });

      // Emit vehicle position update
      io.emit('vehicle:position', {
        vehicleId: updatedVehicle.id,
        lat: movement.lat,
        lng: movement.lng,
        speedKph: movement.speedKph,
        routeProgress: movement.routeProgress,
        status: updatedVehicle.status,
      });

      // Emit shipment update on every tick so the UI stays fresh
      io.emit('shipment:update', { shipment: updatedShipment });

      if (movement.completed) {
        log.info({ shipmentId: shipment.id }, 'Shipment delivered');
        io.emit('system:alert', {
          level: 'info',
          message: `Shipment ${shipment.id.slice(-6)} delivered successfully`,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    log.error({ err }, 'Error in simulation tick');
  }
}

function estimateRemainingMs(vehicleId: string, progress: number, speedKph: number): number {
  const { routeCache } = require('./routes') as { routeCache: Map<string, { distanceKm: number }> };
  const cached = routeCache.get(vehicleId);
  if (!cached || speedKph <= 0) return 0;
  const remainingKm = cached.distanceKm * (1 - progress);
  return (remainingKm / speedKph) * 3_600_000;
}
