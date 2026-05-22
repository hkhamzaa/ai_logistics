import { prisma } from '../db/client';
import { RULES } from './rules';
import { COOLDOWN_MS } from './config';
import { executeAction } from './actions';
import { writeDecision } from '../lib/audit';
import { getIo } from '../realtime/socket';
import { createChildLogger } from '../lib/logger';
import { env } from '../config/env';
import type { RuleContext } from './types';
import type { ShipmentWithRelations } from '../models/shipment.repository';

const log = createChildLogger('engine');

export async function evaluateShipment(shipment: ShipmentWithRelations, now: Date): Promise<void> {
  const activeIncidents = await prisma.incident.findMany({
    where: { shipmentId: shipment.id, resolvedAt: null },
  });

  const ctx: RuleContext = {
    shipment,
    activeIncidents,
    now,
    isVip: shipment.customer.isVip,
    slaViolated: new Date(shipment.slaDeadline) < now,
    etaLate: shipment.currentEta ? new Date(shipment.currentEta) > new Date(shipment.slaDeadline) : false,
    riskScore: shipment.riskScore,
    anomalyScore: shipment.anomalyScore,
  };

  for (const rule of RULES) {
    if (!rule.condition(ctx)) continue;

    // Cooldown: skip if we fired this rule recently on this shipment
    const cooldownMs = COOLDOWN_MS[rule.id] ?? 5 * 60_000;
    const recent = await prisma.decision.findFirst({
      where: {
        shipmentId: shipment.id,
        ruleId: rule.id,
        createdAt: { gte: new Date(now.getTime() - cooldownMs) },
      },
    });
    if (recent) continue;

    log.info({ shipmentId: shipment.id, ruleId: rule.id, riskScore: ctx.riskScore, anomalyScore: ctx.anomalyScore }, `Rule fired: ${rule.description}`);

    // Execute all actions for this rule
    const results = await Promise.all(
      rule.actions.map((action) => executeAction(action, ctx)),
    );

    // Append-only audit log
    const decisionId = await writeDecision(ctx, rule.id, `monitoring_tick:${rule.id}`, results);

    // Broadcast to dashboard activity feed
    const io = getIo();
    io.emit('decision:new', {
      decision: {
        id: decisionId,
        shipmentId: shipment.id,
        createdAt: now.toISOString(),
        trigger: `monitoring_tick:${rule.id}`,
        ruleId: rule.id,
        actionsTaken: results.map((r) => r.action),
        dryRun: env.AGENT_DRY_RUN,
      },
    });

    io.emit('system:alert', {
      level: ctx.isVip && rule.id !== 'anomaly_suspected_lost' ? 'warn' : rule.id === 'anomaly_suspected_lost' ? 'error' : 'warn',
      message: buildAlertMessage(rule.id, ctx, results),
      timestamp: now.toISOString(),
    });

    // Re-broadcast updated shipment so scores show in UI
    const updated = await prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: { customer: true, vehicle: true },
    });
    if (updated) io.emit('shipment:update', { shipment: updated });
  }
}

function buildAlertMessage(ruleId: string, ctx: RuleContext, results: { action: string; status: string; detail: string }[]): string {
  const sid = ctx.shipment.id.slice(-8);
  const vip = ctx.isVip ? ' [VIP]' : '';
  const name = ctx.shipment.customer.name;

  const actionSummary = results
    .map((r) => `${r.action}:${r.status}`)
    .join(', ');

  switch (ruleId) {
    case 'anomaly_suspected_lost':
      return `🚨 Suspected lost — ${name}${vip} shipment ${sid} (anomaly ${Math.round(ctx.anomalyScore)}%) → ${actionSummary}`;
    case 'sla_violated':
      return `⏰ SLA violated — ${name}${vip} shipment ${sid} (risk ${Math.round(ctx.riskScore)}%) → ${actionSummary}`;
    case 'vip_high_risk':
      return `⚡ VIP high risk — ${name} shipment ${sid} (risk ${Math.round(ctx.riskScore)}%) → ${actionSummary}`;
    case 'high_risk':
      return `⚠️ High risk — ${name} shipment ${sid} (risk ${Math.round(ctx.riskScore)}%) → ${actionSummary}`;
    default:
      return `Rule ${ruleId} fired on shipment ${sid} → ${actionSummary}`;
  }
}
