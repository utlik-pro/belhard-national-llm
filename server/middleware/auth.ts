import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  country: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwtSecret) as JWTPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}
