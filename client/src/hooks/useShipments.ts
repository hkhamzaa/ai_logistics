import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import type { ShipmentDto, VehicleDto, DecisionDto, SystemAlertEvent } from '@logistics/shared';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export interface AlertMessage {
  id: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}

export function useShipments() {
  const [shipments, setShipments] = useState<ShipmentDto[]>([]);
  const [vehicles, setVehicles] = useState<VehicleDto[]>([]);
  const [decisions, setDecisions] = useState<DecisionDto[]>([]);
  const [alerts, setAlerts] = useState<AlertMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Initial data fetch
  useEffect(() => {
    async function load() {
      try {
        const [sRes, vRes] = await Promise.all([
          fetch(`${SERVER_URL}/api/shipments`),
          fetch(`${SERVER_URL}/api/vehicles`),
        ]);
        const [s, v] = await Promise.all([sRes.json(), vRes.json()]);
        setShipments(s as ShipmentDto[]);
        setVehicles(v as VehicleDto[]);
      } catch {
        // server may not be reachable yet — socket will sync state when ready
      }
    }
    void load();
  }, []);

  // Socket.IO subscriptions
  useEffect(() => {
    const socket = io(SERVER_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => setIsConnected(false));

    socket.on('vehicle:position', (data: {
      vehicleId: string; lat: number; lng: number;
      speedKph: number; routeProgress: number; status: string;
    }) => {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === data.vehicleId
            ? { ...v, currentLat: data.lat, currentLng: data.lng, speedKph: data.speedKph, routeProgress: data.routeProgress, status: data.status as VehicleDto['status'] }
            : v,
        ),
      );
    });

    socket.on('shipment:update', ({ shipment }: { shipment: ShipmentDto }) => {
      setShipments((prev) => {
        const idx = prev.findIndex((s) => s.id === shipment.id);
        if (idx === -1) return [...prev, shipment];
        const next = [...prev];
        next[idx] = shipment;
        return next;
      });
    });

    socket.on('decision:new', ({ decision }: { decision: DecisionDto }) => {
      setDecisions((prev) => [decision, ...prev].slice(0, 100));
    });

    socket.on('system:alert', (alert: SystemAlertEvent) => {
      const id = `${Date.now()}-${Math.random()}`;
      setAlerts((prev) => [{ id, ...alert }, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return { shipments, vehicles, decisions, alerts, isConnected, socket: socketRef.current };
}
