import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

const baseLogger = isProduction
  ? pino({
      level: process.env.LOG_LEVEL ?? 'info',
    })
  : pino({
      level: process.env.LOG_LEVEL ?? 'debug',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    });

export function createLogger(name: string) {
  return baseLogger.child({ module: name });
}

export { baseLogger as logger };
