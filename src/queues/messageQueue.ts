import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from './redis.js';
import { whatsAppCore } from '../core/baileys.js';
import { logger } from '../utils/logger.js';
import axios from 'axios';
import fs from 'fs';

export type MessageJobType = 'text' | 'image' | 'document' | 'video' | 'audio' | 'location';

export interface MessageJobData {
  type: MessageJobType;
  to: string; // JID or normalized phone number
  text?: string;
  mediaUrl?: string;
  mediaPath?: string;
  caption?: string;
  filename?: string;
  mimetype?: string;
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  delayMs?: number;
}

export const messageQueue = new Queue<MessageJobData>('whatsapp-messages', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 500, // Simpan 500 riwayat pesan sukses terakhir
    },
    removeOnFail: {
      count: 500, // Simpan 500 riwayat pesan gagal terakhir
    },
  },
});

export const messageWorker = new Worker<MessageJobData>(
  'whatsapp-messages',
  async (job: Job<MessageJobData>) => {
    logger.info({ jobId: job.id, type: job.data.type, to: job.data.to }, 'Processing queued WhatsApp message');

    if (!whatsAppCore.isReady()) {
      throw new Error('WhatsApp client is not ready. Message will be retried.');
    }

    const { type, to, delayMs } = job.data;

    switch (type) {
      case 'text': {
        if (!job.data.text) throw new Error('Text message content is required');
        return await whatsAppCore.sendRawMessage(to, { text: job.data.text }, { delayMs });
      }

      case 'image': {
        let mediaBuffer: Buffer;
        if (job.data.mediaUrl) {
          const res = await axios.get(job.data.mediaUrl, { responseType: 'arraybuffer' });
          mediaBuffer = Buffer.from(res.data);
        } else if (job.data.mediaPath && fs.existsSync(job.data.mediaPath)) {
          mediaBuffer = fs.readFileSync(job.data.mediaPath);
        } else {
          throw new Error('No valid image media URL or path provided');
        }

        return await whatsAppCore.sendRawMessage(
          to,
          {
            image: mediaBuffer,
            caption: job.data.caption || '',
          },
          { delayMs }
        );
      }

      case 'document': {
        let mediaBuffer: Buffer;
        if (job.data.mediaUrl) {
          const res = await axios.get(job.data.mediaUrl, { responseType: 'arraybuffer' });
          mediaBuffer = Buffer.from(res.data);
        } else if (job.data.mediaPath && fs.existsSync(job.data.mediaPath)) {
          mediaBuffer = fs.readFileSync(job.data.mediaPath);
        } else {
          throw new Error('No valid document media URL or path provided');
        }

        return await whatsAppCore.sendRawMessage(
          to,
          {
            document: mediaBuffer,
            fileName: job.data.filename || 'document.pdf',
            mimetype: job.data.mimetype || 'application/pdf',
            caption: job.data.caption || '',
          },
          { delayMs }
        );
      }

      case 'location': {
        if (!job.data.location) throw new Error('Location coordinates are required');
        return await whatsAppCore.sendRawMessage(
          to,
          {
            location: {
              degreesLatitude: job.data.location.latitude,
              degreesLongitude: job.data.location.longitude,
              name: job.data.location.name,
              address: job.data.location.address,
            },
          },
          { delayMs }
        );
      }

      default:
        throw new Error(`Unsupported message job type: ${type}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 1, // Memproses 1 per 1 agar teratur dan aman dari banned
  }
);

messageWorker.on('completed', (job) => {
  logger.info({ jobId: job.id, to: job.data.to }, 'Message job completed successfully');
});

messageWorker.on('failed', (job, err) => {
  logger.error({ jobId: job?.id, error: err.message }, 'Message job failed');
});
