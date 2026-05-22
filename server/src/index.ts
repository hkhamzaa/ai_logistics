import 'dotenv/config';
import { env } from './config/env';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { initSocket } from './realtime/socket';
import { startSimulation, stopSimulation } from './simulation/engine';
import { startMonitoring, stopMonitoring } from './monitoring/loop';
import { healthRouter } from './routes/health';
import { shipmentsRouter } from './routes/shipments';
import { vehiclesRouter } from './routes/vehicles';
import { customersRouter } from './routes/customers';
import { incidentsRouter } from './routes/incidents';
import { decisionsRouter } from './routes/decisions';
import { approvalsRouter } from './routes/approvals';
import { simulationRouter } from './routes/simulation';
import { createChildLogger } from './lib/logger';

const log = createChildLogger('server');

async function bootstrap() {
  const app = express();

  app.use(cors({ origin: '*' }));
  app.use(express.json({ limit: '1mb' }));

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    }),
  );

  app.use(healthRouter);
  app.use('/api', shipmentsRouter);
  app.use('/api', vehiclesRouter);
  app.use('/api', customersRouter);
  app.use('/api', incidentsRouter);
  app.use('/api', decisionsRouter);
  app.use('/api', approvalsRouter);
  app.use('/api', simulationRouter);

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  const httpServer = createServer(app);
  const io = initSocket(httpServer);

  httpServer.listen(env.PORT, () => {
    log.info({ port: env.PORT, dryRun: env.AGENT_DRY_RUN }, 'Server started');
  });

  await startSimulation(io);
  startMonitoring();

  const shutdown = async () => {
    log.info('Shutting down...');
    stopSimulation();
    stopMonitoring();
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
