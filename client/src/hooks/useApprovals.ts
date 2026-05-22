import { useState, useEffect, useCallback } from 'react';
import type { CustomerDto } from '@logistics/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export interface ApprovalItem {
  id: string;
  customer: CustomerDto;
  refundStatus: string;
  anomalyScore: number;
  riskScore: number;
  slaDeadline: string;
  status: string;
}

export function useApprovals() {
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/approvals`);
      setItems((await res.json()) as ApprovalItem[]);
    } catch {
      // server may be unreachable
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
    const id = setInterval(() => void refetch(), 15_000);
    return () => clearInterval(id);
  }, [refetch]);

  const act = useCallback(
    async (shipmentId: string, action: 'approve' | 'reject') => {
      await fetch(`${SERVER_URL}/api/approvals/${shipmentId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await refetch();
    },
    [refetch],
  );

  return {
    items,
    loading,
    approve: (id: string) => act(id, 'approve'),
    reject: (id: string) => act(id, 'reject'),
    refetch,
  };
}
