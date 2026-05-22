import type { Incident } from '@prisma/client';
import type { ShipmentWithRelations } from '../models/shipment.repository';

export interface RuleContext {
  shipment: ShipmentWithRelations;
  activeIncidents: Incident[];
  now: Date;
  isVip: boolean;
  slaViolated: boolean;
  etaLate: boolean;       // currentEta is past slaDeadline
  riskScore: number;
  anomalyScore: number;
}

export type ActionType =
  | 'reroute'
  | 'slack_alert'
  | 'slack_escalate'
  | 'customer_sms'
  | 'issue_refund'
  | 'queue_approval';

export interface ActionResult {
  action: ActionType;
  status: 'success' | 'failed' | 'skipped' | 'dry_run';
  detail: string;
  error?: string;
}

export interface Rule {
  id: string;
  priority: number;   // lower = evaluated first
  description: string;
  condition: (ctx: RuleContext) => boolean;
  actions: ActionType[];
}
