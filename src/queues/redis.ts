import { Redis } from 'ioredis';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export const redisConnection = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
  db: config.redis.db,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 1000, 15000);
    logger.warn({ attempt: times, delay }, 'Redis reconnecting...');
    return delay;
  },
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis server successfully');
});

redisConnection.on('error', (err) => {
  logger.error({ error: err.message }, 'Redis connection error');
});
