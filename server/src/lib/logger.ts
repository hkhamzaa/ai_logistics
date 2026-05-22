import pino from 'pino';

const isDev = process.env['NODE_ENV'] !== 'production';

export const logger = isDev
  ? pino({
      level: 'debug',
      transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } },
    })
  : pino({ level: 'info' });

export function createChildLogger(name: string) {
  return logger.child({ module: name });
}
