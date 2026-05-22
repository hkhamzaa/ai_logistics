import { useState } from 'react';
import type { ShipmentDto } from '@logistics/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

type IncidentType = 'traffic' | 'delay' | 'lost';

interface Props {
  shipments: ShipmentDto[];
}

const INCIDENT_BUTTONS: { type: IncidentType; label: string; color: string }[] = [
  { type: 'traffic', label: 'Simulate Traffic', color: 'bg-amber-600 hover:bg-amber-500' },
  { type: 'delay', label: 'Simulate Delay', color: 'bg-orange-600 hover:bg-orange-500' },
  { type: 'lost', label: 'Simulate Lost', color: 'bg-red-700 hover:bg-red-600' },
];

function riskBadge(score: number) {
  if (score >= 80) return <span className="px-1.5 py-0.5 text-xs rounded bg-red-900 text-red-300">{score}</span>;
  if (score >= 50) return <span className="px-1.5 py-0.5 text-xs rounded bg-orange-900 text-orange-300">{score}</span>;
  return <span className="px-1.5 py-0.5 text-xs rounded bg-green-900 text-green-300">{score}</span>;
}

export function SimControls({ shipments }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const active = shipments.filter((s) => s.status === 'enroute');

  async function inject(shipmentId: string, type: IncidentType) {
    const key = `${shipmentId}-${type}`;
    setBusy(key);
    setLastResult(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/simulate/inject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentId, type, severity: 'high' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLastResult(`✓ ${type} injected`);
    } catch (err) {
      setLastResult(`✗ ${String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
        Incident Simulator
      </h2>

      {active.length === 0 && (
        <p className="text-sm text-gray-500">No active shipments enroute</p>
      )}

      <div className="flex flex-col gap-4">
        {active.map((s) => (
          <div key={s.id} className="rounded-lg bg-gray-800 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-gray-300">
                {s.id.slice(-8)}
              </span>
              <div className="flex gap-1.5 items-center">
                {s.customer?.isVip && (
                  <span className="px-1.5 py-0.5 text-xs rounded bg-purple-900 text-purple-300">VIP</span>
                )}
                <span className="text-xs text-gray-400">risk</span>
                {riskBadge(Math.round(s.riskScore))}
              </div>
            </div>

            <p className="text-xs text-gray-400 truncate">{s.customer?.name}</p>

            <div className="grid grid-cols-3 gap-1.5">
              {INCIDENT_BUTTONS.map(({ type, label, color }) => (
                <button
                  key={type}
                  className={`text-xs py-1.5 rounded text-white font-medium transition-colors ${color} disabled:opacity-40`}
                  disabled={busy === `${s.id}-${type}`}
                  onClick={() => inject(s.id, type)}
                >
                  {busy === `${s.id}-${type}` ? '...' : label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {lastResult && (
        <p className="text-xs text-gray-400 mt-1">{lastResult}</p>
      )}
    </div>
  );
}
