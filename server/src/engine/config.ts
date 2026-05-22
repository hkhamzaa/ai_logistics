// All tunable weights and thresholds in one place.
// Change numbers here; the engine automatically picks them up.

export const RISK_WEIGHTS = {
  etaBuffer: 0.40,       // ETA-vs-SLA proximity is the dominant signal
  slaViolation: 0.30,    // Already past deadline is an immediate spike
  incidentSeverity: 0.20, // Severity of worst active incident
  progressLag: 0.10,     // Vehicle behind schedule for elapsed time
} as const;

// Incident severity mapped to 0–1 contribution
export const SEVERITY_SCORE: Record<string, number> = {
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1.0,
};

// Rule firing thresholds (0–100)
export const THRESHOLDS = {
  highRisk: 80,
  vipRisk: 70,
  anomalySuspectedLost: 80,
} as const;

// How long (ms) before the same rule can fire again on the same shipment
export const COOLDOWN_MS: Record<string, number> = {
  high_risk: 5 * 60_000,
  vip_high_risk: 5 * 60_000,
  sla_violated: 30 * 60_000,
  anomaly_suspected_lost: 10 * 60_000,
};
