import { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('prisma');

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Prisma $on event types collapse to `never` under exactOptionalPropertyTypes
// when no log emitters are defined at the type level — cast to any to wire them.
type PrismaEvent = { message: string };
type AnyPrisma = PrismaClient & {
  $on(event: 'warn' | 'error', cb: (e: PrismaEvent) => void): void;
};

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
  });
  (client as unknown as AnyPrisma).$on('warn', (e) => log.warn(e.message));
  (client as unknown as AnyPrisma).$on('error', (e) => log.error(e.message));
  return client;
}

export const prisma = global.__prisma ?? createPrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}
