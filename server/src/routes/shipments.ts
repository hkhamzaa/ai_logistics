import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';
import { ShipmentRepository } from '../models/shipment.repository';

export const shipmentsRouter: IRouter = Router();

shipmentsRouter.get('/shipments', async (_req: Request, res: Response) => {
  const shipments = await ShipmentRepository.findAll();
  res.json(shipments);
});

shipmentsRouter.get('/shipments/active', async (_req: Request, res: Response) => {
  const shipments = await ShipmentRepository.findActive();
  res.json(shipments);
});

shipmentsRouter.get('/shipments/:id', async (req: Request, res: Response) => {
  const shipment = await ShipmentRepository.findById(req.params['id'] ?? '');
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }
  res.json(shipment);
});

const createShipmentSchema = z.object({
  customerId: z.string().cuid(),
  vehicleId: z.string().cuid().optional(),
  originLat: z.number(),
  originLng: z.number(),
  destLat: z.number(),
  destLng: z.number(),
  slaDeadline: z.string().datetime(),
  declaredValue: z.number().positive().default(100),
});

shipmentsRouter.post('/shipments', async (req: Request, res: Response) => {
  const result = createShipmentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const { slaDeadline, vehicleId, ...rest } = result.data;
  const shipment = await prisma.shipment.create({
    data: { ...rest, slaDeadline: new Date(slaDeadline), vehicleId: vehicleId ?? null },
    include: { customer: true, vehicle: true },
  });
  res.status(201).json(shipment);
});

shipmentsRouter.get('/shipments/:id/incidents', async (req: Request, res: Response) => {
  const incidents = await prisma.incident.findMany({
    where: { shipmentId: req.params['id'] ?? '' },
    orderBy: { detectedAt: 'desc' },
  });
  res.json(incidents);
});

shipmentsRouter.get('/shipments/:id/decisions', async (req: Request, res: Response) => {
  const decisions = await prisma.decision.findMany({
    where: { shipmentId: req.params['id'] ?? '' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(decisions);
});

shipmentsRouter.get('/shipments/:id/payments', async (req: Request, res: Response) => {
  const payments = await prisma.payment.findMany({
    where: { shipmentId: req.params['id'] ?? '' },
    orderBy: { createdAt: 'desc' },
  });
  res.json(payments);
});
