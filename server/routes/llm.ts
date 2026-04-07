import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { query, queryOne, queryAll } from '../db/connection.js';
import { authMiddleware } from '../middleware/auth.js';
import { searchChunks } from '../services/search.js';
import { streamLLM } from '../services/llmProxy.js';

const router = Router();
router.use(authMiddleware);

// Cache chunks in memory
let cachedChunks: any[] | null = null;
let lastChunkLoad = 0;
const CHUNK_CACHE_TTL = 5 * 60 * 1000;

async function loadChunks(): Promise<any[]> {
  if (cachedChunks && Date.now() - lastChunkLoad < CHUNK_CACHE_TTL) return cachedChunks;
  cachedChunks = await queryAll('SELECT id, source_id as "sourceId", source_title as "sourceTitle", citation, path, content, chunk_type as "chunkType" FROM chunks');
  lastChunkLoad = Date.now();
  console.log(`Loaded ${cachedChunks!.length} chunks into cache`);
  return cachedChunks!;
}

export function invalidateChunkCache() { cachedChunks = null; }

function buildSystemInstruction(departmentId: string, countryId: string): string {
  const isAz = countryId === 'azerbaijan';
  const brandName = isAz ? 'Hüquqi AI' : 'Belhard AI';
  const brandOrigin = isAz
    ? 'Ты разработан компаниями HeadBots и Utlik.Co для граждан Азербайджана.'
    : 'Ты разработан в компании Belhard Group совместно с НАН РБ.';
  const now = new Date();
  const dateStr = now.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const deptPrompts: Record<string, string> = {
    general: isAz ? 'Универсальный правовой помощник.' : 'Универсальный корпоративный помощник.',
    accounting: 'Эксперт по бухгалтерии и налогам.', hr: 'Специалист по трудовому праву.',
    legal: 'Юрисконсульт.', it: 'Технический директор.',
    labor: 'Əmək hüququ mütəxəssisi.', family: 'Ailə hüququ mütəxəssisi.',
    property: 'Əmlak hüququ mütəxəssisi.', tax: 'Vergi hüququ mütəxəssisi.',
  };

  return `Ты — ${brandName}. ${isAz ? 'Определяй язык запроса и отвечай на ТОМ ЖЕ ЯЗЫКЕ.' : ''}
>>> РОЛЬ: ${deptPrompts[departmentId] || deptPrompts.general} <<<
ПРАВИЛА: 1) Пошаговый ответ с нумерацией 2) Цитаты В КОНЦЕ пункта — копируй ТОЧНО из контекста 3) Разные статьи для разных аспектов
${brandOrigin} Не упоминай Google, Gemini, OpenAI.
ДАТА: ${dateStr}. Используй ТОЛЬКО документы из контекста.`;
}

router.post('/stream', async (req: Request, res: Response) => {
  const { chatId, message, departmentId, countryId, history } = req.body;
  if (!message) { res.status(400).json({ error: 'message required' }); return; }

  // Save user message
  if (chatId) {
    await query('INSERT INTO messages (id, chat_id, role, content, department, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [crypto.randomUUID(), chatId, 'user', message, departmentId || 'general', Date.now()]);
  }

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });

  try {
    res.write(`data: ${JSON.stringify({ status: { stage: 'searching', details: 'Ищу в базе знаний...' } })}\n\n`);

    const allChunks = await loadChunks();
    const countryDocs = await queryAll('SELECT id FROM documents WHERE country = $1', [countryId || 'belarus']);
    const countryDocIds = new Set(countryDocs.map((d: any) => d.id));
    const filtered = allChunks.filter((c: any) => countryDocIds.has(c.sourceId));

    const relevant = searchChunks(filtered, message, departmentId, 15);
    const docNames = [...new Set(relevant.map((c: any) => c.citation))];
    res.write(`data: ${JSON.stringify({ status: { stage: 'found', details: `Найдено ${docNames.length} документов`, documents: docNames.slice(0, 3) } })}\n\n`);

    const contextText = relevant.map((c: any) => {
      const content = c.content.length > 3000 ? c.content.substring(0, 3000) + '...' : c.content;
      return `════════════════════════════════════════\n📌 ЦИТАТА ДЛЯ ОТВЕТА: ${c.citation} - ${c.path}\n════════════════════════════════════════\n${content}`;
    }).join('\n\n');

    const chatHistory = (history || []).map((m: any) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
    const systemInstruction = buildSystemInstruction(departmentId || 'general', countryId || 'belarus');

    res.write(`data: ${JSON.stringify({ status: { stage: 'generating', details: 'Генерирую ответ...' } })}\n\n`);

    let fullResponse = '';
    const stream = streamLLM({ systemInstruction, chatHistory, contextText, prompt: message });
    for await (const chunk of stream) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    const citedSources = relevant.filter((c: any) => fullResponse.includes(c.citation))
      .map((c: any) => ({ id: c.sourceId, citation: c.citation, title: c.sourceTitle, path: c.path }));

    if (chatId) {
      await query('INSERT INTO messages (id, chat_id, role, content, department, sources_json, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [crypto.randomUUID(), chatId, 'assistant', fullResponse, departmentId || 'general', JSON.stringify(citedSources), Date.now()]);
      await query('UPDATE chats SET last_updated = $1, preview = $2 WHERE id = $3', [Date.now(), fullResponse.substring(0, 100), chatId]);
    }

    res.write(`data: ${JSON.stringify({ done: true, sources: citedSources })}\n\n`);
    res.end();
  } catch (err: any) {
    console.error('LLM error:', err);
    res.write(`data: ${JSON.stringify({ error: err.message || 'LLM failed' })}\n\n`);
    res.end();
  }
});

export default router;
