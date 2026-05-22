import type { Incident, Shipment, Vehicle } from '@prisma/client';

const LOST_BOOST_PER_TICK = 5;    // anomaly rise per tick when a 'lost' incident is active
const STUCK_BOOST_PER_TICK = 3;   // anomaly rise per tick when vehicle is stopped with no incident
const DECAY_PER_TICK = 1;         // anomaly decay per tick when nothing is wrong

/**
 * Computes an updated anomaly score based on the current tick's vehicle state.
 * Called once per tick after the simulation engine updates vehicle position.
 *
 * Signal                            | Effect
 * ----------------------------------|-------------------------------
 * Active 'lost' incident            | +5 per tick (caps at 100)
 * Vehicle stopped, no incident      | +3 per tick
 * Vehicle moving normally           | -1 per tick (floor 0)
 */
export function computeAnomalyDelta(
  shipment: Shipment,
  vehicle: Vehicle | null,
  activeIncidents: Incident[],
): number {
  const hasLost = activeIncidents.some((i) => i.type === 'lost');
  const hasDelay = activeIncidents.some((i) => i.type === 'delay');

  if (hasLost) return LOST_BOOST_PER_TICK;

  const vehicleStopped = vehicle ? vehicle.speedKph === 0 : false;

  if (vehicleStopped && !hasDelay) {
    // Stopped without an explicit delay incident is suspicious
    return STUCK_BOOST_PER_TICK;
  }

  // Recovering — decay slowly back towards 0
  return -DECAY_PER_TICK;
}

export function applyAnomalyDelta(current: number, delta: number): number {
  return Math.min(100, Math.max(0, Math.round(current + delta)));
}
