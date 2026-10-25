import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { whatsAppCore } from './core/baileys.js';
import { apiKeyAuth } from './middlewares/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import routes from './routes/index.js';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares dasar
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Static dashboard files (kompatibel saat dev maupun dist)
let publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  publicDir = path.join(process.cwd(), 'src', 'public');
}
app.use(express.static(publicDir));

// Route Dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Middleware autentikasi API Key untuk endpoint yang dilindungi
// Catatan: Endpoint status dan QR diizinkan diakses untuk polling dashboard lokal
app.use('/api', (req, res, next) => {
  if (req.path === '/session/status' || req.path === '/session/qr' || req.path === '/health') {
    return next();
  }
  return apiKeyAuth(req, res, next);
});

// Mount routes API
app.use('/api', routes);

// Error handler terpusat
app.use(errorHandler);

// Inisialisasi server & Baileys
const server = app.listen(config.port, async () => {
  logger.info(`===============================================`);
  logger.info(`🚀 TSI WhatsApp Service running on port ${config.port}`);
  logger.info(`🌐 Dashboard: http://localhost:${config.port}`);
  logger.info(`🔑 API Key: ${config.apiKey}`);
  logger.info(`===============================================`);

  // Mulai inisialisasi koneksi Baileys
  await whatsAppCore.init();
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Received termination signal. Closing service gracefully...');
  server.close(async () => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('unhandledRejection', (reason: any) => {
  logger.error({ reason: reason?.message || reason }, 'Unhandled Rejection');
});

process.on('uncaughtException', (err) => {
  logger.error({ error: err.message, stack: err.stack }, 'Uncaught Exception');
});
