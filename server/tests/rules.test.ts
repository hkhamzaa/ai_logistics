import { describe, it, expect } from 'vitest';
import { RULES } from '../src/engine/rules';
import type { RuleContext } from '../src/engine/types';
import type { ShipmentWithRelations } from '../src/models/shipment.repository';

function makeCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    shipment: { id: 'ship-1', customer: { isVip: false }, vehicle: null } as unknown as ShipmentWithRelations,
    activeIncidents: [],
    now: new Date(),
    isVip: false,
    slaViolated: false,
    etaLate: false,
    riskScore: 0,
    anomalyScore: 0,
    ...overrides,
  };
}

describe('Rule table', () => {
  it('anomaly_suspected_lost fires when anomaly >= 80', () => {
    const rule = RULES.find((r) => r.id === 'anomaly_suspected_lost')!;
    expect(rule.condition(makeCtx({ anomalyScore: 79 }))).toBe(false);
    expect(rule.condition(makeCtx({ anomalyScore: 80 }))).toBe(true);
    expect(rule.condition(makeCtx({ anomalyScore: 95 }))).toBe(true);
  });

  it('sla_violated fires only when SLA is past', () => {
    const rule = RULES.find((r) => r.id === 'sla_violated')!;
    expect(rule.condition(makeCtx({ slaViolated: false }))).toBe(false);
    expect(rule.condition(makeCtx({ slaViolated: true }))).toBe(true);
  });

  it('vip_high_risk requires both VIP flag and risk >= 70', () => {
    const rule = RULES.find((r) => r.id === 'vip_high_risk')!;
    expect(rule.condition(makeCtx({ isVip: true, riskScore: 69 }))).toBe(false);
    expect(rule.condition(makeCtx({ isVip: false, riskScore: 80 }))).toBe(false);
    expect(rule.condition(makeCtx({ isVip: true, riskScore: 70 }))).toBe(true);
    expect(rule.condition(makeCtx({ isVip: true, riskScore: 100 }))).toBe(true);
  });

  it('high_risk fires when risk >= 80 regardless of VIP status', () => {
    const rule = RULES.find((r) => r.id === 'high_risk')!;
    expect(rule.condition(makeCtx({ riskScore: 79 }))).toBe(false);
    expect(rule.condition(makeCtx({ riskScore: 80 }))).toBe(true);
    expect(rule.condition(makeCtx({ isVip: true, riskScore: 80 }))).toBe(true);
  });

  it('all rules are ordered by ascending priority', () => {
    for (let i = 1; i < RULES.length; i++) {
      expect(RULES[i]!.priority).toBeGreaterThanOrEqual(RULES[i - 1]!.priority);
    }
  });

  it('anomaly rule has higher priority (lower number) than high_risk', () => {
    const anomaly = RULES.find((r) => r.id === 'anomaly_suspected_lost')!;
    const highRisk = RULES.find((r) => r.id === 'high_risk')!;
    expect(anomaly.priority).toBeLessThan(highRisk.priority);
  });
});
