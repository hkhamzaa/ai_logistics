import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';

export const incidentsRouter: IRouter = Router();

incidentsRouter.get('/incidents', async (_req: Request, res: Response) => {
  const incidents = await prisma.incident.findMany({
    orderBy: { detectedAt: 'desc' },
    take: 100,
    include: { shipment: { include: { customer: true } } },
  });
  res.json(incidents);
});

const createIncidentSchema = z.object({
  shipmentId: z.string().cuid(),
  type: z.enum(['traffic', 'delay', 'lost']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
});

incidentsRouter.post('/incidents', async (req: Request, res: Response) => {
  const result = createIncidentSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }
  const incident = await prisma.incident.create({
    data: result.data,
    include: { shipment: { include: { customer: true } } },
  });
  res.status(201).json(incident);
});

incidentsRouter.patch('/incidents/:id/resolve', async (req: Request, res: Response) => {
  const incident = await prisma.incident.findUnique({ where: { id: req.params['id'] ?? '' } });
  if (!incident) {
    res.status(404).json({ error: 'Incident not found' });
    return;
  }
  const resolved = await prisma.incident.update({
    where: { id: incident.id },
    data: { resolvedAt: new Date() },
  });
  res.json(resolved);
});
