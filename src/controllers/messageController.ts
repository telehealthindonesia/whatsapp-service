import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { formatToWhatsAppJid } from '../utils/phone.js';
import { messageQueue } from '../queues/messageQueue.js';
import { whatsAppCore } from '../core/baileys.js';

export class MessageController {
  public static async sendText(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        to: z.string().min(5, 'Recipient phone number or JID is required'),
        message: z.string().min(1, 'Message text cannot be empty'),
        delayMs: z.number().optional(),
        immediate: z.boolean().optional(),
      });

      const body = schema.parse(req.body);
      const jid = formatToWhatsAppJid(body.to);

      if (body.immediate) {
        if (!whatsAppCore.isReady()) {
          res.status(503).json({ success: false, message: 'WhatsApp client is not ready' });
          return;
        }
        const sent = await whatsAppCore.sendRawMessage(jid, { text: body.message }, { delayMs: body.delayMs });
        res.json({ success: true, message: 'Message sent immediately', data: sent });
        return;
      }

      const job = await messageQueue.add('send-text', {
        type: 'text',
        to: jid,
        text: body.message,
        delayMs: body.delayMs,
      });

      res.json({
        success: true,
        message: 'Message queued successfully',
        data: {
          jobId: job.id,
          to: jid,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async sendMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        to: z.string().min(5, 'Recipient phone number or JID is required'),
        type: z.enum(['image', 'document', 'video', 'audio']).default('image'),
        mediaUrl: z.string().url().optional(),
        caption: z.string().optional(),
        filename: z.string().optional(),
        mimetype: z.string().optional(),
        delayMs: z.number().optional(),
      });

      const body = schema.parse(req.body);
      const jid = formatToWhatsAppJid(body.to);
      const uploadedFile = req.file;

      if (!body.mediaUrl && !uploadedFile) {
        res.status(400).json({
          success: false,
          message: 'Either mediaUrl or an uploaded file is required',
        });
        return;
      }

      const job = await messageQueue.add('send-media', {
        type: body.type,
        to: jid,
        mediaUrl: body.mediaUrl,
        mediaPath: uploadedFile?.path,
        caption: body.caption,
        filename: body.filename || uploadedFile?.originalname,
        mimetype: body.mimetype || uploadedFile?.mimetype,
        delayMs: body.delayMs,
      });

      res.json({
        success: true,
        message: 'Media message queued successfully',
        data: {
          jobId: job.id,
          to: jid,
          type: body.type,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async sendLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        to: z.string().min(5, 'Recipient phone number or JID is required'),
        latitude: z.number(),
        longitude: z.number(),
        name: z.string().optional(),
        address: z.string().optional(),
        delayMs: z.number().optional(),
      });

      const body = schema.parse(req.body);
      const jid = formatToWhatsAppJid(body.to);

      const job = await messageQueue.add('send-location', {
        type: 'location',
        to: jid,
        location: {
          latitude: body.latitude,
          longitude: body.longitude,
          name: body.name,
          address: body.address,
        },
        delayMs: body.delayMs,
      });

      res.json({
        success: true,
        message: 'Location message queued successfully',
        data: {
          jobId: job.id,
          to: jid,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getQueueStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const counts = await messageQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed');
      res.json({
        success: true,
        data: counts,
      });
    } catch (error) {
      next(error);
    }
  }
}
