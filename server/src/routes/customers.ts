import { Router, type IRouter, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/client';

export const customersRouter: IRouter = Router();

customersRouter.get('/customers', async (_req: Request, res: Response) => {
  const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
  res.json(customers);
});

customersRouter.get('/customers/:id', async (req: Request, res: Response) => {
  const customer = await prisma.customer.findUnique({
    where: { id: req.params['id'] ?? '' },
    include: { shipments: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
  if (!customer) {
    res.status(404).json({ error: 'Customer not found' });
    return;
  }
  res.json(customer);
});

const createCustomerSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email(),
  isVip: z.boolean().default(false),
  paypalCaptureId: z.string().optional(),
});

customersRouter.post('/customers', async (req: Request, res: Response) => {
  const result = createCustomerSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten() });
    return;
  }
  const { paypalCaptureId, ...rest } = result.data;
  const customer = await prisma.customer.create({
    data: { ...rest, paypalCaptureId: paypalCaptureId ?? null },
  });
  res.status(201).json(customer);
});
