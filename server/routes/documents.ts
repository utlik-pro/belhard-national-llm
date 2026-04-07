import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, queryAll } from '../db/connection.js';
import { authMiddleware, adminMiddleware } from '../middleware/auth.js';
import { invalidateChunkCache } from './llm.js';

const router = Router();
router.use(authMiddleware);

function chunkDocument(doc: any): any[] {
  const chunks: any[] = [];
  let sections: any[] = [];
  try { sections = doc.sections_json ? (typeof doc.sections_json === 'string' ? JSON.parse(doc.sections_json) : doc.sections_json) : []; } catch {}

  const hasContent = sections.length > 0 && sections.some((s: any) => s.chapters?.some((ch: any) => ch.articles?.some((a: any) => a.content?.trim().length > 50)));
  const isAz = doc.country === 'azerbaijan';
  const isSimple = doc.citation?.toLowerCase().includes('сотрудник') || doc.citation?.toLowerCase().includes('клиент');

  if (hasContent) {
    sections.forEach((section: any) => {
      section.chapters?.forEach((chapter: any) => {
        chapter.articles?.forEach((article: any) => {
          const id = `${doc.id}_S${section.number}_C${chapter.number}_A${article.number}`;
          let path = isSimple ? `пункт ${article.number}` : isAz ? `BÖLMƏ ${section.number} → Fəsil ${chapter.number} → Maddə ${article.number}` : `РАЗДЕЛ ${section.number} → ГЛАВА ${chapter.number} → Статья ${article.number}`;
          let content = isSimple ? `Пункт ${article.number}. ${article.title}` : isAz ? `Maddə ${article.number}. ${article.title}` : `Статья ${article.number}. ${article.title}`;
          if (article.content?.trim()) content += `\n${article.content}`;
          if (content.length > article.title.length + 20) chunks.push({ id, source_id: doc.id, source_title: doc.title, citation: doc.citation, path, content, chunk_type: 'article' });
        });
      });
    });
  } else {
    const fc = doc.full_content || '';
    const artPattern = /Статья\s+(\d+)[.\s]+([^\n]+)/gi;
    const arts: any[] = []; let m;
    while ((m = artPattern.exec(fc)) !== null) arts.push({ n: m[1], t: m[2].trim(), i: m.index });
    if (arts.length > 0) {
      for (let i = 0; i < arts.length; i++) {
        let c = fc.substring(arts[i].i, arts[i + 1]?.i || fc.length).trim();
        if (c.length > 4000) c = c.substring(0, 4000) + '...';
        chunks.push({ id: `${doc.id}_A${arts[i].n}`, source_id: doc.id, source_title: doc.title, citation: doc.citation, path: `Статья ${arts[i].n}`, content: c, chunk_type: 'article' });
      }
    } else if (fc.length > 0) {
      for (let i = 0; i < fc.length; i += 3000) {
        chunks.push({ id: `${doc.id}_fb_${Math.floor(i / 3000)}`, source_id: doc.id, source_title: doc.title, citation: doc.citation, path: 'полный текст', content: fc.substring(i, i + 3000), chunk_type: 'article' });
      }
    }
  }
  return chunks;
}

router.get('/', async (req: Request, res: Response) => {
  const country = req.query.country as string;
  const docs = country
    ? await queryAll('SELECT id, title, type, citation, url, country, preview, adopted_date, last_updated FROM documents WHERE country = $1', [country])
    : await queryAll('SELECT id, title, type, citation, url, country, preview, adopted_date, last_updated FROM documents');
  res.json(docs);
});

router.get('/:id', async (req: Request, res: Response) => {
  const doc = await queryOne('SELECT * FROM documents WHERE id = $1', [req.params.id]);
  if (!doc) { res.status(404).json({ error: 'Not found' }); return; }
  if (doc.sections_json) { try { doc.sections = JSON.parse(doc.sections_json); } catch { doc.sections = []; } }
  delete doc.sections_json;
  res.json(doc);
});

router.post('/', adminMiddleware, async (req: Request, res: Response) => {
  const doc = req.body;
  if (!doc.id || !doc.title || !doc.citation) { res.status(400).json({ error: 'id, title, citation required' }); return; }

  await query(`INSERT INTO documents (id, title, type, citation, url, country, preview, full_content, sections_json, adopted_date, last_updated, created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    ON CONFLICT (id) DO UPDATE SET title=$2, type=$3, citation=$4, url=$5, country=$6, preview=$7, full_content=$8, sections_json=$9, adopted_date=$10, last_updated=$11`,
    [doc.id, doc.title, doc.type || 'PDF', doc.citation, doc.url || '', doc.country || 'belarus', doc.preview || '',
     doc.fullContent || doc.full_content || '', doc.sections ? JSON.stringify(doc.sections) : doc.sections_json || null,
     doc.adoptedDate || null, doc.lastUpdated || null, Date.now()]);

  await query('DELETE FROM chunks WHERE source_id = $1', [doc.id]);
  const dbDoc = await queryOne('SELECT * FROM documents WHERE id = $1', [doc.id]);
  const chunks = chunkDocument(dbDoc);

  for (const c of chunks) {
    await query('INSERT INTO chunks (id, source_id, source_title, citation, path, content, chunk_type) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [c.id, c.source_id, c.source_title, c.citation, c.path, c.content, c.chunk_type]);
  }

  invalidateChunkCache();
  res.status(201).json({ documentId: doc.id, chunksCreated: chunks.length });
});

router.delete('/:id', adminMiddleware, async (req: Request, res: Response) => {
  const result = await query('DELETE FROM documents WHERE id = $1', [req.params.id]);
  if (result.rowCount === 0) { res.status(404).json({ error: 'Not found' }); return; }
  invalidateChunkCache();
  res.json({ ok: true });
});

router.get('/:id/chunks', async (req: Request, res: Response) => {
  const chunks = await queryAll('SELECT * FROM chunks WHERE source_id = $1', [req.params.id]);
  res.json(chunks);
});

export default router;
