/**
 * IndexedDB Service для хранения документов НПА РБ
 *
 * Замена localStorage (5-10 MB) на IndexedDB (100+ MB)
 * Поддерживает lazy loading, chunking, и быстрый поиск
 */

import { Source, ChatSession } from '../types';

const DB_NAME = 'BelhardAI_DB';
const DB_VERSION = 1;

// Object Stores (таблицы)
export const STORES = {
  DOCUMENTS: 'documents',      // Полные документы с fullContent
  METADATA: 'metadata',        // Индекс документов для быстрого поиска
  CHUNKS: 'chunks',           // Разбитые части документов для RAG
  CHATS: 'chats',             // История чатов
  SETTINGS: 'settings'         // Настройки приложения
};

export interface DocumentMetadata {
  id: string;
  title: string;
  type: string;
  citation: string;
  keywords: string[];
  fileSize: number;
  lastUpdated?: string;
  sectionsCount?: number;
  articlesCount?: number;
}

export interface Chunk {
  id: string;              // TK_RB_S1_C1_A16
  sourceId: string;        // TK_RB
  sourceTitle: string;
  citation: string;        // ТК РБ
  path: string;            // РАЗДЕЛ II → ГЛАВА 2 → Статья 16
  content: string;
  chunkType: 'section' | 'chapter' | 'article';
  embedding?: number[];    // Vector embedding для семантического поиска (1536 dimensions)
}

class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Инициализация базы данных
   */
  async init(): Promise<void> {
    // Если уже идет инициализация, дождаться ее
    if (this.initPromise) {
      return this.initPromise;
    }

    // Если уже инициализирована, вернуть сразу
    if (this.db) {
      return Promise.resolve();
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB initialization failed:', request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('✅ IndexedDB initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store для полных документов
        if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
          const documentsStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
          documentsStore.createIndex('type', 'type', { unique: false });
          documentsStore.createIndex('citation', 'citation', { unique: false });
          console.log('Created DOCUMENTS store');
        }

        // Store для метаданных (индекс)
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          const metadataStore = db.createObjectStore(STORES.METADATA, { keyPath: 'id' });
          metadataStore.createIndex('title', 'title', { unique: false });
          metadataStore.createIndex('keywords', 'keywords', { unique: false, multiEntry: true });
          console.log('Created METADATA store');
        }

        // Store для chunks
        if (!db.objectStoreNames.contains(STORES.CHUNKS)) {
          const chunksStore = db.createObjectStore(STORES.CHUNKS, { keyPath: 'id' });
          chunksStore.createIndex('sourceId', 'sourceId', { unique: false });
          chunksStore.createIndex('chunkType', 'chunkType', { unique: false });
          console.log('Created CHUNKS store');
        }

        // Store для чатов
        if (!db.objectStoreNames.contains(STORES.CHATS)) {
          const chatsStore = db.createObjectStore(STORES.CHATS, { keyPath: 'id' });
          chatsStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
          chatsStore.createIndex('department', 'department', { unique: false });
          console.log('Created CHATS store');
        }

        // Store для настроек
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
          console.log('Created SETTINGS store');
        }
      };
    });

    return this.initPromise;
  }

  // === DOCUMENTS CRUD ===

  /**
   * Сохранить документ
   */
  async saveDocument(doc: Source): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    const transaction = this.db.transaction([STORES.DOCUMENTS, STORES.METADATA], 'readwrite');

    // Сохранить полный документ
    transaction.objectStore(STORES.DOCUMENTS).put(doc);

    // Сохранить метаданные для индекса
    const metadata: DocumentMetadata = {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      citation: doc.citation,
      keywords: this.extractKeywords(doc),
      fileSize: new Blob([JSON.stringify(doc)]).size,
      lastUpdated: new Date().toISOString()
    };
    transaction.objectStore(STORES.METADATA).put(metadata);

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Получить документ по ID
   */
  async getDocument(id: string): Promise<Source | null> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.DOCUMENTS, 'readonly');
      const request = transaction.objectStore(STORES.DOCUMENTS).get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получить все документы
   */
  async getAllDocuments(): Promise<Source[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.DOCUMENTS, 'readonly');
      const request = transaction.objectStore(STORES.DOCUMENTS).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получить метаданные всех документов (быстрая операция)
   */
  async getDocumentMetadata(): Promise<DocumentMetadata[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.METADATA, 'readonly');
      const request = transaction.objectStore(STORES.METADATA).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Поиск документов по ключевым словам
   */
  async searchDocuments(query: string): Promise<DocumentMetadata[]> {
    if (!this.db) throw new Error('DB not initialized');

    const metadata = await this.getDocumentMetadata();
    const lowerQuery = query.toLowerCase();

    // Простой keyword search
    return metadata.filter(doc =>
      doc.title.toLowerCase().includes(lowerQuery) ||
      doc.citation.toLowerCase().includes(lowerQuery) ||
      doc.keywords.some((kw: string) => kw.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Удалить документ
   */
  async deleteDocument(id: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    const transaction = this.db.transaction([STORES.DOCUMENTS, STORES.METADATA, STORES.CHUNKS], 'readwrite');

    transaction.objectStore(STORES.DOCUMENTS).delete(id);
    transaction.objectStore(STORES.METADATA).delete(id);

    // Удалить все chunks этого документа
    const chunksIndex = transaction.objectStore(STORES.CHUNKS).index('sourceId');
    const chunksRequest = chunksIndex.openCursor(IDBKeyRange.only(id));

    chunksRequest.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // === BULK OPERATIONS ===

  /**
   * Массовый импорт документов
   */
  async bulkImportDocuments(documents: Source[], onProgress?: (current: number, total: number) => void): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    console.log(`Starting bulk import of ${documents.length} documents...`);

    for (let i = 0; i < documents.length; i++) {
      await this.saveDocument(documents[i]);

      if (onProgress && i % 5 === 0) {
        onProgress(i, documents.length);
      }
    }

    if (onProgress) {
      onProgress(documents.length, documents.length);
    }

    console.log('✅ Bulk import complete');
  }

  // === CHUNKS OPERATIONS ===

  /**
   * Сохранить chunk
   */
  async saveChunk(chunk: Chunk): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CHUNKS, 'readwrite');
      const request = transaction.objectStore(STORES.CHUNKS).put(chunk);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Сохранить несколько chunks
   */
  async saveChunks(chunks: Chunk[]): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    const transaction = this.db.transaction(STORES.CHUNKS, 'readwrite');
    const store = transaction.objectStore(STORES.CHUNKS);

    for (const chunk of chunks) {
      store.put(chunk);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Получить chunks по sourceId
   */
  async getChunksBySourceId(sourceId: string): Promise<Chunk[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CHUNKS, 'readonly');
      const index = transaction.objectStore(STORES.CHUNKS).index('sourceId');
      const request = index.getAll(sourceId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получить все chunks
   */
  async getAllChunks(): Promise<Chunk[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CHUNKS, 'readonly');
      const request = transaction.objectStore(STORES.CHUNKS).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Удалить все chunks для документа
   */
  async deleteChunksBySourceId(sourceId: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CHUNKS, 'readwrite');
      const store = transaction.objectStore(STORES.CHUNKS);
      const index = store.index('sourceId');
      const request = index.openCursor(IDBKeyRange.only(sourceId));

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => {
        console.log(`✅ Deleted chunks for source: ${sourceId}`);
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // === CHATS OPERATIONS ===

  /**
   * Сохранить чат
   */
  async saveChat(chat: ChatSession): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CHATS, 'readwrite');
      const request = transaction.objectStore(STORES.CHATS).put(chat);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Получить все чаты
   */
  async getAllChats(): Promise<ChatSession[]> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CHATS, 'readonly');
      const request = transaction.objectStore(STORES.CHATS).getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Удалить чат
   */
  async deleteChat(id: string): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORES.CHATS, 'readwrite');
      const request = transaction.objectStore(STORES.CHATS).delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // === HELPERS ===

  /**
   * Извлечение ключевых слов для поиска
   */
  private extractKeywords(doc: Source): string[] {
    const keywords = new Set<string>();

    // Из заголовка
    doc.title.split(/\s+/).forEach(word => {
      const cleaned = word.toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
      if (cleaned.length > 3) {
        keywords.add(cleaned);
      }
    });

    // Из citation
    keywords.add(doc.citation.toLowerCase());

    // Из типа
    keywords.add(doc.type.toLowerCase());

    return Array.from(keywords);
  }

  /**
   * Очистить все данные
   */
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('DB not initialized');

    const transaction = this.db.transaction(
      [STORES.DOCUMENTS, STORES.METADATA, STORES.CHUNKS, STORES.CHATS],
      'readwrite'
    );

    transaction.objectStore(STORES.DOCUMENTS).clear();
    transaction.objectStore(STORES.METADATA).clear();
    transaction.objectStore(STORES.CHUNKS).clear();
    transaction.objectStore(STORES.CHATS).clear();

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log('✅ IndexedDB cleared');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Получить статистику хранилища
   */
  async getStats(): Promise<{
    documentsCount: number;
    chunksCount: number;
    chatsCount: number;
  }> {
    if (!this.db) throw new Error('DB not initialized');

    const [documents, chunks, chats] = await Promise.all([
      this.getAllDocuments(),
      this.getAllChunks(),
      this.getAllChats()
    ]);

    return {
      documentsCount: documents.length,
      chunksCount: chunks.length,
      chatsCount: chats.length
    };
  }

  /**
   * Закрыть соединение с БД
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }

  /**
   * Импортировать документы из /public/data/documents/
   */
  async importFromPublicData(
    onProgress?: (current: number, total: number) => void
  ): Promise<number> {
    try {
      console.log('📥 Импорт документов из /public/data/...');

      // Загрузить индексный файл
      const indexResponse = await fetch('/data/documents-index.json');
      if (!indexResponse.ok) {
        console.warn('⚠️ Индексный файл не найден');
        return 0;
      }

      const index: any[] = await indexResponse.json();
      console.log(`📋 Найдено документов в индексе: ${index.length}`);

      let imported = 0;

      // Загрузить каждый документ
      for (let i = 0; i < index.length; i++) {
        const docMeta = index[i];

        try {
          const docResponse = await fetch(`/data/documents/${docMeta.id}.json`);
          if (!docResponse.ok) {
            console.warn(`⚠️ Документ ${docMeta.id} не найден`);
            continue;
          }

          const doc: Source = await docResponse.json();

          // Сохранить в IndexedDB
          await this.saveDocument(doc);
          imported++;

          console.log(`✅ Импортирован: ${doc.title} (${docMeta.fileSize} байт)`);

          if (onProgress) {
            onProgress(i + 1, index.length);
          }
        } catch (err) {
          console.error(`❌ Ошибка импорта ${docMeta.id}:`, err);
        }
      }

      console.log(`✅ Импортировано документов: ${imported} из ${index.length}`);
      return imported;
    } catch (error) {
      console.error('❌ Ошибка импорта из /public/data/:', error);
      return 0;
    }
  }
}

// Singleton instance
export const indexedDB = new IndexedDBService();
