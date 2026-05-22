import {
  Client,
  Environment,
  LogLevel,
  PaymentsController,
  ApiError,
} from '@paypal/paypal-server-sdk';
import { env } from '../config/env';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('paypal');

let _client: Client | null = null;
let _paymentsController: PaymentsController | null = null;

function getController(): PaymentsController {
  if (!_paymentsController) {
    _client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: env.PAYPAL_CLIENT_ID,
        oAuthClientSecret: env.PAYPAL_CLIENT_SECRET,
      },
      environment:
        env.PAYPAL_ENV === 'live' ? Environment.Production : Environment.Sandbox,
      logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: false },
        logResponse: { logBody: false },
      },
    });
    _paymentsController = new PaymentsController(_client);
  }
  return _paymentsController;
}

export interface RefundRequest {
  captureId: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  shipmentId: string;
  note: string;
}

export interface RefundResult {
  refundId?: string;
  status?: string;
  error?: string;
}

export async function issueCaptureRefund(req: RefundRequest): Promise<RefundResult> {
  const controller = getController();

  try {
    const response = await controller.refundCapturedPayment({
      captureId: req.captureId,
      body: {
        amount: {
          currencyCode: req.currency,
          value: req.amount.toFixed(2),
        },
        noteToPayer: req.note,
      },
      paypalRequestId: req.idempotencyKey,
      prefer: 'return=representation',
    });

    const refund = response.result;
    log.info(
      { refundId: refund.id, status: refund.status, amount: req.amount, captureId: req.captureId },
      'PayPal refund issued',
    );
    const paypalResult: RefundResult = {};
    if (refund.id) paypalResult.refundId = refund.id;
    if (refund.status) paypalResult.status = String(refund.status);
    return paypalResult;
  } catch (err) {
    if (err instanceof ApiError) {
      const detail = err.result ? JSON.stringify(err.result) : err.message;
      log.error({ detail, captureId: req.captureId, statusCode: err.statusCode }, 'PayPal API error');
      return { error: `PayPal ${err.statusCode}: ${detail}` };
    }
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error, captureId: req.captureId }, 'PayPal unexpected error');
    return { error };
  }
}
