import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface WebhookPayload {
  event: 'message.received' | 'message.status' | 'connection.status';
  timestamp: number;
  data: any;
}

export async function sendWebhook(payload: WebhookPayload): Promise<void> {
  if (!config.webhook.url) {
    return;
  }

  try {
    const rawData = JSON.stringify(payload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'TSI-WhatsApp-Service/1.0',
    };

    if (config.webhook.secret) {
      const signature = crypto
        .createHmac('sha256', config.webhook.secret)
        .update(rawData)
        .digest('hex');
      headers['X-Hub-Signature-256'] = signature;
    }

    await axios.post(config.webhook.url, rawData, {
      headers,
      timeout: 5000,
    });
    
    logger.debug({ event: payload.event }, 'Webhook sent successfully');
  } catch (error: any) {
    logger.warn({ error: error.message, url: config.webhook.url }, 'Failed to send webhook notification');
  }
}
