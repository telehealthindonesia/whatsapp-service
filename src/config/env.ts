import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: process.env.API_KEY || 'secret_api_key_whatsapp_tsi',
  sessionDir: path.resolve(process.env.SESSION_DIR || './sessions'),
  
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  webhook: {
    url: process.env.WEBHOOK_URL || '',
    secret: process.env.WEBHOOK_SECRET || '',
  },

  antiBan: {
    minDelayMs: parseInt(process.env.MIN_MESSAGE_DELAY_MS || '2000', 10),
    maxDelayMs: parseInt(process.env.MAX_MESSAGE_DELAY_MS || '4000', 10),
    enableTypingSimulation: process.env.ENABLE_TYPING_SIMULATION !== 'false',
  },
};
