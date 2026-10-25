import { Router } from 'express';
import { SessionController } from '../controllers/sessionController.js';

const router = Router();

router.get('/status', SessionController.getStatus);
router.get('/qr', SessionController.getQrCode);
router.post('/pairing-code', SessionController.requestPairingCode);
router.post('/restart', SessionController.restart);
router.delete('/logout', SessionController.logout);

export default router;
