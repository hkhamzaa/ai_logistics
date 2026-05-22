import { useState } from 'react';
import { LiveMap } from '../components/LiveMap';
import { SimControls } from '../components/SimControls';
import { ActivityFeed } from '../components/ActivityFeed';
import { ApprovalQueue } from '../components/ApprovalQueue';
import { ShipmentPanel } from '../components/ShipmentPanel';
import { useShipments } from '../hooks/useShipments';

type SidebarTab = 'activity' | 'approvals';

export function Dashboard() {
  const { shipments, vehicles, alerts, decisions, isConnected } = useShipments();
  const [tab, setTab] = useState<SidebarTab>('activity');
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  const activeCount    = shipments.filter((s) => s.status === 'enroute').length;
  const highRiskCount  = shipments.filter((s) => s.riskScore >= 80).length;
  const slaBreachCount = shipments.filter(
    (s) => s.currentEta && new Date(s.currentEta) > new Date(s.slaDeadline),
  ).length;

  const selectedShipment = selectedShipmentId
    ? (shipments.find((s) => s.id === selectedShipmentId) ?? null)
    : null;

  function handleVehicleClick(vehicleId: string) {
    const match = shipments.find((s) => s.vehicleId === vehicleId && s.status === 'enroute');
    if (match) setSelectedShipmentId(match.id);
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-gray-100">

      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-brand-500 font-bold text-lg tracking-tight">AI Logistics OS</span>
          <span className="text-xs text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">v5</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-400">
            Active: <span className="text-white font-medium">{activeCount}</span>
          </span>
          <span className="text-gray-400">
            High Risk:{' '}
            <span className={highRiskCount > 0 ? 'text-red-400 font-medium' : 'text-white font-medium'}>
              {highRiskCount}
            </span>
          </span>
          <span className="text-gray-400">
            SLA Breach:{' '}
            <span className={slaBreachCount > 0 ? 'text-red-400 font-medium' : 'text-white font-medium'}>
              {slaBreachCount}
            </span>
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              isConnected ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-500'
            }`}
          >
            {isConnected ? '● Live' : '○ Connecting…'}
          </span>
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Map area — hosts the shipment panel overlay */}
        <div className="flex-1 relative overflow-hidden">
          <LiveMap
            vehicles={vehicles}
            shipments={shipments}
            onVehicleClick={handleVehicleClick}
          />

          {/* Shipment intelligence panel */}
          {selectedShipment && (
            <ShipmentPanel
              shipment={selectedShipment}
              onClose={() => setSelectedShipmentId(null)}
            />
          )}

          {/* Click hint */}
          {!selectedShipment && activeCount > 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none">
              <span className="text-xs text-gray-500 bg-gray-900/80 px-3 py-1.5 rounded-full border border-gray-700">
                Click a vehicle to inspect
              </span>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <aside className="w-80 flex flex-col bg-gray-900 border-l border-gray-800 overflow-hidden">

          {/* Tabs */}
          <div className="flex border-b border-gray-800 shrink-0">
            {(['activity', 'approvals'] as SidebarTab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  tab === t
                    ? 'text-brand-500 border-b-2 border-brand-500 -mb-px'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden p-4 border-b border-gray-800">
            {tab === 'activity' && (
              <ActivityFeed alerts={alerts} decisions={decisions} isConnected={isConnected} />
            )}
            {tab === 'approvals' && <ApprovalQueue />}
          </div>

          {/* Simulation controls — always at the bottom */}
          <div className="flex-1 overflow-y-auto p-4">
            <SimControls shipments={shipments} />
          </div>
        </aside>
      </div>
    </div>
  );
}
