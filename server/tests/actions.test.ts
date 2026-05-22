import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock external integrations before importing actions ────────────
// Factories must not reference outer consts (vi.mock is hoisted)

vi.mock('../src/integrations/slack', () => ({
  postSlackAlert: vi.fn().mockResolvedValue({ ts: 'T123', channel: 'C456' }),
}));
vi.mock('../src/integrations/twilio', () => ({
  sendSms: vi.fn().mockResolvedValue({ sid: 'SM123', status: 'queued' }),
}));
vi.mock('../src/integrations/paypal', () => ({
  issueCaptureRefund: vi.fn().mockResolvedValue({ refundId: 'REF001', status: 'COMPLETED' }),
}));

vi.mock('../src/db/client', () => ({
  prisma: {
    payment: {
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      create: vi.fn().mockResolvedValue({ id: 'pay_new' }),
      update: vi.fn().mockResolvedValue({}),
    },
    shipment: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../src/config/env', () => ({
  env: {
    AGENT_DRY_RUN: false,
    REFUND_MAX_AMOUNT: 200,
    REFUND_MAX_PCT: 50,
    REFUND_AUTO_APPROVE_LIMIT: 50,
    REFUND_DAILY_MAX_COUNT: 10,
    REFUND_DAILY_MAX_AMOUNT: 500,
    SLACK_CHANNEL: '#ops',
  },
}));

import { executeAction } from '../src/engine/actions';
import { postSlackAlert } from '../src/integrations/slack';
import { sendSms } from '../src/integrations/twilio';
import { issueCaptureRefund } from '../src/integrations/paypal';
import { prisma } from '../src/db/client';
import type { RuleContext } from '../src/engine/types';

// ── Typed mock helpers ─────────────────────────────────────────────

const mPayment = vi.mocked(prisma.payment);
const mShipment = vi.mocked(prisma.shipment);

// ── Context factory ────────────────────────────────────────────────

function makeCtx(overrides: Partial<RuleContext> = {}): RuleContext {
  const now = new Date('2026-05-22T10:00:00Z');
  const sla = new Date('2026-05-22T08:00:00Z'); // 2 h past SLA
  return {
    now,
    riskScore: 85,
    anomalyScore: 30,
    isVip: false,
    slaViolated: true,
    etaLate: true,
    activeIncidents: [],
    shipment: {
      id: 'ship_1',
      customerId: 'cust_1',
      vehicleId: 'veh_1',
      status: 'delayed' as any,
      origin: 'A',
      destination: 'B',
      slaDeadline: sla,
      declaredValue: 100,
      refundStatus: null,
      currentEta: new Date('2026-05-22T11:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
      riskScore: 85,
      anomalyScore: 30,
      customer: {
        id: 'cust_1',
        name: 'Test Customer',
        phone: '+1234567890',
        email: 'test@test.com',
        isVip: false,
        paypalCaptureId: 'CAP_TEST_001',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      vehicle: null,
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mPayment.findUnique.mockResolvedValue(null);
  mPayment.count.mockResolvedValue(0);
  mPayment.aggregate.mockResolvedValue({ _sum: { amount: 0 } } as any);
  mPayment.create.mockResolvedValue({ id: 'pay_new' } as any);
  mPayment.update.mockResolvedValue({} as any);
  mShipment.update.mockResolvedValue({} as any);
  vi.mocked(postSlackAlert).mockResolvedValue({ ts: 'T123', channel: 'C456' });
  vi.mocked(sendSms).mockResolvedValue({ sid: 'SM123', status: 'queued' });
  vi.mocked(issueCaptureRefund).mockResolvedValue({ refundId: 'REF001', status: 'COMPLETED' });
});

// ── Slack alert ────────────────────────────────────────────────────

describe('slack_alert action', () => {
  it('calls postSlackAlert and returns success', async () => {
    const result = await executeAction('slack_alert', makeCtx());
    expect(postSlackAlert).toHaveBeenCalledOnce();
    expect(result.status).toBe('success');
    expect(result.detail).toContain('ts=T123');
  });

  it('returns failed when postSlackAlert errors', async () => {
    vi.mocked(postSlackAlert).mockResolvedValueOnce({ error: 'network error' });
    const result = await executeAction('slack_alert', makeCtx());
    expect(result.status).toBe('failed');
    expect(result.error).toBe('network error');
  });
});

// ── Customer SMS ───────────────────────────────────────────────────

describe('customer_sms action', () => {
  it('calls sendSms and returns success', async () => {
    const result = await executeAction('customer_sms', makeCtx());
    expect(sendSms).toHaveBeenCalledOnce();
    expect(result.status).toBe('success');
    expect(result.detail).toContain('sid=SM123');
  });

  it('returns failed when sendSms errors', async () => {
    vi.mocked(sendSms).mockResolvedValueOnce({ error: 'twilio error' });
    const result = await executeAction('customer_sms', makeCtx());
    expect(result.status).toBe('failed');
    expect(result.error).toBe('twilio error');
  });
});

// ── Issue refund — idempotency ─────────────────────────────────────

describe('issue_refund — idempotency', () => {
  it('skips when refund already completed', async () => {
    mPayment.findUnique.mockResolvedValueOnce({ id: 'pay_existing', status: 'completed' } as any);
    const result = await executeAction('issue_refund', makeCtx());
    expect(result.status).toBe('skipped');
    expect(result.detail).toContain('Already refunded');
    expect(issueCaptureRefund).not.toHaveBeenCalled();
  });

  it('skips when refund already pending', async () => {
    mPayment.findUnique.mockResolvedValueOnce({ id: 'pay_existing', status: 'pending' } as any);
    const result = await executeAction('issue_refund', makeCtx());
    expect(result.status).toBe('skipped');
    expect(result.detail).toContain('already pending');
    expect(issueCaptureRefund).not.toHaveBeenCalled();
  });
});

// ── Issue refund — circuit breaker ────────────────────────────────

describe('issue_refund — daily circuit breaker', () => {
  it('routes to approval queue when daily count at limit', async () => {
    mPayment.count.mockResolvedValueOnce(10);
    const result = await executeAction('issue_refund', makeCtx());
    expect(result.status).toBe('skipped');
    expect(result.detail).toContain('circuit breaker');
    expect(mShipment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { refundStatus: 'pending_approval' } }),
    );
    expect(issueCaptureRefund).not.toHaveBeenCalled();
  });

  it('routes to approval queue when daily amount at limit', async () => {
    mPayment.aggregate.mockResolvedValueOnce({ _sum: { amount: 500 } } as any);
    const result = await executeAction('issue_refund', makeCtx());
    expect(result.status).toBe('skipped');
    expect(result.detail).toContain('circuit breaker');
  });
});

// ── Issue refund — approval threshold ─────────────────────────────

describe('issue_refund — approval threshold', () => {
  it('routes to approval queue when amount exceeds auto-approve limit', async () => {
    // $1000 × 50% = $500 → capped to $200 (REFUND_MAX_AMOUNT) → still > $50 limit
    const ctx = makeCtx();
    (ctx.shipment as any).declaredValue = 1000;
    const result = await executeAction('issue_refund', ctx);
    expect(result.status).toBe('skipped');
    expect(result.detail).toContain('exceeds auto-approve limit');
    expect(issueCaptureRefund).not.toHaveBeenCalled();
  });
});

// ── Issue refund — success path ────────────────────────────────────

describe('issue_refund — success', () => {
  it('calls PayPal, marks payment completed, sends confirmation SMS', async () => {
    const result = await executeAction('issue_refund', makeCtx());
    expect(issueCaptureRefund).toHaveBeenCalledOnce();
    expect(mPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'completed' }) }),
    );
    expect(sendSms).toHaveBeenCalledWith(
      expect.objectContaining({ messageType: 'refund_confirmation' }),
    );
    expect(result.status).toBe('success');
    expect(result.detail).toContain('REF001');
  });

  it('marks payment failed when PayPal returns error', async () => {
    vi.mocked(issueCaptureRefund).mockResolvedValueOnce({ error: 'paypal sandbox error' });
    const result = await executeAction('issue_refund', makeCtx());
    expect(result.status).toBe('failed');
    expect(mPayment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });

  it('returns failed when customer has no paypalCaptureId', async () => {
    const ctx = makeCtx();
    (ctx.shipment.customer as any).paypalCaptureId = null;
    const result = await executeAction('issue_refund', ctx);
    expect(result.status).toBe('failed');
    expect(result.error).toBe('missing_capture_id');
    expect(issueCaptureRefund).not.toHaveBeenCalled();
  });
});
