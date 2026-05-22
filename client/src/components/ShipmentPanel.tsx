import { useEffect, useState } from 'react';
import type { ShipmentDto, DecisionDto } from '@logistics/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

interface Props {
  shipment: ShipmentDto;
  onClose: () => void;
}

const STATUS_STYLES: Record<string, string> = {
  enroute:   'bg-blue-900 text-blue-300',
  created:   'bg-gray-700 text-gray-300',
  delivered: 'bg-green-900 text-green-300',
  failed:    'bg-red-900 text-red-300',
};

const REFUND_STYLES: Record<string, string> = {
  none:             'bg-gray-800 text-gray-500',
  pending:          'bg-yellow-900 text-yellow-300',
  pending_approval: 'bg-orange-900 text-orange-300',
  approved:         'bg-green-900 text-green-300',
  rejected:         'bg-red-900 text-red-400',
  issued:           'bg-emerald-900 text-emerald-300',
  failed:           'bg-red-900 text-red-400',
};

const ACTION_SHORT: Record<string, string> = {
  reroute:        'Reroute',
  slack_alert:    'Slack',
  slack_escalate: 'Escalate',
  customer_sms:   'SMS',
  issue_refund:   'Refund',
  queue_approval: 'Queue',
};

const RULE_LABELS: Record<string, string> = {
  anomaly_suspected_lost: 'Suspected Lost',
  sla_violated:           'SLA Violated',
  vip_high_risk:          'VIP High Risk',
  high_risk:              'High Risk',
};

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="font-mono text-white">{Math.round(score)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-800">
        <div
          className={`h-1.5 rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
        />
      </div>
    </div>
  );
}

function etaVsSla(sla: string, eta: string | null): { text: string; danger: boolean } {
  if (!eta) return { text: 'ETA unknown', danger: false };
  const diffMs = new Date(sla).getTime() - new Date(eta).getTime();
  const mins = Math.round(Math.abs(diffMs) / 60_000);
  return diffMs >= 0
    ? { text: `${mins}m before SLA`, danger: false }
    : { text: `${mins}m past SLA`, danger: true };
}

export function ShipmentPanel({ shipment, onClose }: Props) {
  const [decisions, setDecisions] = useState<DecisionDto[]>([]);

  useEffect(() => {
    void fetch(`${SERVER_URL}/api/shipments/${shipment.id}/decisions`)
      .then((r) => r.json())
      .then((d: DecisionDto[]) => setDecisions(d.slice(0, 6)))
      .catch(() => undefined);
  }, [shipment.id]);

  const risk      = shipment.riskScore;
  const anomaly   = shipment.anomalyScore;
  const confidence = Math.max(0, 100 - risk);

  const riskColor      = risk >= 80 ? 'bg-red-500' : risk >= 50 ? 'bg-orange-400' : 'bg-green-500';
  const anomalyColor   = anomaly >= 80 ? 'bg-red-500' : anomaly >= 50 ? 'bg-orange-400' : 'bg-sky-400';
  const confidenceColor = confidence >= 70 ? 'bg-green-500' : confidence >= 40 ? 'bg-orange-400' : 'bg-red-500';

  const { text: etaText, danger: etaDanger } = etaVsSla(shipment.slaDeadline, shipment.currentEta);

  return (
    <div className="absolute inset-x-0 bottom-0 z-20 bg-gray-900 border-t border-gray-700 shadow-2xl rounded-t-xl"
         style={{ maxHeight: '52%' }}>

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm text-white">#{shipment.id.slice(-8)}</span>
          {shipment.customer?.isVip && (
            <span className="px-1.5 py-0.5 text-xs rounded bg-purple-900 text-purple-300 font-semibold">VIP</span>
          )}
          <span className={`px-2 py-0.5 text-xs rounded ${STATUS_STYLES[shipment.status] ?? 'bg-gray-700 text-gray-300'}`}>
            {shipment.status}
          </span>
          <span className={`px-2 py-0.5 text-xs rounded ${REFUND_STYLES[shipment.refundStatus ?? 'none']}`}>
            refund: {(shipment.refundStatus ?? 'none').replace('_', ' ')}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-white transition-colors text-2xl leading-none ml-2"
          aria-label="Close panel"
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(52vh - 52px)' }}>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">

          {/* ── Left column ── */}
          <div className="space-y-4">
            {/* Customer */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Customer</p>
              <p className="text-sm text-white font-medium">{shipment.customer?.name ?? '—'}</p>
              {shipment.customer?.isVip && (
                <p className="text-xs text-purple-400 mt-0.5">VIP account</p>
              )}
            </div>

            {/* ETA vs SLA */}
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">ETA vs SLA</p>
              {shipment.currentEta && (
                <p className="text-sm text-white">
                  {new Date(shipment.currentEta).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <p className={`text-xs mt-0.5 font-medium ${etaDanger ? 'text-red-400' : 'text-green-400'}`}>
                {etaText}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                SLA: {new Date(shipment.slaDeadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Vehicle progress */}
            {shipment.vehicle && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Vehicle</p>
                <p className="text-sm text-white">{shipment.vehicle.label}</p>
                <div className="mt-1 h-1 rounded-full bg-gray-800">
                  <div
                    className="h-1 rounded-full bg-brand-500 transition-all duration-500"
                    style={{ width: `${shipment.vehicle.routeProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {shipment.vehicle.routeProgress.toFixed(0)}% complete
                  {shipment.vehicle.speedKph > 0 && ` · ${Math.round(shipment.vehicle.speedKph)} kph`}
                  {shipment.vehicle.speedKph === 0 && ' · stopped'}
                </p>
              </div>
            )}
          </div>

          {/* ── Right column: scores ── */}
          <div className="space-y-3 pt-1">
            <ScoreBar label="Risk Score"           score={risk}       color={riskColor} />
            <ScoreBar label="Anomaly Score"        score={anomaly}    color={anomalyColor} />
            <ScoreBar label="Delivery Confidence"  score={confidence} color={confidenceColor} />
          </div>
        </div>

        {/* ── Recent decisions ── */}
        {decisions.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Recent Decisions</p>
            <div className="space-y-1.5">
              {decisions.map((d) => (
                <div key={d.id} className="flex items-start gap-2 bg-gray-800 rounded px-2 py-1.5 text-xs">
                  <span className="font-mono text-gray-500 shrink-0 tabular-nums">
                    {new Date(d.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="text-purple-300 font-medium shrink-0">
                    {RULE_LABELS[d.ruleId] ?? d.ruleId}
                  </span>
                  <div className="flex flex-wrap gap-1 ml-auto">
                    {d.actionsTaken.map((a) => (
                      <span key={a} className="px-1 py-0.5 rounded bg-gray-700 text-gray-300">
                        {ACTION_SHORT[a] ?? a}
                      </span>
                    ))}
                    {d.dryRun && (
                      <span className="px-1 py-0.5 rounded bg-blue-900 text-blue-400">DRY</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
