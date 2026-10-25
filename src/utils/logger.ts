import pino from 'pino';
import { config } from '../config/env.js';

export const logger = pino({
  level: config.nodeEnv === 'development' ? 'info' : 'warn',
  transport:
    config.nodeEnv === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
