import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';

export const DecisionRepository = {
  findByShipment(shipmentId: string) {
    return prisma.decision.findMany({
      where: { shipmentId },
      orderBy: { createdAt: 'desc' },
    });
  },

  findRecent(limit = 50) {
    return prisma.decision.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { shipment: { include: { customer: true } } },
    });
  },

  // Append-only — no update or delete methods exposed.
  create(data: Prisma.DecisionCreateInput) {
    return prisma.decision.create({ data });
  },
};
