import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, queryAll } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req: Request, res: Response) => {
  const chats = await queryAll(
    'SELECT id, title, preview, department, country, archived, created_at, last_updated FROM chats WHERE user_id = $1 ORDER BY last_updated DESC',
    [req.user!.userId]
  );
  res.json(chats);
});

router.post('/', async (req: Request, res: Response) => {
  const { title, department, country } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  await query(
    'INSERT INTO chats (id, user_id, title, preview, department, country, created_at, last_updated) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, req.user!.userId, title || 'Новый чат', '', department || 'general', country || req.user!.country, now, now]
  );
  res.status(201).json({ id, title: title || 'Новый чат', department: department || 'general', country: country || req.user!.country, created_at: now, last_updated: now });
});

router.get('/:id', async (req: Request, res: Response) => {
  const chat = await queryOne('SELECT * FROM chats WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
  if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }

  const messages = await queryAll('SELECT * FROM messages WHERE chat_id = $1 ORDER BY created_at ASC', [req.params.id]);
  const parsed = messages.map((m: any) => ({ ...m, sources: m.sources_json ? JSON.parse(m.sources_json) : [], sources_json: undefined }));
  res.json({ ...chat, messages: parsed });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const chat = await queryOne('SELECT id FROM chats WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
  if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }

  const { title, archived } = req.body;
  if (title !== undefined) await query('UPDATE chats SET title = $1, last_updated = $2 WHERE id = $3', [title, Date.now(), req.params.id]);
  if (archived !== undefined) await query('UPDATE chats SET archived = $1 WHERE id = $2', [!!archived, req.params.id]);
  res.json({ ok: true });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const result = await query('DELETE FROM chats WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
  if (result.rowCount === 0) { res.status(404).json({ error: 'Chat not found' }); return; }
  res.json({ ok: true });
});

router.post('/:id/messages', async (req: Request, res: Response) => {
  const chat = await queryOne('SELECT id FROM chats WHERE id = $1 AND user_id = $2', [req.params.id, req.user!.userId]);
  if (!chat) { res.status(404).json({ error: 'Chat not found' }); return; }

  const { role, content, department, sources } = req.body;
  const id = crypto.randomUUID();
  const now = Date.now();
  await query('INSERT INTO messages (id, chat_id, role, content, department, sources_json, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [id, req.params.id, role, content, department || null, sources ? JSON.stringify(sources) : null, now]);

  const preview = content.substring(0, 100);
  await query("UPDATE chats SET preview = $1, last_updated = $2, title = CASE WHEN title = 'Новый чат' THEN $3 ELSE title END WHERE id = $4",
    [preview, now, content.substring(0, 50), req.params.id]);

  res.status(201).json({ id, role, content, created_at: now });
});

export default router;
