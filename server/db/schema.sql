CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  company TEXT,
  position TEXT,
  country TEXT NOT NULL DEFAULT 'belarus',
  role TEXT NOT NULL DEFAULT 'user',
  created_at BIGINT NOT NULL,
  last_login BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT UNIQUE NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  preview TEXT,
  department TEXT NOT NULL DEFAULT 'general',
  country TEXT NOT NULL DEFAULT 'belarus',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at BIGINT NOT NULL,
  last_updated BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  department TEXT,
  sources_json TEXT,
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_chat ON messages(chat_id, created_at);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'PDF',
  citation TEXT NOT NULL,
  url TEXT,
  country TEXT NOT NULL DEFAULT 'belarus',
  preview TEXT,
  full_content TEXT,
  sections_json TEXT,
  adopted_date TEXT,
  last_updated TEXT,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  source_title TEXT,
  citation TEXT NOT NULL,
  path TEXT NOT NULL,
  content TEXT NOT NULL,
  chunk_type TEXT NOT NULL DEFAULT 'article'
);

CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source_id)
