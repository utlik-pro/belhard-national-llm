import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Pool } = pg;

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (pool) return pool;

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
    max: 10,
  });

  console.log('PostgreSQL pool created');
  return pool;
}

export async function initDB(): Promise<void> {
  const p = getPool();
  const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf-8');

  // Split by semicolons and execute each statement
  const statements = schema.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    try {
      await p.query(stmt);
    } catch (err: any) {
      // Ignore "already exists" errors
      if (!err.message?.includes('already exists')) {
        console.warn(`Schema warning: ${err.message}`);
      }
    }
  }

  console.log('Database schema applied');
}

// Helper for simple queries
export async function query(text: string, params?: any[]): Promise<pg.QueryResult> {
  return getPool().query(text, params);
}

export async function queryOne(text: string, params?: any[]): Promise<any> {
  const result = await getPool().query(text, params);
  return result.rows[0] || null;
}

export async function queryAll(text: string, params?: any[]): Promise<any[]> {
  const result = await getPool().query(text, params);
  return result.rows;
}
