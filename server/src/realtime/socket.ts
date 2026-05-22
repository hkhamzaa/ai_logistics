import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { createChildLogger } from '../lib/logger';

const log = createChildLogger('socket');

let ioInstance: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    log.debug({ socketId: socket.id }, 'Client connected');
    socket.on('disconnect', () => {
      log.debug({ socketId: socket.id }, 'Client disconnected');
    });
  });

  ioInstance = io;
  log.info('Socket.IO initialised');
  return io;
}

export function getIo(): Server {
  if (!ioInstance) throw new Error('Socket.IO not initialised');
  return ioInstance;
}
