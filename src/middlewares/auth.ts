import { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  // Lewatkan otentikasi untuk public dashboard dan assets
  if (req.path === '/' || req.path.startsWith('/assets') || req.path === '/favicon.ico') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const headerKey = req.headers['x-api-key'];
  const queryKey = req.query.apiKey as string | undefined;

  let providedKey: string | undefined;

  if (headerKey && typeof headerKey === 'string') {
    providedKey = headerKey;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    providedKey = authHeader.substring(7);
  } else if (queryKey) {
    providedKey = queryKey;
  }

  if (!providedKey || providedKey !== config.apiKey) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or missing API Key. Pass via x-api-key header or Bearer token.',
    });
    return;
  }

  next();
}
