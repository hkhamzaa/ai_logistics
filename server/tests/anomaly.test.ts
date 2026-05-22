import { describe, it, expect } from 'vitest';
import { computeAnomalyDelta, applyAnomalyDelta } from '../src/monitoring/anomaly';
import type { Incident, Vehicle } from '@prisma/client';

function makeVehicle(speedKph: number): Vehicle {
  return { id: 'v1', label: 'Truck', status: 'enroute', currentLat: 0, currentLng: 0,
    speedKph, routePolyline: null, routeProgress: 0.5, updatedAt: new Date() } as Vehicle;
}

function makeShipment() {
  return { id: 's1' } as Parameters<typeof computeAnomalyDelta>[0];
}

function makeIncident(type: string): Incident {
  return { id: 'i1', shipmentId: 's1', type, severity: 'high', detectedAt: new Date(), resolvedAt: null } as unknown as Incident;
}

describe('computeAnomalyDelta', () => {
  it('returns positive delta when lost incident is active', () => {
    const delta = computeAnomalyDelta(makeShipment(), makeVehicle(50), [makeIncident('lost')]);
    expect(delta).toBeGreaterThan(0);
  });

  it('returns positive delta when vehicle is stopped without incident', () => {
    const delta = computeAnomalyDelta(makeShipment(), makeVehicle(0), []);
    expect(delta).toBeGreaterThan(0);
  });

  it('returns negative delta when vehicle is moving normally', () => {
    const delta = computeAnomalyDelta(makeShipment(), makeVehicle(60), []);
    expect(delta).toBeLessThan(0);
  });

  it('does NOT penalise vehicle stopped by explicit delay incident', () => {
    const movingDelta = computeAnomalyDelta(makeShipment(), makeVehicle(60), []);
    const stoppedByDelay = computeAnomalyDelta(makeShipment(), makeVehicle(0), [makeIncident('delay')]);
    // Stopped by delay should not be worse than moving
    expect(stoppedByDelay).toBeLessThanOrEqual(movingDelta);
  });
});

describe('applyAnomalyDelta', () => {
  it('clamps to 0 floor', () => {
    expect(applyAnomalyDelta(1, -10)).toBe(0);
  });

  it('clamps to 100 ceiling', () => {
    expect(applyAnomalyDelta(98, 10)).toBe(100);
  });

  it('applies delta correctly in the normal range', () => {
    expect(applyAnomalyDelta(50, 5)).toBe(55);
    expect(applyAnomalyDelta(50, -5)).toBe(45);
  });
});
