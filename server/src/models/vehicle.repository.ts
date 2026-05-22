import { prisma } from '../db/client';
import type { Prisma } from '@prisma/client';

export const VehicleRepository = {
  findAll() {
    return prisma.vehicle.findMany({ orderBy: { label: 'asc' } });
  },

  findById(id: string) {
    return prisma.vehicle.findUnique({ where: { id } });
  },

  update(id: string, data: Prisma.VehicleUpdateInput) {
    return prisma.vehicle.update({ where: { id }, data });
  },
};
