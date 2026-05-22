import twilio from 'twilio';
import { env } from '../config/env';
import { createChildLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';

const log = createChildLogger('twilio');

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (!_client) _client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  return _client;
}

export interface SmsPayload {
  to: string;
  customerName: string;
  messageType: 'delay_notice' | 'refund_confirmation' | 'escalation';
  shipmentId: string;
  eta?: string | null;
  refundAmount?: number;
}

export interface SmsResult {
  sid?: string;
  status?: string;
  error?: string;
}

const MESSAGE_TEMPLATES: Record<SmsPayload['messageType'], (p: SmsPayload) => string> = {
  delay_notice: (p) => {
    const etaStr = p.eta ? new Date(p.eta).toLocaleTimeString() : 'unknown';
    return `Hi ${p.customerName}, your shipment ${p.shipmentId.slice(-6)} is delayed. Updated ETA: ${etaStr}. We apologise for the inconvenience. - Logistics OS`;
  },
  refund_confirmation: (p) =>
    `Hi ${p.customerName}, we've issued a partial refund of $${p.refundAmount?.toFixed(2) ?? '0.00'} for shipment ${p.shipmentId.slice(-6)} due to the SLA delay. This will appear in 3-5 business days. - Logistics OS`,
  escalation: (p) =>
    `Hi ${p.customerName}, we're urgently investigating your shipment ${p.shipmentId.slice(-6)}. A team member will contact you shortly. - Logistics OS`,
};

export async function sendSms(payload: SmsPayload): Promise<SmsResult> {
  const body = MESSAGE_TEMPLATES[payload.messageType](payload);

  try {
    const message = await withRetry(() =>
      getClient().messages.create({
        from: env.TWILIO_FROM_NUMBER,
        to: payload.to,
        body,
      }),
    );

    log.info({ sid: message.sid, to: payload.to, type: payload.messageType }, 'SMS sent');
    return { sid: message.sid, status: message.status };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error, to: payload.to, type: payload.messageType }, 'Failed to send SMS');
    return { error };
  }
}
