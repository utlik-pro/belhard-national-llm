#!/usr/bin/env node
/**
 * Prebuild Chunks Script
 *
 * Generates chunks from all documents ONCE at build time.
 * Output: /public/data/chunks.json
 *
 * Usage:
 *   node scripts/prebuild-chunks.js
 *   npm run prebuild-chunks
 */

const fs = require('fs');
const path = require('path');

const DOCUMENTS_DIR = path.join(__dirname, '../public/data/documents');
const INDEX_FILE = path.join(__dirname, '../public/data/documents-index.json');
const OUTPUT_FILE = path.join(__dirname, '../public/data/chunks.json');

// ---- Chunking logic (mirror of chunkingService.ts) ----

function chunkDocument(doc) {
  const chunks = [];

  const sectionsHaveContent = doc.sections && Array.isArray(doc.sections) && doc.sections.length > 0 &&
    doc.sections.some(section =>
      section.chapters?.some(chapter =>
        chapter.articles?.some(article =>
          article.content && article.content.trim().length > 50
        )
      )
    );

  if (sectionsHaveContent) {
    const isEmployeeDoc = doc.citation?.toLowerCase().includes('сотрудник') ||
                         doc.title?.toLowerCase().includes('сотрудник');
    const isClientDoc = doc.citation?.toLowerCase().includes('клиент') ||
                       doc.title?.toLowerCase().includes('клиент');
    const isFinanceDoc = doc.citation?.toLowerCase().includes('финанс') ||
                        doc.title?.toLowerCase().includes('финанс') ||
                        doc.title?.toLowerCase().includes('отчёт') ||
                        doc.title?.toLowerCase().includes('отчет');
    const isSimpleList = doc.sections.length === 1 && doc.sections[0].chapters?.length === 1;
    const useSimplePath = isEmployeeDoc || isClientDoc || isSimpleList;
    const usePunktFormat = isEmployeeDoc || isClientDoc || isFinanceDoc;
    const isAzDoc = doc.country === 'azerbaijan';

    doc.sections.forEach(section => {
      section.chapters?.forEach(chapter => {
        chapter.articles?.forEach(article => {
          const chunkId = `${doc.id}_S${section.number}_C${chapter.number}_A${article.number}`;

          let chunkPath;
          if (useSimplePath) {
            chunkPath = `пункт ${article.number}`;
          } else if (usePunktFormat) {
            chunkPath = `${chapter.title} - пункт ${article.number}`;
          } else if (isAzDoc) {
            chunkPath = `BÖLMƏ ${section.number}. ${section.title} → Fəsil ${chapter.number}. ${chapter.title} → Maddə ${article.number}`;
          } else {
            chunkPath = `РАЗДЕЛ ${section.number}. ${section.title} → ГЛАВА ${chapter.number}. ${chapter.title} → Статья ${article.number}`;
          }

          let content;
          if (useSimplePath || usePunktFormat) {
            content = `Пункт ${article.number}. ${article.title}`;
          } else if (isAzDoc) {
            content = `Maddə ${article.number}. ${article.title}`;
          } else {
            content = `Статья ${article.number}. ${article.title}`;
          }

          if (article.content && article.content.trim().length > 0) {
            content += `\n${article.content}`;
          } else if (doc.fullContent) {
            const articlePattern = new RegExp(`Статья ${article.number}\\..*?(?=Статья \\d+\\.|$)`, 's');
            const match = doc.fullContent.match(articlePattern);
            if (match) {
              content += `\n${match[0].substring(0, 2000)}`;
            }
          }

          if (article.paragraphs && article.paragraphs.length > 0) {
            content += '\n\n';
            article.paragraphs.forEach(para => {
              content += `${para.number}. ${para.text}\n`;
            });
          }

          if (content.trim().length > article.title.length + 20) {
            chunks.push({
              id: chunkId,
              sourceId: doc.id,
              sourceTitle: doc.title,
              citation: doc.citation,
              path: chunkPath,
              content,
              chunkType: 'article'
            });
          }
        });

        if (!chapter.articles || chapter.articles.length === 0) {
          const chunkId = `${doc.id}_S${section.number}_C${chapter.number}`;
          const chunkPath = `РАЗДЕЛ ${section.number}. ${section.title} → ГЛАВА ${chapter.number}. ${chapter.title}`;
          chunks.push({
            id: chunkId,
            sourceId: doc.id,
            sourceTitle: doc.title,
            citation: doc.citation,
            path: chunkPath,
            content: `ГЛАВА ${chapter.number}. ${chapter.title}`,
            chunkType: 'chapter'
          });
        }
      });

      if (!section.chapters || section.chapters.length === 0) {
        const chunkId = `${doc.id}_S${section.number}`;
        const chunkPath = `РАЗДЕЛ ${section.number}. ${section.title}`;
        chunks.push({
          id: chunkId,
          sourceId: doc.id,
          sourceTitle: doc.title,
          citation: doc.citation,
          path: chunkPath,
          content: `РАЗДЕЛ ${section.number}. ${section.title}`,
          chunkType: 'section'
        });
      }
    });
  } else {
    // Fallback: parse from fullContent
    const content = doc.fullContent || '';
    const isLegalDocument = /Статья\s+\d+[.\s]/i.test(content);

    if (isLegalDocument && content.length > 500) {
      let currentSection = '';
      let currentChapter = '';

      const articlePattern = /Статья\s+(\d+)[.\s]+([^\n]+)/gi;
      const articles = [];
      let match;

      while ((match = articlePattern.exec(content)) !== null) {
        articles.push({ number: match[1], title: match[2].trim(), startIdx: match.index });
      }

      const sectionPattern = /РАЗДЕЛ\s+([IVX\d]+)[.\s]*([^\n]*)/gi;
      const chapterPattern = /ГЛАВА\s+(\d+)[.\s]*([^\n]*)/gi;
      const sections = [];
      const chapters = [];

      while ((match = sectionPattern.exec(content)) !== null) {
        sections.push({ number: match[1], title: match[2].trim(), startIdx: match.index });
      }
      while ((match = chapterPattern.exec(content)) !== null) {
        chapters.push({ number: match[1], title: match[2].trim(), startIdx: match.index });
      }

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const nextArticle = articles[i + 1];
        const relevantSection = sections.filter(s => s.startIdx < article.startIdx).pop();
        const relevantChapter = chapters.filter(c => c.startIdx < article.startIdx).pop();

        if (relevantSection) currentSection = `РАЗДЕЛ ${relevantSection.number}. ${relevantSection.title}`;
        if (relevantChapter) currentChapter = `ГЛАВА ${relevantChapter.number}. ${relevantChapter.title}`;

        const startIdx = article.startIdx;
        const endIdx = nextArticle ? nextArticle.startIdx : content.length;
        let articleContent = content.substring(startIdx, endIdx).trim();

        if (articleContent.length > 4000) {
          articleContent = articleContent.substring(0, 4000) + '...';
        }

        let chunkPath = '';
        if (currentSection) chunkPath += currentSection + ' → ';
        if (currentChapter) chunkPath += currentChapter + ' → ';
        chunkPath += `Статья ${article.number}`;

        chunks.push({
          id: `${doc.id}_A${article.number}`,
          sourceId: doc.id,
          sourceTitle: doc.title,
          citation: doc.citation,
          path: chunkPath,
          content: articleContent,
          chunkType: 'article'
        });
      }
    } else {
      const lines = content.split('\n').map(l => l.trim()).filter(l => l.length >= 3);
      if (lines.length > 1) {
        lines.forEach((line, idx) => {
          chunks.push({
            id: `${doc.id}_L${idx}`,
            sourceId: doc.id,
            sourceTitle: doc.title,
            citation: doc.citation,
            path: `пункт ${idx + 1}`,
            content: line,
            chunkType: 'article'
          });
        });
      } else if (content.trim().length > 0) {
        const maxChunkSize = 3000;
        for (let i = 0; i < content.length; i += maxChunkSize) {
          chunks.push({
            id: `${doc.id}_fallback_${Math.floor(i / maxChunkSize)}`,
            sourceId: doc.id,
            sourceTitle: doc.title,
            citation: doc.citation,
            path: 'полный текст',
            content: content.substring(i, i + maxChunkSize),
            chunkType: 'article'
          });
        }
      }
    }
  }

  // Guaranteed fallback
  if (chunks.length === 0) {
    const fallbackContent = [doc.title, doc.preview || '', doc.fullContent || ''].filter(Boolean).join('\n\n').trim();
    if (fallbackContent.length > 10) {
      const maxChunkSize = 3000;
      for (let i = 0; i < fallbackContent.length; i += maxChunkSize) {
        chunks.push({
          id: `${doc.id}_fallback_${Math.floor(i / maxChunkSize)}`,
          sourceId: doc.id,
          sourceTitle: doc.title,
          citation: doc.citation,
          path: 'полный текст',
          content: fallbackContent.substring(i, i + maxChunkSize),
          chunkType: 'article'
        });
      }
    }
  }

  return chunks;
}

// ---- Main ----

function main() {
  console.log('=== Prebuild Chunks ===\n');

  // Load document index
  const index = JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8'));
  console.log(`Found ${index.length} documents in index\n`);

  const allChunks = [];
  const stats = {};

  for (const entry of index) {
    const docPath = path.join(DOCUMENTS_DIR, `${entry.id}.json`);

    if (!fs.existsSync(docPath)) {
      console.warn(`  SKIP ${entry.id} — file not found`);
      continue;
    }

    const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8'));
    const chunks = chunkDocument(doc);

    stats[entry.id] = chunks.length;
    allChunks.push(...chunks);

    console.log(`  ${entry.id}: ${chunks.length} chunks`);
  }

  // Also process MOCK_SOURCES documents that may not be in /public/data/documents/
  // These are embedded in constants.ts — skip for now, they'll be chunked at runtime if missing

  // Write output
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allChunks, null, 0));

  const fileSizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);

  console.log(`\n=== Results ===`);
  console.log(`Total documents: ${Object.keys(stats).length}`);
  console.log(`Total chunks: ${allChunks.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log(`File size: ${fileSizeMB} MB`);
  console.log(`\nPer-document stats:`);

  Object.entries(stats)
    .sort((a, b) => b[1] - a[1])
    .forEach(([id, count]) => {
      console.log(`  ${id}: ${count}`);
    });
}

main();
