import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';

export const shipmentInclude = {
  customer: true,
  vehicle: true,
} satisfies Prisma.ShipmentInclude;

export type ShipmentWithRelations = Prisma.ShipmentGetPayload<{
  include: typeof shipmentInclude;
}>;

export const ShipmentRepository = {
  findAll(): Promise<ShipmentWithRelations[]> {
    return prisma.shipment.findMany({
      include: shipmentInclude,
      orderBy: { createdAt: 'desc' },
    });
  },

  findById(id: string): Promise<ShipmentWithRelations | null> {
    return prisma.shipment.findUnique({ where: { id }, include: shipmentInclude });
  },

  findActive(): Promise<ShipmentWithRelations[]> {
    return prisma.shipment.findMany({
      where: { status: { in: ['enroute', 'created'] } },
      include: shipmentInclude,
    });
  },

  update(id: string, data: Prisma.ShipmentUpdateInput): Promise<ShipmentWithRelations> {
    return prisma.shipment.update({ where: { id }, data, include: shipmentInclude });
  },
};
