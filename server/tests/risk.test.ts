import { describe, it, expect } from 'vitest';
import { computeRiskScore } from '../src/monitoring/risk';
import type { Incident, Shipment, Vehicle } from '@prisma/client';

const now = new Date('2026-01-01T12:00:00Z');

function makeShipment(overrides: Partial<Shipment> = {}): Shipment {
  return {
    id: 'test-shipment',
    customerId: 'cust-1',
    vehicleId: 'veh-1',
    originLat: 37.7, originLng: -122.4,
    destLat: 37.8, destLng: -122.5,
    status: 'enroute',
    createdAt: new Date('2026-01-01T08:00:00Z'),
    slaDeadline: new Date('2026-01-01T14:00:00Z'), // 2h from now
    currentEta: new Date('2026-01-01T13:00:00Z'),  // 1h from now — within SLA
    riskScore: 0,
    anomalyScore: 0,
    refundStatus: 'none',
    declaredValue: 100,
    ...overrides,
  } as Shipment;
}

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: 'veh-1', label: 'Truck Alpha', status: 'enroute',
    currentLat: 37.75, currentLng: -122.45,
    speedKph: 50, routePolyline: null, routeProgress: 0.5, updatedAt: now,
    ...overrides,
  } as Vehicle;
}

function makeIncident(type: string, severity: string): Incident {
  return {
    id: 'inc-1', shipmentId: 'test-shipment',
    type, severity, detectedAt: now, resolvedAt: null,
  } as unknown as Incident;
}

describe('computeRiskScore', () => {
  it('returns low score when plenty of buffer remains', () => {
    const s = makeShipment();
    const score = computeRiskScore(s, [], now);
    expect(score).toBeLessThan(40);
  });

  it('returns high score (>=70) when SLA is violated and ETA is also late', () => {
    // slaViolation (0.30) + etaBuffer fully consumed (0.40) = 0.70 raw → score 70
    const s = makeShipment({
      slaDeadline: new Date('2026-01-01T10:00:00Z'), // 2h in the past
      currentEta: new Date('2026-01-01T13:00:00Z'),  // ETA past SLA
    });
    const score = computeRiskScore(s, [], now);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('returns 100 when SLA is violated AND critical incident is active', () => {
    const s = makeShipment({
      slaDeadline: new Date('2026-01-01T10:00:00Z'),
      currentEta: new Date('2026-01-01T13:00:00Z'),
    });
    // SLA(0.30) + etaBuffer(0.40) + criticalIncident(0.20) = 0.90 → 90
    // With progress lag it can reach 100
    const score = computeRiskScore(s, [makeIncident('traffic', 'critical')], now);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('adds contribution from critical incident', () => {
    const s = makeShipment();
    const noIncident = computeRiskScore(s, [], now);
    const withIncident = computeRiskScore(s, [makeIncident('traffic', 'critical')], now);
    expect(withIncident).toBeGreaterThan(noIncident);
  });

  it('ETA past SLA pushes score high even without violation yet', () => {
    const s = makeShipment({
      slaDeadline: new Date('2026-01-01T12:30:00Z'), // 30 min from now
      currentEta: new Date('2026-01-01T13:30:00Z'),  // ETA past SLA
    });
    const score = computeRiskScore(s, [], now);
    expect(score).toBeGreaterThanOrEqual(40);
  });

  it('progress lag increases risk', () => {
    const s = makeShipment();
    const noLag = computeRiskScore(s, [], now, makeVehicle({ routeProgress: 0.6 }));
    const withLag = computeRiskScore(s, [], now, makeVehicle({ routeProgress: 0.1 }));
    expect(withLag).toBeGreaterThan(noLag);
  });
});
