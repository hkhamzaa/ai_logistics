import type { AlertMessage } from '../hooks/useShipments';
import type { DecisionDto } from '@logistics/shared';

interface Props {
  alerts: AlertMessage[];
  decisions: DecisionDto[];
  isConnected: boolean;
}

type FeedItem =
  | { kind: 'alert'; id: string; level: 'info' | 'warn' | 'error'; message: string; ts: number }
  | { kind: 'decision'; id: string; ruleId: string; actionsTaken: string[]; dryRun: boolean; ts: number };

const ALERT_STYLES: Record<string, string> = {
  info:  'border-sky-800 text-sky-300',
  warn:  'border-amber-700 text-amber-300',
  error: 'border-red-700 text-red-300',
};

const RULE_LABELS: Record<string, string> = {
  anomaly_suspected_lost: 'Suspected Lost',
  sla_violated:           'SLA Violated',
  vip_high_risk:          'VIP High Risk',
  high_risk:              'High Risk',
};

const ACTION_SHORT: Record<string, string> = {
  reroute:        'Reroute',
  slack_alert:    'Slack',
  slack_escalate: 'Escalate',
  customer_sms:   'SMS',
  issue_refund:   'Refund',
  queue_approval: 'Queue',
};

export function ActivityFeed({ alerts, decisions, isConnected }: Props) {
  const feed: FeedItem[] = [
    ...alerts.map((a): FeedItem => ({
      kind: 'alert',
      id: a.id,
      level: a.level,
      message: a.message,
      ts: new Date(a.timestamp).getTime(),
    })),
    ...decisions.map((d): FeedItem => ({
      kind: 'decision',
      id: d.id,
      ruleId: d.ruleId,
      actionsTaken: d.actionsTaken,
      dryRun: d.dryRun,
      ts: new Date(d.createdAt).getTime(),
    })),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 60);

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Activity Feed</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full ${isConnected ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
          {isConnected ? 'live' : 'disconnected'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
        {feed.length === 0 && (
          <p className="text-sm text-gray-600">Waiting for events…</p>
        )}

        {feed.map((item) =>
          item.kind === 'alert' ? (
            <div
              key={item.id}
              className={`rounded px-2 py-1.5 text-xs border-l-2 bg-gray-800/70 ${ALERT_STYLES[item.level]}`}
            >
              <span className="font-mono text-gray-500 mr-2 tabular-nums">
                {new Date(item.ts).toLocaleTimeString()}
              </span>
              {item.message}
            </div>
          ) : (
            <div
              key={item.id}
              className="rounded px-2 py-1.5 text-xs border-l-2 border-purple-700 bg-gray-800/70"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-gray-500 tabular-nums">
                  {new Date(item.ts).toLocaleTimeString()}
                </span>
                {item.dryRun && <span className="text-blue-400">DRY</span>}
              </div>
              <p className="text-purple-300 font-medium mt-0.5">
                {RULE_LABELS[item.ruleId] ?? item.ruleId}
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {item.actionsTaken.map((a) => (
                  <span key={a} className="px-1 py-0.5 rounded bg-gray-700 text-gray-300">
                    {ACTION_SHORT[a] ?? a}
                  </span>
                ))}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
