/**
 * Embedding Service для генерации векторных представлений текста
 *
 * Использует OpenAI text-embedding-3-small для создания 1536-мерных векторов
 * Поддерживает batch processing и кэширование
 */

import { Chunk } from './indexedDBService';

// Размерность вектора для text-embedding-3-small
const EMBEDDING_DIMENSIONS = 1536;

// Максимальное количество текстов в одном batch запросе
const MAX_BATCH_SIZE = 100;

// Максимальная длина текста для embedding (в символах)
const MAX_TEXT_LENGTH = 8000;

class EmbeddingService {
  private apiKey: string | null = null;

  constructor() {
    this.apiKey = import.meta.env.VITE_OPENAI_API_KEY || null;
    if (this.apiKey) {
      console.log('✅ EmbeddingService: OpenAI API key loaded');
    } else {
      console.warn('⚠️ EmbeddingService: No OpenAI API key found, embeddings will be disabled');
    }
  }

  /**
   * Проверка доступности сервиса
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Генерация embedding для одного текста
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.apiKey) {
      console.warn('EmbeddingService: API key not available');
      return null;
    }

    try {
      // Обрезаем текст если слишком длинный
      const truncatedText = text.length > MAX_TEXT_LENGTH
        ? text.substring(0, MAX_TEXT_LENGTH)
        : text;

      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: truncatedText,
          dimensions: EMBEDDING_DIMENSIONS
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('OpenAI Embedding API error:', error);
        return null;
      }

      const data = await response.json();
      return data.data[0].embedding;
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      return null;
    }
  }

  /**
   * Batch генерация embeddings для нескольких текстов
   * Более эффективно чем отдельные запросы
   */
  async generateEmbeddings(texts: string[]): Promise<(number[] | null)[]> {
    if (!this.apiKey) {
      console.warn('EmbeddingService: API key not available');
      return texts.map(() => null);
    }

    if (texts.length === 0) {
      return [];
    }

    const results: (number[] | null)[] = new Array(texts.length).fill(null);

    // Разбиваем на batches
    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const batchIndices = batch.map((_, idx) => i + idx);

      try {
        // Обрезаем тексты
        const truncatedBatch = batch.map(text =>
          text.length > MAX_TEXT_LENGTH ? text.substring(0, MAX_TEXT_LENGTH) : text
        );

        const response = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: truncatedBatch,
            dimensions: EMBEDDING_DIMENSIONS
          })
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('OpenAI Embedding API batch error:', error);
          continue;
        }

        const data = await response.json();

        // Сохраняем результаты в правильные позиции
        data.data.forEach((item: { embedding: number[]; index: number }) => {
          results[batchIndices[item.index]] = item.embedding;
        });

        console.log(`📊 Generated embeddings for batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}/${Math.ceil(texts.length / MAX_BATCH_SIZE)}`);
      } catch (error) {
        console.error(`Failed to generate embeddings for batch starting at ${i}:`, error);
      }
    }

    return results;
  }

  /**
   * Генерация embeddings для chunks
   * Возвращает chunks с заполненным полем embedding
   */
  async embedChunks(chunks: Chunk[]): Promise<Chunk[]> {
    if (!this.apiKey || chunks.length === 0) {
      return chunks;
    }

    console.log(`🔄 Generating embeddings for ${chunks.length} chunks...`);

    // Собираем тексты для embedding (citation + path + content)
    const texts = chunks.map(chunk =>
      `${chunk.citation} - ${chunk.path}\n\n${chunk.content}`
    );

    const embeddings = await this.generateEmbeddings(texts);

    // Добавляем embeddings к chunks
    const embeddedChunks = chunks.map((chunk, idx) => ({
      ...chunk,
      embedding: embeddings[idx] || undefined
    }));

    const successCount = embeddings.filter(e => e !== null).length;
    console.log(`✅ Successfully embedded ${successCount}/${chunks.length} chunks`);

    return embeddedChunks;
  }

  /**
   * Cosine similarity между двумя векторами
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      console.error('Vectors must have same length');
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Поиск наиболее похожих chunks по embedding запроса
   */
  async searchSimilarChunks(
    query: string,
    chunks: Chunk[],
    topK: number = 15
  ): Promise<{ chunk: Chunk; similarity: number }[]> {
    // Фильтруем только chunks с embeddings
    const chunksWithEmbeddings = chunks.filter(c => c.embedding && c.embedding.length > 0);

    if (chunksWithEmbeddings.length === 0) {
      console.warn('No chunks with embeddings found, falling back to keyword search');
      return [];
    }

    // Генерируем embedding для запроса
    const queryEmbedding = await this.generateEmbedding(query);
    if (!queryEmbedding) {
      console.error('Failed to generate query embedding');
      return [];
    }

    // Вычисляем similarity для каждого chunk
    const similarities = chunksWithEmbeddings.map(chunk => ({
      chunk,
      similarity: this.cosineSimilarity(queryEmbedding, chunk.embedding!)
    }));

    // Сортируем по убыванию similarity
    similarities.sort((a, b) => b.similarity - a.similarity);

    // Возвращаем топ-K
    return similarities.slice(0, topK);
  }

  /**
   * Проверка наличия embedding у chunk
   */
  hasEmbedding(chunk: Chunk): boolean {
    return !!(chunk.embedding && chunk.embedding.length > 0);
  }

  /**
   * Статистика по embeddings в chunks
   */
  getEmbeddingStats(chunks: Chunk[]): {
    total: number;
    withEmbedding: number;
    withoutEmbedding: number;
    coverage: number;
  } {
    const withEmbedding = chunks.filter(c => this.hasEmbedding(c)).length;
    return {
      total: chunks.length,
      withEmbedding,
      withoutEmbedding: chunks.length - withEmbedding,
      coverage: chunks.length > 0 ? (withEmbedding / chunks.length) * 100 : 0
    };
  }
}

export const embeddingService = new EmbeddingService();

/**
 * Обновить embeddings для всех chunks в IndexedDB
 * Вызывается из консоли: await regenerateAllEmbeddings()
 */
export async function regenerateAllEmbeddings(
  progressCallback?: (progress: { current: number; total: number; percentage: number }) => void
): Promise<{ success: number; failed: number; skipped: number }> {
  // Dynamic import to avoid circular dependency
  const { indexedDB } = await import('./indexedDBService');

  if (!embeddingService.isAvailable()) {
    console.error('❌ EmbeddingService not available (no API key)');
    return { success: 0, failed: 0, skipped: 0 };
  }

  console.log('🔄 Starting embedding regeneration...');

  const allChunks = await indexedDB.getAllChunks();
  const chunksWithoutEmbedding = allChunks.filter(c => !c.embedding || c.embedding.length === 0);

  console.log(`📊 Total chunks: ${allChunks.length}, without embeddings: ${chunksWithoutEmbedding.length}`);

  if (chunksWithoutEmbedding.length === 0) {
    console.log('✅ All chunks already have embeddings!');
    return { success: 0, failed: 0, skipped: allChunks.length };
  }

  let success = 0;
  let failed = 0;

  // Process in batches of 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < chunksWithoutEmbedding.length; i += BATCH_SIZE) {
    const batch = chunksWithoutEmbedding.slice(i, i + BATCH_SIZE);

    console.log(`📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(chunksWithoutEmbedding.length / BATCH_SIZE)}`);

    const embeddedBatch = await embeddingService.embedChunks(batch);

    // Save updated chunks back to IndexedDB
    for (const chunk of embeddedBatch) {
      if (chunk.embedding && chunk.embedding.length > 0) {
        // Update in IndexedDB
        const existingChunk = allChunks.find(c => c.id === chunk.id);
        if (existingChunk) {
          existingChunk.embedding = chunk.embedding;
        }
        success++;
      } else {
        failed++;
      }
    }

    // Save batch to IndexedDB
    await indexedDB.saveChunks(embeddedBatch.filter(c => c.embedding && c.embedding.length > 0));

    // Progress callback
    const progress = {
      current: Math.min(i + BATCH_SIZE, chunksWithoutEmbedding.length),
      total: chunksWithoutEmbedding.length,
      percentage: Math.round((Math.min(i + BATCH_SIZE, chunksWithoutEmbedding.length) / chunksWithoutEmbedding.length) * 100)
    };
    progressCallback?.(progress);

    // Small delay to avoid rate limiting
    if (i + BATCH_SIZE < chunksWithoutEmbedding.length) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`✅ Embedding regeneration complete: ${success} success, ${failed} failed, ${allChunks.length - chunksWithoutEmbedding.length} skipped`);
  return { success, failed, skipped: allChunks.length - chunksWithoutEmbedding.length };
}

/**
 * Полная очистка и переинициализация базы данных
 * Вызывается из консоли: await resetDatabase()
 */
export async function resetDatabase(): Promise<void> {
  console.log('🗑️ Clearing IndexedDB...');

  // Удаляем базу данных полностью
  await new Promise<void>((resolve, reject) => {
    const request = window.indexedDB.deleteDatabase('BelhardAI_DB');
    request.onsuccess = () => {
      console.log('✅ IndexedDB cleared successfully');
      resolve();
    };
    request.onerror = () => reject(request.error);
  });

  console.log('🔄 Reloading page to reinitialize with MOCK_SOURCES...');
  window.location.reload();
}

// Expose for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).embeddingService = embeddingService;
  (window as any).regenerateAllEmbeddings = regenerateAllEmbeddings;
  (window as any).resetDatabase = resetDatabase;
}
