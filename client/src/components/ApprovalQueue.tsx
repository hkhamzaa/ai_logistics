import { useState } from 'react';
import { useApprovals } from '../hooks/useApprovals';

export function ApprovalQueue() {
  const { items, loading, approve, reject } = useApprovals();
  const [busy, setBusy] = useState<string | null>(null);

  async function handle(id: string, action: 'approve' | 'reject') {
    setBusy(id);
    if (action === 'approve') await approve(id);
    else await reject(id);
    setBusy(null);
  }

  if (loading && items.length === 0) {
    return <p className="text-sm text-gray-500 animate-pulse">Loading...</p>;
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Approval Queue</h2>
          <span className="text-xs bg-gray-800 text-gray-500 rounded-full px-2 py-0.5">0</span>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-gray-600">
          <span className="text-3xl">✓</span>
          <p className="text-sm">Queue is empty</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-full">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Approval Queue</h2>
        <span className="text-xs bg-orange-900 text-orange-300 rounded-full px-2 py-0.5">{items.length}</span>
      </div>

      <div className="overflow-y-auto space-y-2 flex-1 pr-1">
        {items.map((item) => {
          const isLost = item.anomalyScore >= 80;
          const isBusy = busy === item.id;
          return (
            <div key={item.id} className="bg-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs text-gray-300">#{item.id.slice(-8)}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${isLost ? 'bg-red-900 text-red-300' : 'bg-orange-900 text-orange-300'}`}>
                  {isLost ? `anomaly ${Math.round(item.anomalyScore)}%` : `risk ${Math.round(item.riskScore)}%`}
                </span>
              </div>

              <p className="text-xs text-gray-300 font-medium">
                {item.customer?.name ?? '—'}
                {item.customer?.isVip && (
                  <span className="ml-1.5 px-1 py-0.5 text-xs rounded bg-purple-900 text-purple-300">VIP</span>
                )}
              </p>

              <p className="text-xs text-gray-500">
                {item.refundStatus === 'pending_approval'
                  ? 'Awaiting refund approval'
                  : 'Flagged for human review'}
              </p>

              <div className="flex gap-1.5">
                <button
                  className="flex-1 text-xs py-1.5 rounded bg-green-800 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-40"
                  disabled={isBusy}
                  onClick={() => void handle(item.id, 'approve')}
                >
                  {isBusy ? '…' : 'Approve'}
                </button>
                <button
                  className="flex-1 text-xs py-1.5 rounded bg-red-900 hover:bg-red-800 text-white font-medium transition-colors disabled:opacity-40"
                  disabled={isBusy}
                  onClick={() => void handle(item.id, 'reject')}
                >
                  {isBusy ? '…' : 'Reject'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
