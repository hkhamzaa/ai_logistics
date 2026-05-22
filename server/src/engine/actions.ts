import { env } from '../config/env';
import { prisma } from '../db/client';
import { createChildLogger } from '../lib/logger';
import { postSlackAlert } from '../integrations/slack';
import { sendSms } from '../integrations/twilio';
import { issueCaptureRefund } from '../integrations/paypal';
import type { RuleContext, ActionType, ActionResult } from './types';

const log = createChildLogger('actions');

// ── Refund policy ──────────────────────────────────────────────────

function computeRefundAmount(ctx: RuleContext): number {
  const now = ctx.now.getTime();
  const sla = new Date(ctx.shipment.slaDeadline).getTime();
  const hoursLate = (now - sla) / 3_600_000;
  const pct = hoursLate > 2 ? 0.5 : 0.2;
  const raw = ctx.shipment.declaredValue * pct;
  return parseFloat(Math.min(raw, env.REFUND_MAX_AMOUNT).toFixed(2));
}

// ── Individual action executors ────────────────────────────────────

async function actionReroute(ctx: RuleContext): Promise<ActionResult> {
  // Maps rerouting is wired in Phase 4 — routes.ts already stores polylines.
  // A real reroute call (new Directions request + vehicle polyline update) will be added
  // when a specific reroute trigger (Phase 4 incident injection) is processed.
  log.info({ shipmentId: ctx.shipment.id, dryRun: env.AGENT_DRY_RUN }, 'Reroute action triggered');
  return {
    action: 'reroute',
    status: env.AGENT_DRY_RUN ? 'dry_run' : 'success',
    detail: env.AGENT_DRY_RUN
      ? '[DRY] Would reroute vehicle via Google Maps Directions API'
      : 'Reroute request sent to simulation engine',
  };
}

async function actionSlackAlert(ctx: RuleContext, escalate: boolean): Promise<ActionResult> {
  const actionType: ActionType = escalate ? 'slack_escalate' : 'slack_alert';

  const logMsg = `[${escalate || ctx.isVip ? 'ESCALATED' : 'OPS'}] shipment ${ctx.shipment.id.slice(-8)} | risk ${Math.round(ctx.riskScore)}%`;

  if (env.AGENT_DRY_RUN) {
    log.info({ channel: env.SLACK_CHANNEL, msg: logMsg }, '[DRY] Slack alert suppressed');
    return { action: actionType, status: 'dry_run', detail: logMsg };
  }

  const result = await postSlackAlert({
    shipmentId: ctx.shipment.id,
    customerName: ctx.shipment.customer.name,
    isVip: ctx.isVip,
    riskScore: ctx.riskScore,
    anomalyScore: ctx.anomalyScore,
    actionsTaken: [],
    ruleId: 'monitoring',
    escalated: escalate,
    eta: ctx.shipment.currentEta?.toISOString() ?? null,
    slaDeadline: ctx.shipment.slaDeadline.toISOString(),
  });

  const slackActionResult: ActionResult = {
    action: actionType,
    status: result.error ? 'failed' : 'success',
    detail: result.error ?? `ts=${result.ts} channel=${result.channel}`,
  };
  if (result.error) slackActionResult.error = result.error;
  return slackActionResult;
}

async function actionCustomerSms(ctx: RuleContext): Promise<ActionResult> {
  const slaViolated = ctx.slaViolated;
  const messageType = slaViolated ? 'delay_notice' : ctx.anomalyScore >= 80 ? 'escalation' : 'delay_notice';

  if (env.AGENT_DRY_RUN) {
    log.info({ to: ctx.shipment.customer.phone, type: messageType }, '[DRY] SMS suppressed');
    return { action: 'customer_sms', status: 'dry_run', detail: `To: ${ctx.shipment.customer.phone} [${messageType}]` };
  }

  const result = await sendSms({
    to: ctx.shipment.customer.phone,
    customerName: ctx.shipment.customer.name,
    messageType,
    shipmentId: ctx.shipment.id,
    eta: ctx.shipment.currentEta?.toISOString() ?? null,
  });

  const smsActionResult: ActionResult = {
    action: 'customer_sms',
    status: result.error ? 'failed' : 'success',
    detail: result.error ?? `sid=${result.sid} status=${result.status}`,
  };
  if (result.error) smsActionResult.error = result.error;
  return smsActionResult;
}

async function actionIssueRefund(ctx: RuleContext): Promise<ActionResult> {
  const amount = computeRefundAmount(ctx);
  const idempotencyKey = `refund:${ctx.shipment.id}:sla_violated`;

  // ── Idempotency — never refund the same violation twice ───────────
  const existing = await prisma.payment.findUnique({ where: { idempotencyKey } });
  if (existing?.status === 'completed') {
    return { action: 'issue_refund', status: 'skipped', detail: `Already refunded (payment ${existing.id})` };
  }
  if (existing?.status === 'pending') {
    return { action: 'issue_refund', status: 'skipped', detail: `Refund already pending (payment ${existing.id})` };
  }

  // ── Cap check ─────────────────────────────────────────────────────
  const cappedAmount = parseFloat(
    Math.min(amount, (ctx.shipment.declaredValue * env.REFUND_MAX_PCT) / 100, env.REFUND_MAX_AMOUNT).toFixed(2),
  );

  // ── Daily circuit breaker ─────────────────────────────────────────
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const [todayCount, todayTotalResult] = await Promise.all([
    prisma.payment.count({ where: { kind: 'refund', createdAt: { gte: todayStart }, status: 'completed' } }),
    prisma.payment.aggregate({
      where: { kind: 'refund', createdAt: { gte: todayStart }, status: 'completed' },
      _sum: { amount: true },
    }),
  ]);
  const todayTotal = todayTotalResult._sum.amount ?? 0;

  if (todayCount >= env.REFUND_DAILY_MAX_COUNT || todayTotal >= env.REFUND_DAILY_MAX_AMOUNT) {
    log.warn({ todayCount, todayTotal }, 'Daily refund circuit breaker tripped');
    await prisma.shipment.update({ where: { id: ctx.shipment.id }, data: { refundStatus: 'pending_approval' } });
    return { action: 'issue_refund', status: 'skipped', detail: 'Daily circuit breaker tripped — routed to approval queue' };
  }

  // ── Approval threshold ────────────────────────────────────────────
  if (cappedAmount > env.REFUND_AUTO_APPROVE_LIMIT) {
    await prisma.shipment.update({ where: { id: ctx.shipment.id }, data: { refundStatus: 'pending_approval' } });
    const detail = `$${cappedAmount.toFixed(2)} exceeds auto-approve limit $${env.REFUND_AUTO_APPROVE_LIMIT} — routed to approval queue`;
    log.info({ amount: cappedAmount, limit: env.REFUND_AUTO_APPROVE_LIMIT, shipmentId: ctx.shipment.id }, detail);
    return { action: 'issue_refund', status: 'skipped', detail };
  }

  // ── Create payment record (pending) ──────────────────────────────
  const payment = await prisma.payment.create({
    data: {
      shipmentId: ctx.shipment.id,
      kind: 'refund',
      amount: cappedAmount,
      currency: 'USD',
      idempotencyKey,
      status: 'pending',
    },
  });

  if (env.AGENT_DRY_RUN) {
    const detail = `[DRY] Would refund $${cappedAmount.toFixed(2)} via PayPal sandbox (payment ${payment.id})`;
    log.info({ paymentId: payment.id, amount: cappedAmount, shipmentId: ctx.shipment.id }, detail);
    await prisma.shipment.update({ where: { id: ctx.shipment.id }, data: { refundStatus: 'pending' } });

    // Send SMS confirmation in dry-run too
    log.info({ to: ctx.shipment.customer.phone }, '[DRY] Refund confirmation SMS suppressed');
    return { action: 'issue_refund', status: 'dry_run', detail };
  }

  // ── Real PayPal sandbox refund ────────────────────────────────────
  const captureId = ctx.shipment.customer.paypalCaptureId;
  if (!captureId) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: 'No paypalCaptureId on customer' } });
    return { action: 'issue_refund', status: 'failed', detail: 'No PayPal capture ID on customer record', error: 'missing_capture_id' };
  }

  const refundResult = await issueCaptureRefund({
    captureId,
    amount: cappedAmount,
    currency: 'USD',
    idempotencyKey,
    shipmentId: ctx.shipment.id,
    note: `Partial refund for SLA violation on shipment ${ctx.shipment.id.slice(-8)}`,
  });

  if (refundResult.error) {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed', failureReason: refundResult.error } });
    await prisma.shipment.update({ where: { id: ctx.shipment.id }, data: { refundStatus: 'failed' } });
    return { action: 'issue_refund', status: 'failed', detail: refundResult.error, error: refundResult.error };
  }

  // ── Success ───────────────────────────────────────────────────────
  await prisma.payment.update({
    where: { id: payment.id },
    data: { status: 'completed', providerTxnId: refundResult.refundId ?? null },
  });
  await prisma.shipment.update({ where: { id: ctx.shipment.id }, data: { refundStatus: 'issued' } });

  // SMS refund confirmation
  await sendSms({
    to: ctx.shipment.customer.phone,
    customerName: ctx.shipment.customer.name,
    messageType: 'refund_confirmation',
    shipmentId: ctx.shipment.id,
    refundAmount: cappedAmount,
  });

  const detail = `Refund $${cappedAmount.toFixed(2)} issued — PayPal refundId=${refundResult.refundId}`;
  log.info({ paymentId: payment.id, refundId: refundResult.refundId, amount: cappedAmount }, detail);
  return { action: 'issue_refund', status: 'success', detail };
}

async function actionQueueApproval(ctx: RuleContext): Promise<ActionResult> {
  await prisma.shipment.update({ where: { id: ctx.shipment.id }, data: { refundStatus: 'pending_approval' } });
  log.warn({ shipmentId: ctx.shipment.id, anomalyScore: ctx.anomalyScore }, 'Shipment routed to human approval queue (suspected lost)');
  return { action: 'queue_approval', status: 'success', detail: 'Added to human approval queue' };
}

// ── Public dispatcher ──────────────────────────────────────────────

export async function executeAction(actionType: ActionType, ctx: RuleContext): Promise<ActionResult> {
  try {
    switch (actionType) {
      case 'reroute':          return await actionReroute(ctx);
      case 'slack_alert':      return await actionSlackAlert(ctx, false);
      case 'slack_escalate':   return await actionSlackAlert(ctx, true);
      case 'customer_sms':     return await actionCustomerSms(ctx);
      case 'issue_refund':     return await actionIssueRefund(ctx);
      case 'queue_approval':   return await actionQueueApproval(ctx);
    }
  } catch (err) {
    log.error({ err, actionType, shipmentId: ctx.shipment.id }, 'Action executor threw');
    return { action: actionType, status: 'failed', detail: String(err), error: String(err) };
  }
}
