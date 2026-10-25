import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  type WASocket,
  type WAMessage,
  type AnyMessageContent,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { Boom } from '@hapi/boom';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { sendWebhook } from '../services/webhook.js';

export type ConnectionState = 'disconnected' | 'connecting' | 'qr_ready' | 'connected';

export interface WhatsAppSessionState {
  status: ConnectionState;
  qrCode: string | null;
  qrCodeDataUrl: string | null;
  user: { id: string; name?: string } | null;
  lastConnectedAt: string | null;
}

class WhatsAppServiceCore {
  private sock: WASocket | null = null;
  private state: WhatsAppSessionState = {
    status: 'disconnected',
    qrCode: null,
    qrCodeDataUrl: null,
    user: null,
    lastConnectedAt: null,
  };
  private isInitializing = false;
  private reconnectAttempts = 0;
  private maxReconnectDelay = 30000;

  public getState(): WhatsAppSessionState {
    return { ...this.state };
  }

  public getSocket(): WASocket | null {
    return this.sock;
  }

  public isReady(): boolean {
    return this.state.status === 'connected' && this.sock !== null;
  }

  public async init(pairingNumber?: string): Promise<void> {
    if (this.isInitializing) {
      logger.info('WhatsApp service is already initializing...');
      return;
    }

    this.isInitializing = true;
    this.state.status = 'connecting';

    try {
      if (!fs.existsSync(config.sessionDir)) {
        fs.mkdirSync(config.sessionDir, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);
      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info({ version, isLatest }, 'Using Baileys version');

      // Inisialisasi socket
      this.sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        printQRInTerminal: false,
        logger,
        browser: Browsers.macOS('Desktop'),
        generateHighQualityLinkPreview: true,
        syncFullHistory: false,
      });

      // Simpan credentials saat diperbarui
      this.sock.ev.on('creds.update', saveCreds);

      // Tangani status koneksi dan QR code
      this.sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.state.status = 'qr_ready';
          this.state.qrCode = qr;
          try {
            this.state.qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          } catch (err) {
            logger.error({ err }, 'Failed to generate QR data URL');
          }
          logger.info('QR Code generated. Scan to login.');
          
          sendWebhook({
            event: 'connection.status',
            timestamp: Date.now(),
            data: { status: 'qr_ready' },
          });
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          this.state.status = 'disconnected';
          this.state.user = null;
          this.state.qrCode = null;
          this.state.qrCodeDataUrl = null;

          logger.warn({ statusCode, shouldReconnect }, 'Connection closed');

          sendWebhook({
            event: 'connection.status',
            timestamp: Date.now(),
            data: { status: 'disconnected', reason: statusCode },
          });

          if (shouldReconnect) {
            this.scheduleReconnect();
          } else {
            logger.warn('Session logged out. Clearing credentials directory...');
            this.clearSession();
          }
        } else if (connection === 'open') {
          this.reconnectAttempts = 0;
          this.state.status = 'connected';
          this.state.qrCode = null;
          this.state.qrCodeDataUrl = null;
          this.state.lastConnectedAt = new Date().toISOString();

          const user = this.sock?.user;
          this.state.user = user ? { id: user.id, name: user.name } : null;

          logger.info({ user: this.state.user }, 'WhatsApp connection established successfully!');

          sendWebhook({
            event: 'connection.status',
            timestamp: Date.now(),
            data: { status: 'connected', user: this.state.user },
          });
        }
      });

      // Tangani pairing code jika diminta dan belum terotentikasi
      if (pairingNumber && !this.sock.authState.creds.registered) {
        setTimeout(async () => {
          try {
            const code = await this.sock?.requestPairingCode(pairingNumber);
            logger.info({ pairingNumber, code }, 'Pairing code generated');
          } catch (err: any) {
            logger.error({ error: err.message }, 'Failed to request pairing code');
          }
        }, 3000);
      }

      // Tangani pesan masuk (Inbound messages)
      this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (!msg.key.fromMe) {
            this.handleIncomingMessage(msg);
          }
        }
      });

      // Tangani update status pesan (Ack, read receipt)
      this.sock.ev.on('messages.update', async (messageUpdates) => {
        for (const update of messageUpdates) {
          sendWebhook({
            event: 'message.status',
            timestamp: Date.now(),
            data: update,
          });
        }
      });
    } catch (error: any) {
      this.state.status = 'disconnected';
      logger.error({ error: error.message }, 'Error during WhatsApp initialization');
      this.scheduleReconnect();
    } finally {
      this.isInitializing = false;
    }
  }

  private scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectAttempts * 2000, this.maxReconnectDelay);
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms...`);
    setTimeout(() => {
      this.init();
    }, delay);
  }

  public async requestPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) {
      throw new Error('Socket is not initialized');
    }
    if (this.state.status === 'connected') {
      throw new Error('WhatsApp is already connected');
    }
    return await this.sock.requestPairingCode(phoneNumber);
  }

  public async restart(): Promise<void> {
    if (this.sock) {
      try {
        this.sock.end(undefined);
      } catch (err) {
        logger.warn({ err }, 'Error ending socket during restart');
      }
    }
    this.sock = null;
    this.state.status = 'disconnected';
    await this.init();
  }

  public async logout(): Promise<void> {
    if (this.sock) {
      try {
        await this.sock.logout();
      } catch (err) {
        logger.warn({ err }, 'Error during logout');
      }
      this.sock = null;
    }
    this.clearSession();
    this.state.status = 'disconnected';
    this.state.qrCode = null;
    this.state.qrCodeDataUrl = null;
    this.state.user = null;
  }

  public clearSession(): void {
    if (fs.existsSync(config.sessionDir)) {
      try {
        fs.rmSync(config.sessionDir, { recursive: true, force: true });
        logger.info('Session directory cleared successfully.');
      } catch (err: any) {
        logger.error({ error: err.message }, 'Failed to clear session directory');
      }
    }
  }

  private handleIncomingMessage(msg: WAMessage): void {
    const sender = msg.key.remoteJid;
    const pushName = msg.pushName || '';
    const messageContent = msg.message;

    if (!messageContent) return;

    let text =
      messageContent.conversation ||
      messageContent.extendedTextMessage?.text ||
      messageContent.imageMessage?.caption ||
      messageContent.videoMessage?.caption ||
      messageContent.documentMessage?.caption ||
      '';

    const messageType = Object.keys(messageContent)[0];

    logger.info({ sender, pushName, messageType, text }, 'Incoming message received');

    sendWebhook({
      event: 'message.received',
      timestamp: Date.now(),
      data: {
        id: msg.key.id,
        from: sender,
        pushName,
        isGroup: sender?.endsWith('@g.us') || false,
        type: messageType,
        text,
        raw: msg,
      },
    });
  }

  /**
   * Mengirim pesan dengan emulasi kehadiran (typing effect) jika diaktifkan
   */
  public async sendRawMessage(jid: string, content: AnyMessageContent, options?: { delayMs?: number }) {
    if (!this.sock || !this.isReady()) {
      throw new Error('WhatsApp service is not connected');
    }

    // Simulasi typing presence
    if (config.antiBan.enableTypingSimulation) {
      try {
        await this.sock.presenceSubscribe(jid);
        await this.sock.sendPresenceUpdate('composing', jid);
      } catch (err) {
        logger.debug({ err }, 'Failed to send typing presence update');
      }
    }

    const waitTime = options?.delayMs ?? Math.floor(
      Math.random() * (config.antiBan.maxDelayMs - config.antiBan.minDelayMs + 1) + config.antiBan.minDelayMs
    );

    await new Promise((resolve) => setTimeout(resolve, waitTime));

    if (config.antiBan.enableTypingSimulation) {
      try {
        await this.sock.sendPresenceUpdate('paused', jid);
      } catch (err) {
        // ignore
      }
    }

    return await this.sock.sendMessage(jid, content);
  }
}

export const whatsAppCore = new WhatsAppServiceCore();
