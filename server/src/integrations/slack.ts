import { WebClient } from '@slack/web-api';
import { env } from '../config/env';
import { createChildLogger } from '../lib/logger';
import { withRetry } from '../lib/retry';

const log = createChildLogger('slack');

let _client: WebClient | null = null;

function getClient(): WebClient {
  if (!_client) _client = new WebClient(env.SLACK_BOT_TOKEN);
  return _client;
}

export interface SlackAlertPayload {
  shipmentId: string;
  customerName: string;
  isVip: boolean;
  riskScore: number;
  anomalyScore: number;
  actionsTaken: string[];
  ruleId: string;
  escalated: boolean;
  eta?: string | null;
  slaDeadline: string;
}

export interface SlackResult {
  ts?: string;
  channel?: string;
  error?: string;
}

export async function postSlackAlert(payload: SlackAlertPayload): Promise<SlackResult> {
  const priorityLabel = payload.escalated || payload.isVip ? '🚨 *ESCALATED*' : '⚠️ *OPS ALERT*';
  const vipBadge = payload.isVip ? ' `VIP`' : '';
  const riskBar = riskEmoji(payload.riskScore);
  const actionsText = payload.actionsTaken.join(', ');
  const etaText = payload.eta ? `<!date^${Math.floor(new Date(payload.eta).getTime() / 1000)}^{time}|${payload.eta}>` : '_unknown_';

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${payload.escalated ? '🚨' : '⚠️'} Logistics AI Alert`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Customer*\n${payload.customerName}${vipBadge}` },
        { type: 'mrkdwn', text: `*Shipment*\n\`${payload.shipmentId.slice(-8)}\`` },
        { type: 'mrkdwn', text: `*Risk Score*\n${riskBar} ${Math.round(payload.riskScore)}%` },
        { type: 'mrkdwn', text: `*Anomaly Score*\n${Math.round(payload.anomalyScore)}%` },
        { type: 'mrkdwn', text: `*ETA*\n${etaText}` },
        { type: 'mrkdwn', text: `*SLA Deadline*\n${new Date(payload.slaDeadline).toLocaleString()}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `${priorityLabel} | Rule: \`${payload.ruleId}\` | Actions: ${actionsText}` },
    },
    { type: 'divider' },
  ];

  try {
    const result = await withRetry(() =>
      getClient().chat.postMessage({
        channel: env.SLACK_CHANNEL,
        text: `${priorityLabel} — ${payload.customerName} shipment ${payload.shipmentId.slice(-8)} | Risk ${Math.round(payload.riskScore)}%`,
        blocks,
      }),
    );

    log.info({ ts: result.ts, channel: result.channel, ruleId: payload.ruleId }, 'Slack alert posted');
    const slackResult: SlackResult = {};
    if (result.ts) slackResult.ts = result.ts;
    if (result.channel) slackResult.channel = result.channel as string;
    return slackResult;
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log.error({ error, channel: env.SLACK_CHANNEL }, 'Failed to post Slack alert');
    return { error };
  }
}

function riskEmoji(score: number): string {
  if (score >= 80) return '🔴';
  if (score >= 50) return '🟡';
  return '🟢';
}
