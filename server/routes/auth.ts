import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { query, queryOne } from '../db/connection.js';
import { config } from '../config.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

function generateId(): string { return crypto.randomUUID(); }

async function createTokens(user: any) {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role, country: user.country },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
  const refreshToken = crypto.randomBytes(32).toString('hex');

  await query('DELETE FROM sessions WHERE user_id = $1 AND expires_at < $2', [user.id, Date.now()]);
  await query('INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES ($1, $2, $3, $4, $5)',
    [generateId(), user.id, refreshToken, Date.now() + config.refreshTokenExpiresIn, Date.now()]);

  return { accessToken, refreshToken };
}

router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, country, company, position } = req.body;
  if (!email || !password || !name) { res.status(400).json({ error: 'email, password, name required' }); return; }
  if (password.length < 6) { res.status(400).json({ error: 'Password min 6 chars' }); return; }

  const existing = await queryOne('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (existing) { res.status(409).json({ error: 'USER_EXISTS' }); return; }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = { id: generateId(), email: email.toLowerCase().trim(), name: name.trim(), password_hash: passwordHash, company: company?.trim() || null, position: position?.trim() || null, country: country || 'belarus', role: 'user', created_at: Date.now(), last_login: Date.now() };

  await query('INSERT INTO users (id, email, name, password_hash, company, position, country, role, created_at, last_login) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [user.id, user.email, user.name, user.password_hash, user.company, user.position, user.country, user.role, user.created_at, user.last_login]);

  const tokens = await createTokens(user);
  res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, country: user.country, company: user.company, position: user.position, role: user.role }, ...tokens });
});

router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: 'email and password required' }); return; }

  const user = await queryOne('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  if (!user) { res.status(401).json({ error: 'USER_NOT_FOUND' }); return; }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) { res.status(401).json({ error: 'INVALID_PASSWORD' }); return; }

  await query('UPDATE users SET last_login = $1 WHERE id = $2', [Date.now(), user.id]);
  const tokens = await createTokens(user);
  res.json({ user: { id: user.id, email: user.email, name: user.name, country: user.country, company: user.company, position: user.position, role: user.role }, ...tokens });
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const user = await queryOne('SELECT id, email, name, country, company, position, role FROM users WHERE id = $1', [req.user!.userId]);
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }
  res.json({ user });
});

router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (!refreshToken) { res.status(400).json({ error: 'refreshToken required' }); return; }

  const session = await queryOne('SELECT * FROM sessions WHERE refresh_token = $1', [refreshToken]);
  if (!session || session.expires_at < Date.now()) { res.status(401).json({ error: 'Invalid refresh token' }); return; }

  const user = await queryOne('SELECT * FROM users WHERE id = $1', [session.user_id]);
  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  await query('DELETE FROM sessions WHERE id = $1', [session.id]);
  const tokens = await createTokens(user);
  res.json(tokens);
});

router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  await query('DELETE FROM sessions WHERE user_id = $1', [req.user!.userId]);
  res.json({ ok: true });
});

export default router;
