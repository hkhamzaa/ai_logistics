import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { getIo } from '../realtime/socket';
import { ensureVehicleRoute } from '../simulation/routes';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('sim-routes');

export const simulationRouter: IRouter = Router();

const injectSchema = z.object({
  shipmentId: z.string().cuid(),
  type: z.enum(['traffic', 'delay', 'lost']),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
});

simulationRouter.post('/simulate/inject', async (req: Request, res: Response) => {
  const result = injectSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { shipmentId, type, severity } = result.data;
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: { vehicle: true },
  });

  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }

  const incident = await prisma.incident.create({
    data: { shipmentId, type, severity },
    include: { shipment: { include: { customer: true } } },
  });

  // Adjust risk/anomaly scores immediately
  const riskDelta: Record<string, number> = { traffic: 20, delay: 35, lost: 0 };
  const anomalyDelta: Record<string, number> = { traffic: 5, delay: 15, lost: 40 };

  const updatedShipment = await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      riskScore: Math.min(100, shipment.riskScore + (riskDelta[type] ?? 0)),
      anomalyScore: Math.min(100, shipment.anomalyScore + (anomalyDelta[type] ?? 0)),
      ...(type === 'lost' ? { refundStatus: 'none' } : {}),
    },
    include: { customer: true, vehicle: true },
  });

  // Ensure route is loaded for this vehicle if newly assigned
  if (shipment.vehicle && shipment.status !== 'delivered') {
    await ensureVehicleRoute(
      shipment as typeof shipment & { vehicle: NonNullable<typeof shipment.vehicle> },
    );
  }

  const io = getIo();
  io.emit('incident:new', { incident });
  io.emit('shipment:update', { shipment: updatedShipment });
  io.emit('system:alert', {
    level: type === 'lost' ? 'error' : 'warn',
    message: `[SIM] ${type.toUpperCase()} incident injected on shipment ${shipmentId.slice(-6)} (severity: ${severity})`,
    timestamp: new Date().toISOString(),
  });

  log.info({ shipmentId, type, severity }, 'Incident injected');
  res.status(201).json({ incident, shipment: updatedShipment });
});

simulationRouter.delete('/simulate/incidents/:id', async (req: Request, res: Response) => {
  const incident = await prisma.incident.findUnique({ where: { id: req.params['id'] ?? '' } });
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }

  const resolved = await prisma.incident.update({
    where: { id: incident.id },
    data: { resolvedAt: new Date() },
  });

  const io = getIo();
  io.emit('system:alert', {
    level: 'info',
    message: `Incident ${incident.type} resolved on shipment ${incident.shipmentId.slice(-6)}`,
    timestamp: new Date().toISOString(),
  });

  res.json(resolved);
});
