import express from 'express';
import cors from 'cors';
import path from 'path';
import { config } from './config.js';
import { initDB } from './db/connection.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import llmRouter from './routes/llm.js';
import documentsRouter from './routes/documents.js';

const app = express();

// CORS — allow Vercel frontend
app.use(cors({
  origin: [config.frontendUrl, 'http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/chats', chatRouter);
app.use('/api/llm', llmRouter);
app.use('/api/documents', documentsRouter);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    const { queryOne } = await import('./db/connection.js');
    const users = await queryOne('SELECT COUNT(*) as count FROM users');
    const docs = await queryOne('SELECT COUNT(*) as count FROM documents');
    const chunks = await queryOne('SELECT COUNT(*) as count FROM chunks');
    res.json({ status: 'ok', users: parseInt(users.count), documents: parseInt(docs.count), chunks: parseInt(chunks.count) });
  } catch (err: any) {
    res.json({ status: 'error', error: err.message });
  }
});

// In production, serve static frontend
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Start
async function start() {
  await initDB();
  console.log('Database ready');

  app.listen(config.port, () => {
    console.log(`Server: http://localhost:${config.port}`);
    console.log(`Frontend: ${config.frontendUrl}`);
    console.log(`Gemini keys: ${config.geminiApiKeys.length}, OpenAI keys: ${config.openaiApiKeys.length}`);
  });
}

start().catch(console.error);
