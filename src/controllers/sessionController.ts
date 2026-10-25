import { Request, Response, NextFunction } from 'express';
import { whatsAppCore } from '../core/baileys.js';
import { cleanPhoneNumber } from '../utils/phone.js';
import { z } from 'zod';

export class SessionController {
  public static async getStatus(req: Request, res: Response): Promise<void> {
    const state = whatsAppCore.getState();
    res.json({
      success: true,
      data: {
        status: state.status,
        isReady: whatsAppCore.isReady(),
        user: state.user,
        lastConnectedAt: state.lastConnectedAt,
        hasQrCode: state.qrCode !== null,
      },
    });
  }

  public static async getQrCode(req: Request, res: Response): Promise<void> {
    const state = whatsAppCore.getState();
    if (state.status === 'connected') {
      res.json({
        success: false,
        message: 'WhatsApp is already connected. QR Code is not available.',
      });
      return;
    }

    if (!state.qrCode) {
      res.json({
        success: false,
        message: 'QR Code is not ready yet. Please wait or restart the connection.',
      });
      return;
    }

    // Jika diminta format gambar langsung via query ?format=image
    if (req.query.format === 'image' && state.qrCodeDataUrl) {
      const base64Data = state.qrCodeDataUrl.replace(/^data:image\/png;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': imgBuffer.length,
      });
      res.end(imgBuffer);
      return;
    }

    res.json({
      success: true,
      data: {
        qrCode: state.qrCode,
        qrCodeDataUrl: state.qrCodeDataUrl,
      },
    });
  }

  public static async requestPairingCode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const schema = z.object({
        phoneNumber: z.string().min(8, 'Phone number must be at least 8 digits'),
      });

      const { phoneNumber } = schema.parse(req.body);
      const cleaned = cleanPhoneNumber(phoneNumber);

      const code = await whatsAppCore.requestPairingCode(cleaned);

      res.json({
        success: true,
        message: 'Pairing code generated successfully',
        data: {
          phoneNumber: cleaned,
          pairingCode: code,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async restart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await whatsAppCore.restart();
      res.json({
        success: true,
        message: 'WhatsApp service is restarting. Please check QR code or status shortly.',
      });
    } catch (error) {
      next(error);
    }
  }

  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await whatsAppCore.logout();
      res.json({
        success: true,
        message: 'WhatsApp logged out and session cleared successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}
