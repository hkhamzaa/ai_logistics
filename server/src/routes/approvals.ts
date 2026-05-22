import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';

export const approvalsRouter: IRouter = Router();

// Returns shipments in the human-approval queue:
// refundStatus=pending_approval OR anomalyScore > 80
approvalsRouter.get('/approvals', async (_req: Request, res: Response) => {
  const items = await prisma.shipment.findMany({
    where: {
      OR: [
        { refundStatus: 'pending_approval' },
        { anomalyScore: { gte: 80 }, status: { in: ['enroute', 'created'] } },
      ],
    },
    include: { customer: true, vehicle: true, incidents: { where: { resolvedAt: null } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(items);
});

const approvalActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string().optional(),
});

approvalsRouter.post('/approvals/:shipmentId', async (req: Request, res: Response) => {
  const result = approvalActionSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id: req.params['shipmentId'] ?? '' },
  });
  if (!shipment) {
    res.status(404).json({ error: 'Shipment not found' });
    return;
  }

  const { action } = result.data;
  const updated = await prisma.shipment.update({
    where: { id: shipment.id },
    data: { refundStatus: action === 'approve' ? 'approved' : 'rejected' },
    include: { customer: true },
  });

  res.json({ shipment: updated, action });
});
