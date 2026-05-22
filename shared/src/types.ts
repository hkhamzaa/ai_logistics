import {
  VehicleStatus,
  ShipmentStatus,
  IncidentType,
  IncidentSeverity,
  RefundStatus,
} from './enums';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface CustomerDto {
  id: string;
  name: string;
  phone: string;
  email: string;
  isVip: boolean;
}

export interface VehicleDto {
  id: string;
  label: string;
  status: VehicleStatus;
  currentLat: number;
  currentLng: number;
  speedKph: number;
  routeProgress: number;
  waypoints: LatLng[];
}

export interface ShipmentDto {
  id: string;
  customerId: string;
  vehicleId: string | null;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  status: ShipmentStatus;
  createdAt: string;
  slaDeadline: string;
  currentEta: string | null;
  riskScore: number;
  anomalyScore: number;
  refundStatus: RefundStatus;
  customer?: CustomerDto;
  vehicle?: VehicleDto;
}

export interface IncidentDto {
  id: string;
  shipmentId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface DecisionDto {
  id: string;
  shipmentId: string;
  createdAt: string;
  trigger: string;
  ruleId: string;
  actionsTaken: string[];
  dryRun: boolean;
}

export interface ApprovalQueueItemDto {
  id: string;
  shipmentId: string;
  reason: string;
  amount: number;
  currency: string;
  createdAt: string;
  customer?: CustomerDto;
}

// Socket.IO event payloads
export interface VehiclePositionEvent {
  vehicleId: string;
  lat: number;
  lng: number;
  speedKph: number;
  routeProgress: number;
  status: VehicleStatus;
}

export interface ShipmentUpdateEvent {
  shipment: ShipmentDto;
}

export interface DecisionEvent {
  decision: DecisionDto;
}

export interface IncidentEvent {
  incident: IncidentDto;
}

export interface SystemAlertEvent {
  level: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
}
