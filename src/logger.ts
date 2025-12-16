import pino from 'pino';

const isDev = process.env.NODE_ENV !== 'production';

// Always log to stderr so stdio transport output stays clean
const destination = isDev
  ? pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        destination: 2,
      },
    })
  : pino.destination({ dest: 2 });

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
    base: { service: 'gcnv-mcp' },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: ['request.auth', 'request.token', 'headers.authorization'],
  },
  destination
);
