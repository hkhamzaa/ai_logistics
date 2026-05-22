import type { Incident, Shipment, Vehicle } from '@prisma/client';
import { RISK_WEIGHTS, SEVERITY_SCORE } from '../engine/config';

/**
 * Computes a risk score 0–100 from a documented weighted formula.
 *
 * Component              | Weight | Signal
 * -----------------------|--------|-------------------------------------------
 * etaBuffer              |  0.40  | How close ETA is to the SLA deadline
 * slaViolation           |  0.30  | SLA deadline already passed
 * incidentSeverity       |  0.20  | Worst active incident severity (0–1)
 * progressLag            |  0.10  | Vehicle behind expected schedule
 */
export function computeRiskScore(
  shipment: Shipment,
  activeIncidents: Incident[],
  now: Date,
  vehicle?: Vehicle | null,
): number {
  // 1. ETA buffer component
  let etaBufferScore = 0;
  if (shipment.currentEta) {
    const etaMs = new Date(shipment.currentEta).getTime();
    const slaMs = new Date(shipment.slaDeadline).getTime();
    const createdMs = new Date(shipment.createdAt).getTime();
    const totalWindow = Math.max(1, slaMs - createdMs);

    if (etaMs > slaMs) {
      // ETA already past SLA — full score
      etaBufferScore = 1;
    } else {
      // Remaining buffer as fraction of window consumed
      const bufferRemaining = Math.max(0, slaMs - now.getTime());
      etaBufferScore = Math.max(0, 1 - bufferRemaining / totalWindow);
    }
  }

  // 2. SLA violation component
  const slaViolated = new Date(shipment.slaDeadline) < now ? 1 : 0;

  // 3. Incident severity component — worst active incident
  const incidentScore =
    activeIncidents.length > 0
      ? Math.max(...activeIncidents.map((i) => SEVERITY_SCORE[i.severity] ?? 0))
      : 0;

  // 4. Progress lag component
  // Compare actual routeProgress against where vehicle should be at this point in time
  let progressLagScore = 0;
  if (shipment.currentEta && vehicle) {
    const createdMs = new Date(shipment.createdAt).getTime();
    const etaMs = new Date(shipment.currentEta).getTime();
    const totalDurationMs = Math.max(1, etaMs - createdMs);
    const elapsedMs = now.getTime() - createdMs;
    const expectedProgress = Math.min(1, elapsedMs / totalDurationMs);
    progressLagScore = Math.max(0, expectedProgress - vehicle.routeProgress);
  }

  const raw =
    RISK_WEIGHTS.etaBuffer * etaBufferScore +
    RISK_WEIGHTS.slaViolation * slaViolated +
    RISK_WEIGHTS.incidentSeverity * incidentScore +
    RISK_WEIGHTS.progressLag * progressLagScore;

  return Math.min(100, Math.round(raw * 100));
}
