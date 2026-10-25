import { Router } from 'express';
import sessionRoutes from './sessionRoutes.js';
import messageRoutes from './messageRoutes.js';
import { whatsAppCore } from '../core/baileys.js';

const router = Router();

router.get('/health', (req, res) => {
  const state = whatsAppCore.getState();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    whatsapp: {
      connected: whatsAppCore.isReady(),
      status: state.status,
    },
  });
});

router.use('/session', sessionRoutes);
router.use('/messages', messageRoutes);

export default router;
