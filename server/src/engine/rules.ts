import type { Rule } from './types';
import { THRESHOLDS } from './config';

// Ordered rule table — evaluated top-to-bottom; all matching rules fire (not first-match).
// Add new rules here; do not scatter conditions across the codebase.
export const RULES: Rule[] = [
  {
    id: 'anomaly_suspected_lost',
    priority: 1,
    description: 'Anomaly score indicates suspected lost package — escalate to human queue, no auto-refund',
    condition: (ctx) => ctx.anomalyScore >= THRESHOLDS.anomalySuspectedLost,
    actions: ['queue_approval', 'slack_escalate'],
  },
  {
    id: 'sla_violated',
    priority: 2,
    description: 'SLA deadline has passed — issue partial refund, notify customer and ops',
    condition: (ctx) => ctx.slaViolated,
    actions: ['issue_refund', 'customer_sms', 'slack_alert'],
  },
  {
    id: 'vip_high_risk',
    priority: 3,
    description: 'VIP customer + risk above 70 — escalated reroute, priority Slack, SMS',
    condition: (ctx) => ctx.isVip && ctx.riskScore >= THRESHOLDS.vipRisk,
    actions: ['reroute', 'slack_escalate', 'customer_sms'],
  },
  {
    id: 'high_risk',
    priority: 4,
    description: 'Risk above 80 — reroute, Slack ops alert, customer SMS',
    condition: (ctx) => ctx.riskScore >= THRESHOLDS.highRisk,
    actions: ['reroute', 'slack_alert', 'customer_sms'],
  },
];
