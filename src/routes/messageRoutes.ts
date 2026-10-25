import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { MessageController } from '../controllers/messageController.js';

const uploadDir = path.resolve('./uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 30 * 1024 * 1024 }, // Limit 30 MB
});

const router = Router();

router.post('/send-text', MessageController.sendText);
router.post('/send-media', upload.single('file'), MessageController.sendMedia);
router.post('/send-location', MessageController.sendLocation);
router.get('/queue-status', MessageController.getQueueStatus);

export default router;
