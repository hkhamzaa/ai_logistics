import { prisma } from '../db/client';
import { env } from '../config/env';
import { computeRiskScore } from './risk';
import { computeAnomalyDelta, applyAnomalyDelta } from './anomaly';
import { evaluateShipment } from '../engine/engine';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('monitoring');

let handle: ReturnType<typeof setInterval> | null = null;

export function startMonitoring(): void {
  // Stagger 750ms after the simulation tick to ensure DB is written first
  setTimeout(() => {
    handle = setInterval(() => void runMonitoringTick(), env.SIMULATION_TICK_MS);
    log.info({ tickMs: env.SIMULATION_TICK_MS }, 'Monitoring loop started');
  }, 750);
}

export function stopMonitoring(): void {
  if (handle) {
    clearInterval(handle);
    handle = null;
  }
}

async function runMonitoringTick(): Promise<void> {
  const now = new Date();

  try {
    const shipments = await prisma.shipment.findMany({
      where: { status: { in: ['enroute', 'created'] } },
      include: { customer: true, vehicle: true },
    });

    for (const shipment of shipments) {
      const activeIncidents = await prisma.incident.findMany({
        where: { shipmentId: shipment.id, resolvedAt: null },
      });

      // Recompute scores
      const newRisk = computeRiskScore(shipment, activeIncidents, now, shipment.vehicle);
      const anomalyDelta = computeAnomalyDelta(shipment, shipment.vehicle, activeIncidents);
      const newAnomaly = applyAnomalyDelta(shipment.anomalyScore, anomalyDelta);

      // Persist updated scores
      const updated = await prisma.shipment.update({
        where: { id: shipment.id },
        data: { riskScore: newRisk, anomalyScore: newAnomaly },
        include: { customer: true, vehicle: true },
      });

      // Run the deterministic decision engine on the refreshed shipment
      await evaluateShipment(updated, now);
    }
  } catch (err) {
    log.error({ err }, 'Error in monitoring tick');
  }
}
