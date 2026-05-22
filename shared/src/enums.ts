export enum VehicleStatus {
  Idle = 'idle',
  Enroute = 'enroute',
  Stopped = 'stopped',
}

export enum ShipmentStatus {
  Created = 'created',
  Enroute = 'enroute',
  Delivered = 'delivered',
  Failed = 'failed',
}

export enum IncidentType {
  Traffic = 'traffic',
  Delay = 'delay',
  Lost = 'lost',
}

export enum IncidentSeverity {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

export enum RefundStatus {
  None = 'none',
  Pending = 'pending',
  PendingApproval = 'pending_approval',
  Approved = 'approved',
  Rejected = 'rejected',
  Issued = 'issued',
  Failed = 'failed',
}

export enum PaymentKind {
  Payment = 'payment',
  Refund = 'refund',
}

export enum PaymentStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
  Skipped = 'skipped',
}
