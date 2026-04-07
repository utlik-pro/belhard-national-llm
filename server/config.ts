import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export const config = {
  port: parseInt(process.env.PORT || process.env.SERVER_PORT || '3001'),
  jwtSecret: process.env.JWT_SECRET || 'belhard-ai-jwt-secret-change-in-production-2025',
  jwtExpiresIn: '24h',
  refreshTokenExpiresIn: 7 * 24 * 60 * 60 * 1000, // 7 days
  databaseUrl: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://localhost:5432/belhard_ai',
  geminiApiKeys: (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').split(',').filter(Boolean),
  openaiApiKeys: (process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '').split(',').filter(Boolean),
  publicDataPath: path.resolve(process.cwd(), 'public/data'),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
