/**
 * Chunking Service для разбиения документов на части
 *
 * Улучшает точность RAG путем отправки только релевантных частей документов
 * вместо полных текстов (150+ KB)
 */

import { Source, DocumentSection, DocumentChapter, DocumentArticle } from '../types';
import { Chunk } from './indexedDBService';

class ChunkingService {
  /**
   * Разбить документ на chunks
   */
  chunkDocument(doc: Source): Chunk[] {
    const chunks: Chunk[] = [];

    // Проверяем, есть ли контент в секциях (не только заголовки)
    const sectionsHaveContent = doc.sections && Array.isArray(doc.sections) && doc.sections.length > 0 &&
      doc.sections.some(section =>
        section.chapters?.some(chapter =>
          chapter.articles?.some(article =>
            article.content && article.content.trim().length > 50
          )
        )
      );

    // Если документ имеет структуру sections С КОНТЕНТОМ (из парсера)
    if (sectionsHaveContent) {
      // Определяем тип документа для правильного формата пути
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
      // Для финансовых документов используем "пункт" вместо "статья"
      const usePunktFormat = isEmployeeDoc || isClientDoc || isFinanceDoc;

      // Detect if this is an Azerbaijan document
      const isAzDoc = (doc as any).country === 'azerbaijan';

      doc.sections.forEach(section => {
        section.chapters?.forEach(chapter => {
          chapter.articles?.forEach(article => {
            // Chunk по статье
            const chunkId = `${doc.id}_S${section.number}_C${chapter.number}_A${article.number}`;

            // Для документов с сотрудниками/клиентами или простых списков используем упрощённый формат
            let path: string;
            if (useSimplePath) {
              path = `пункт ${article.number}`;
            } else if (usePunktFormat) {
              // Для финансовых документов: упрощённый путь с "пункт"
              path = `${chapter.title} - пункт ${article.number}`;
            } else if (isAzDoc) {
              path = `BÖLMƏ ${section.number}. ${section.title} → Fəsil ${chapter.number}. ${chapter.title} → Maddə ${article.number}`;
            } else {
              path = `РАЗДЕЛ ${section.number}. ${section.title} → ГЛАВА ${chapter.number}. ${chapter.title} → Статья ${article.number}`;
            }

            // Для документов сотрудников/клиентов/финансов используем формат "Пункт N" вместо "Статья N"
            let content: string;
            if (useSimplePath || usePunktFormat) {
              content = `Пункт ${article.number}. ${article.title}`;
            } else if (isAzDoc) {
              content = `Maddə ${article.number}. ${article.title}`;
            } else {
              content = `Статья ${article.number}. ${article.title}`;
            }

            // Если article.content пустой, попробовать извлечь из fullContent
            if (article.content && article.content.trim().length > 0) {
              content += `\n${article.content}`;
            } else if (doc.fullContent) {
              // Fallback: найти текст этой статьи в fullContent
              const articlePattern = new RegExp(`Статья ${article.number}\\..*?(?=Статья \\d+\\.|$)`, 's');
              const match = doc.fullContent.match(articlePattern);
              if (match) {
                content += `\n${match[0].substring(0, 2000)}`; // Ограничить 2KB
              }
            }

            // Добавить пункты если есть
            if (article.paragraphs && article.paragraphs.length > 0) {
              content += '\n\n';
              article.paragraphs.forEach(para => {
                content += `${para.number}. ${para.text}\n`;
              });
            }

            // Пропустить chunks с пустым контентом
            if (content.trim().length > article.title.length + 20) {
              chunks.push({
                id: chunkId,
                sourceId: doc.id,
                sourceTitle: doc.title,
                citation: doc.citation,
                path,
                content,
                chunkType: 'article'
              });
            }
          });

          // Если глава без статей, создать chunk для всей главы
          if (!chapter.articles || chapter.articles.length === 0) {
            const chunkId = `${doc.id}_S${section.number}_C${chapter.number}`;
            const path = `РАЗДЕЛ ${section.number}. ${section.title} → ГЛАВА ${chapter.number}. ${chapter.title}`;

            chunks.push({
              id: chunkId,
              sourceId: doc.id,
              sourceTitle: doc.title,
              citation: doc.citation,
              path,
              content: `ГЛАВА ${chapter.number}. ${chapter.title}`,
              chunkType: 'chapter'
            });
          }
        });

        // Если раздел без глав, создать chunk для всего раздела
        if (!section.chapters || section.chapters.length === 0) {
          const chunkId = `${doc.id}_S${section.number}`;
          const path = `РАЗДЕЛ ${section.number}. ${section.title}`;

          chunks.push({
            id: chunkId,
            sourceId: doc.id,
            sourceTitle: doc.title,
            citation: doc.citation,
            path,
            content: `РАЗДЕЛ ${section.number}. ${section.title}`,
            chunkType: 'section'
          });
        }
      });
    } else {
      // Fallback для документов без структуры или с пустым контентом в секциях
      const content = doc.fullContent || '';

      // Проверяем, является ли это законодательным документом (содержит "Статья \d+")
      const isLegalDocument = /Статья\s+\d+[.\s]/i.test(content);

      if (isLegalDocument && content.length > 500) {
        // Парсим законодательный документ по статьям
        console.log(`📜 ${doc.citation}: парсинг законодательного документа по статьям...`);

        // Находим текущий раздел и главу для контекста пути
        let currentSection = '';
        let currentChapter = '';

        // Разбиваем по паттерну "Статья N."
        const articlePattern = /Статья\s+(\d+)[.\s]+([^\n]+)/gi;
        const articles: { number: string; title: string; startIdx: number }[] = [];

        let match: RegExpExecArray | null;
        while ((match = articlePattern.exec(content)) !== null) {
          articles.push({
            number: match[1],
            title: match[2].trim(),
            startIdx: match.index
          });
        }

        console.log(`   Найдено ${articles.length} статей`);

        // Также извлекаем разделы и главы для контекста
        const sectionPattern = /РАЗДЕЛ\s+([IVX\d]+)[.\s]*([^\n]*)/gi;
        const chapterPattern = /ГЛАВА\s+(\d+)[.\s]*([^\n]*)/gi;

        const sections: { number: string; title: string; startIdx: number }[] = [];
        const chapters: { number: string; title: string; startIdx: number }[] = [];

        while ((match = sectionPattern.exec(content)) !== null) {
          sections.push({ number: match[1], title: match[2].trim(), startIdx: match.index });
        }
        while ((match = chapterPattern.exec(content)) !== null) {
          chapters.push({ number: match[1], title: match[2].trim(), startIdx: match.index });
        }

        // Создаём chunks для каждой статьи
        for (let i = 0; i < articles.length; i++) {
          const article = articles[i];
          const nextArticle = articles[i + 1];

          // Находим текущий раздел и главу по позиции
          const relevantSection = sections.filter(s => s.startIdx < article.startIdx).pop();
          const relevantChapter = chapters.filter(c => c.startIdx < article.startIdx).pop();

          if (relevantSection) currentSection = `РАЗДЕЛ ${relevantSection.number}. ${relevantSection.title}`;
          if (relevantChapter) currentChapter = `ГЛАВА ${relevantChapter.number}. ${relevantChapter.title}`;

          // Извлекаем контент статьи
          const startIdx = article.startIdx;
          const endIdx = nextArticle ? nextArticle.startIdx : content.length;
          let articleContent = content.substring(startIdx, endIdx).trim();

          // Ограничиваем размер chunk (макс 4000 символов)
          if (articleContent.length > 4000) {
            articleContent = articleContent.substring(0, 4000) + '...';
          }

          // Формируем путь с контекстом
          let path = '';
          if (currentSection) path += currentSection + ' → ';
          if (currentChapter) path += currentChapter + ' → ';
          path += `Статья ${article.number}`;

          const chunkId = `${doc.id}_A${article.number}`;

          chunks.push({
            id: chunkId,
            sourceId: doc.id,
            sourceTitle: doc.title,
            citation: doc.citation,
            path,
            content: articleContent,
            chunkType: 'article'
          });
        }

        console.log(`📝 ${doc.citation}: создано ${chunks.length} chunks по статьям`);

      } else {
        // Документ-список или простой документ без статей
        const isEmployeeDoc = doc.citation?.toLowerCase().includes('сотрудник') ||
                             doc.title?.toLowerCase().includes('сотрудник');
        const isClientDoc = doc.citation?.toLowerCase().includes('клиент') ||
                           doc.title?.toLowerCase().includes('клиент');

        // Для документов-списков: каждая строка = chunk
        const lines = content.split('\n').map(l => l.trim()).filter(l => l.length >= 3);

        if ((isEmployeeDoc || isClientDoc || lines.length > 3) && lines.length > 1) {
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
          console.log(`📝 ${doc.citation}: создано ${chunks.length} chunks по строкам`);
        } else if (content.trim().length > 0) {
          // Один chunk для всего документа
          chunks.push({
            id: `${doc.id}_full`,
            sourceId: doc.id,
            sourceTitle: doc.title,
            citation: doc.citation,
            path: 'полный текст',
            content: content.trim(),
            chunkType: 'article'
          });
          console.log(`📝 ${doc.citation}: создан 1 chunk (полный текст, ${content.trim().length} символов)`);
        } else {
          console.warn(`⚠️ ${doc.citation}: пустой контент в fallback ветке`);
        }
      }
    }

    // ГАРАНТИРОВАННЫЙ FALLBACK: если chunks всё ещё пустой, создаём хотя бы один chunk
    // из любого доступного контента (title + preview + fullContent)
    if (chunks.length === 0) {
      const fallbackContent = [
        doc.title,
        doc.preview || '',
        doc.fullContent || ''
      ].filter(Boolean).join('\n\n').trim();

      if (fallbackContent.length > 10) {
        // Разбиваем длинный контент на части по 3000 символов
        const maxChunkSize = 3000;
        const contentParts = [];

        for (let i = 0; i < fallbackContent.length; i += maxChunkSize) {
          contentParts.push(fallbackContent.substring(i, i + maxChunkSize));
        }

        contentParts.forEach((part, idx) => {
          chunks.push({
            id: `${doc.id}_fallback_${idx}`,
            sourceId: doc.id,
            sourceTitle: doc.title,
            citation: doc.citation,
            path: contentParts.length > 1 ? `часть ${idx + 1}` : 'полный текст',
            content: part,
            chunkType: 'article'
          });
        });

        console.log(`📝 ${doc.citation}: FALLBACK - создано ${chunks.length} chunk(s) из доступного контента (${fallbackContent.length} символов)`);
      } else {
        console.error(`❌ ${doc.citation}: невозможно создать chunks - нет контента (title: ${doc.title?.length || 0}, preview: ${doc.preview?.length || 0}, fullContent: ${doc.fullContent?.length || 0})`);
      }
    }

    return chunks;
  }

  /**
   * Массовое chunking всех документов
   */
  async chunkAllDocuments(documents: Source[]): Promise<Chunk[]> {
    const allChunks: Chunk[] = [];

    for (const doc of documents) {
      const docChunks = this.chunkDocument(doc);
      allChunks.push(...docChunks);
    }

    console.log(`✅ Chunked ${documents.length} documents into ${allChunks.length} chunks`);

    return allChunks;
  }

  /**
   * Получить статистику chunking
   */
  getChunkingStats(chunks: Chunk[]): {
    totalChunks: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    avgChunkSize: number;
    minChunkSize: number;
    maxChunkSize: number;
  } {
    const byType: Record<string, number> = {
      section: 0,
      chapter: 0,
      article: 0
    };

    const bySource: Record<string, number> = {};
    const chunkSizes: number[] = [];

    chunks.forEach(chunk => {
      // Подсчет по типу
      byType[chunk.chunkType] = (byType[chunk.chunkType] || 0) + 1;

      // Подсчет по источнику
      bySource[chunk.sourceId] = (bySource[chunk.sourceId] || 0) + 1;

      // Размер chunk
      chunkSizes.push(chunk.content.length);
    });

    return {
      totalChunks: chunks.length,
      byType,
      bySource,
      avgChunkSize: chunkSizes.length > 0
        ? Math.round(chunkSizes.reduce((a, b) => a + b, 0) / chunkSizes.length)
        : 0,
      minChunkSize: chunkSizes.length > 0 ? Math.min(...chunkSizes) : 0,
      maxChunkSize: chunkSizes.length > 0 ? Math.max(...chunkSizes) : 0
    };
  }

  /**
   * Фильтрация chunks по минимальному размеру
   */
  filterChunksBySize(chunks: Chunk[], minSize: number = 50): Chunk[] {
    return chunks.filter(chunk => chunk.content.length >= minSize);
  }

  /**
   * Объединение маленьких chunks
   */
  mergeSmallChunks(chunks: Chunk[], minSize: number = 200): Chunk[] {
    const result: Chunk[] = [];
    let buffer: Chunk[] = [];

    for (const chunk of chunks) {
      if (chunk.content.length < minSize) {
        buffer.push(chunk);
      } else {
        // Если есть накопленные маленькие chunks, объединить их
        if (buffer.length > 0) {
          const merged = this.mergeChunks(buffer);
          if (merged) {
            result.push(merged);
          }
          buffer = [];
        }
        result.push(chunk);
      }
    }

    // Обработать оставшиеся маленькие chunks
    if (buffer.length > 0) {
      const merged = this.mergeChunks(buffer);
      if (merged) {
        result.push(merged);
      }
    }

    return result;
  }

  /**
   * Объединить несколько chunks в один
   */
  private mergeChunks(chunks: Chunk[]): Chunk | null {
    if (chunks.length === 0) return null;
    if (chunks.length === 1) return chunks[0];

    const first = chunks[0];
    const content = chunks.map(c => c.content).join('\n\n');

    return {
      id: `${first.sourceId}_MERGED_${chunks.map(c => c.id.split('_').pop()).join('_')}`,
      sourceId: first.sourceId,
      sourceTitle: first.sourceTitle,
      citation: first.citation,
      path: `${first.path} (объединено ${chunks.length} частей)`,
      content,
      chunkType: first.chunkType
    };
  }

  /**
   * Debug: вывести информацию о chunks документа
   */
  debugDocumentChunks(doc: Source): void {
    const chunks = this.chunkDocument(doc);
    const stats = this.getChunkingStats(chunks);

    console.log(`\n📄 Document: ${doc.title}`);
    console.log(`📊 Stats:`, stats);
    console.log(`\n📌 Chunks (first 5):`);
    chunks.slice(0, 5).forEach((chunk, idx) => {
      console.log(`\n${idx + 1}. ${chunk.id}`);
      console.log(`   Path: ${chunk.path}`);
      console.log(`   Type: ${chunk.chunkType}`);
      console.log(`   Size: ${chunk.content.length} chars`);
      console.log(`   Preview: ${chunk.content.substring(0, 100)}...`);
    });
  }
}

export const chunkingService = new ChunkingService();
