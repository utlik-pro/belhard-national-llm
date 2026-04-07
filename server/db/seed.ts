import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { initDB, query, queryOne } from './connection.js';
import { config } from '../config.js';

async function seed() {
  console.log('=== Seeding Database ===\n');
  await initDB();

  // 1. Import documents
  const docsDir = path.join(config.publicDataPath, 'documents');
  const indexPath = path.join(config.publicDataPath, 'documents-index.json');

  if (fs.existsSync(indexPath)) {
    const index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'));
    console.log(`Found ${index.length} documents in index`);

    for (const entry of index) {
      const docPath = path.join(docsDir, `${entry.id}.json`);
      if (!fs.existsSync(docPath)) { console.log(`  SKIP ${entry.id}`); continue; }

      const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8'));
      await query(
        `INSERT INTO documents (id, title, type, citation, url, country, preview, full_content, sections_json, adopted_date, last_updated, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (id) DO UPDATE SET title=$2, full_content=$8, sections_json=$9`,
        [doc.id, doc.title, doc.type || 'PDF', doc.citation, doc.url || '',
         doc.country || 'belarus', doc.preview || '', doc.fullContent || '',
         doc.sections ? JSON.stringify(doc.sections) : null,
         doc.adoptedDate || null, doc.lastUpdated || null, Date.now()]
      );
      console.log(`  ${doc.id}: imported`);
    }
  }

  // 2. Import pre-built chunks
  const chunksPath = path.join(config.publicDataPath, 'chunks.json');
  if (fs.existsSync(chunksPath)) {
    await query('DELETE FROM chunks');
    const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
    console.log(`\nImporting ${chunks.length} chunks...`);

    // Batch insert in groups of 100
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100);
      for (const c of batch) {
        await query(
          'INSERT INTO chunks (id, source_id, source_title, citation, path, content, chunk_type) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
          [c.id, c.sourceId, c.sourceTitle, c.citation, c.path, c.content, c.chunkType || 'article']
        );
      }
      if ((i + 100) % 1000 === 0) console.log(`  ${Math.min(i + 100, chunks.length)}/${chunks.length}`);
    }
    console.log(`Imported ${chunks.length} chunks`);
  }

  // 3. Demo users
  console.log('\nCreating demo users...');
  const existing = await queryOne('SELECT id FROM users WHERE email = $1', ['demo@belhard.ai']);

  if (!existing) {
    const users = [
      { email: 'demo@belhard.ai', name: 'Алексей Петров', country: 'belarus', company: 'Belhard Group', position: 'Разработчик', role: 'admin' },
      { email: 'demo@huquqi.az', name: 'Test User', country: 'azerbaijan', company: 'HeadBots', position: 'Developer', role: 'user' },
    ];
    for (const u of users) {
      const hash = await bcrypt.hash('123456', 10);
      await query('INSERT INTO users (id, email, name, password_hash, company, position, country, role, created_at, last_login) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
        [crypto.randomUUID(), u.email, u.name, hash, u.company, u.position, u.country, u.role, Date.now(), Date.now()]);
      console.log(`  Created: ${u.email} (${u.role})`);
    }
  } else {
    console.log('  Demo users exist');
  }

  // Stats
  const users = await queryOne('SELECT COUNT(*) as count FROM users');
  const docs = await queryOne('SELECT COUNT(*) as count FROM documents');
  const chunks = await queryOne('SELECT COUNT(*) as count FROM chunks');
  console.log(`\n=== Done ===\nUsers: ${users.count}, Documents: ${docs.count}, Chunks: ${chunks.count}`);

  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
