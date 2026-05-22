import { prisma } from '../db/client';
import { env } from '../config/env';
import type { ActionResult, RuleContext } from '../engine/types';

export async function writeDecision(
  ctx: RuleContext,
  ruleId: string,
  trigger: string,
  results: ActionResult[],
): Promise<string> {
  const decision = await prisma.decision.create({
    data: {
      shipmentId: ctx.shipment.id,
      trigger,
      ruleId,
      inputsSnapshot: {
        riskScore: ctx.riskScore,
        anomalyScore: ctx.anomalyScore,
        slaViolated: ctx.slaViolated,
        etaLate: ctx.etaLate,
        isVip: ctx.isVip,
        activeIncidentCount: ctx.activeIncidents.length,
        activeIncidentTypes: ctx.activeIncidents.map((i) => i.type),
        vehicleId: ctx.shipment.vehicleId,
        routeProgress: ctx.shipment.vehicle?.routeProgress ?? null,
        snapshotAt: ctx.now.toISOString(),
      },
      actionsTaken: results.map((r) => r.action),
      apiResults: results.map((r) => ({
        action: r.action,
        status: r.status,
        detail: r.detail,
        error: r.error ?? null,
      })),
      dryRun: env.AGENT_DRY_RUN,
    },
  });
  return decision.id;
}
