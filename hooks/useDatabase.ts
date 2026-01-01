/**
 * useDatabase Hook
 *
 * Управляет инициализацией IndexedDB, миграцией данных и загрузкой документов.
 */

import { useState, useEffect, useCallback } from 'react';
import { Source, ChatSession } from '../types';
import { indexedDB } from '../services/indexedDBService';
import { migrationService, MigrationProgress } from '../services/migrationService';
import { chunkingService } from '../services/chunkingService';
import { INITIAL_CHATS, MOCK_SOURCES } from '../constants';

export interface DBInitProgress {
  step: string;
  current: number;
  total: number;
  percentage: number;
}

export interface UseDatabaseResult {
  isDBReady: boolean;
  dbInitProgress: DBInitProgress | null;
  sources: Source[];
  setSources: React.Dispatch<React.SetStateAction<Source[]>>;
  chatHistory: ChatSession[];
  setChatHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>;
  saveDocument: (doc: Source) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;
  saveChat: (chat: ChatSession) => Promise<void>;
  deleteChat: (id: string) => Promise<void>;
}

export function useDatabase(): UseDatabaseResult {
  const [isDBReady, setIsDBReady] = useState(false);
  const [dbInitProgress, setDbInitProgress] = useState<DBInitProgress | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);

  // Initialize database
  useEffect(() => {
    async function initializeDatabase() {
      try {
        // Step 1: Initialize IndexedDB
        setDbInitProgress({
          step: 'Инициализация базы данных...',
          current: 0,
          total: 100,
          percentage: 0
        });

        await indexedDB.init();
        console.log('✅ IndexedDB initialized');

        // Step 2: Check if migration needed
        setDbInitProgress({
          step: 'Проверка миграции...',
          current: 20,
          total: 100,
          percentage: 20
        });

        const needsMigration = await migrationService.needsMigration();

        if (needsMigration) {
          console.log('🔄 Starting migration...');
          setDbInitProgress({
            step: 'Миграция данных...',
            current: 30,
            total: 100,
            percentage: 30
          });

          await migrationService.migrate((progress: MigrationProgress) => {
            const percentage = 30 + Math.round((progress.current / progress.total) * 30);
            setDbInitProgress({
              step: `Миграция: ${progress.step}`,
              current: progress.current,
              total: progress.total,
              percentage
            });
          });
          console.log('✅ Migration complete');
        }

        // Step 3: Load documents
        setDbInitProgress({
          step: 'Загрузка документов...',
          current: 60,
          total: 100,
          percentage: 60
        });

        let allDocuments = await indexedDB.getAllDocuments();
        console.log(`📚 Loaded ${allDocuments.length} documents from IndexedDB`);

        // Import from public data if needed
        if (allDocuments.length < 15) {
          console.log('📥 Checking /public/data/ for new documents...');

          setDbInitProgress({
            step: 'Импорт новых документов...',
            current: 70,
            total: 100,
            percentage: 70
          });

          const imported = await indexedDB.importFromPublicData((current, total) => {
            const percentage = 70 + Math.round((current / total) * 15);
            setDbInitProgress({
              step: `Импорт документов (${current}/${total})...`,
              current,
              total,
              percentage
            });
          });

          if (imported > 0) {
            console.log(`✅ Imported ${imported} new documents`);
            allDocuments = await indexedDB.getAllDocuments();
          }
        }

        setSources(allDocuments);
        console.log(`✅ Total documents: ${allDocuments.length}`);

        // Step 4: Generate chunks
        const existingChunks = await indexedDB.getAllChunks();
        console.log(`📊 Existing chunks in IndexedDB: ${existingChunks.length}`);

        // Find documents that don't have any chunks
        const chunkedDocIds = new Set(existingChunks.map(c => c.sourceId));
        const docsWithoutChunks = allDocuments.filter(doc => !chunkedDocIds.has(doc.id));

        if (docsWithoutChunks.length > 0) {
          console.log(`🔄 Generating chunks for ${docsWithoutChunks.length} documents...`);

          // Batch processing - собираем все chunks, потом сохраняем разом
          const allNewChunks: any[] = [];

          for (let i = 0; i < docsWithoutChunks.length; i++) {
            const doc = docsWithoutChunks[i];
            const chunks = chunkingService.chunkDocument(doc);

            // Обновляем прогресс
            const percentage = 85 + Math.round((i / docsWithoutChunks.length) * 5);
            setDbInitProgress({
              step: `Генерация chunks (${i + 1}/${docsWithoutChunks.length})...`,
              current: i + 1,
              total: docsWithoutChunks.length,
              percentage
            });

            if (chunks.length > 0) {
              allNewChunks.push(...chunks);
              console.log(`   ✅ ${doc.citation}: ${chunks.length} chunks`);
            } else {
              console.warn(`   ⚠️ ${doc.citation}: no chunks created`);
            }
          }

          // Batch save - одна транзакция вместо тысяч
          if (allNewChunks.length > 0) {
            setDbInitProgress({
              step: `Сохранение ${allNewChunks.length} chunks...`,
              current: docsWithoutChunks.length,
              total: docsWithoutChunks.length,
              percentage: 89
            });

            await indexedDB.saveChunks(allNewChunks);
            console.log(`✅ Saved ${allNewChunks.length} chunks in batch`);
          }
        } else {
          console.log(`✅ All ${allDocuments.length} documents have chunks`);
        }

        // Step 5: Load chats
        setDbInitProgress({
          step: 'Загрузка истории чатов...',
          current: 90,
          total: 100,
          percentage: 90
        });

        const allChats = await indexedDB.getAllChats();
        setChatHistory(allChats.length > 0 ? allChats : INITIAL_CHATS);
        console.log(`✅ Loaded ${allChats.length} chats from IndexedDB`);

        // Step 6: Finalize
        setDbInitProgress({
          step: 'Готово!',
          current: 100,
          total: 100,
          percentage: 100
        });

        setTimeout(() => {
          setIsDBReady(true);
          console.log('✅ Database is ready');
        }, 500);

      } catch (error) {
        console.error('❌ Failed to initialize database:', error);

        // Fallback to localStorage/MOCK_SOURCES
        console.warn('⚠️ Falling back to localStorage...');

        try {
          const lsSources = localStorage.getItem('belhard_sources');
          const lsChats = localStorage.getItem('belhard_chats');

          setSources(lsSources ? JSON.parse(lsSources) : MOCK_SOURCES);
          setChatHistory(lsChats ? JSON.parse(lsChats) : INITIAL_CHATS);
        } catch {
          setSources(MOCK_SOURCES);
          setChatHistory(INITIAL_CHATS);
        }

        setIsDBReady(true);
      }
    }

    initializeDatabase();
  }, []);

  // Save document and create chunks for RAG
  const saveDocument = useCallback(async (doc: Source) => {
    // 1. Save document to IndexedDB
    await indexedDB.saveDocument(doc);

    // 2. Delete old chunks for this document (in case of update)
    await indexedDB.deleteChunksBySourceId(doc.id);

    // 3. Create new chunks for the document (for RAG search)
    console.log(`📦 Creating chunks for document: ${doc.citation}`);
    const chunks = chunkingService.chunkDocument(doc);

    if (chunks.length > 0) {
      await indexedDB.saveChunks(chunks);
      console.log(`✅ Created ${chunks.length} chunks for ${doc.citation}`);
    } else {
      console.warn(`⚠️ No chunks created for ${doc.citation} - document may be empty or have no structure`);
    }

    // 4. Update local state
    setSources(prev => {
      const exists = prev.find(s => s.id === doc.id);
      if (exists) {
        return prev.map(s => s.id === doc.id ? doc : s);
      }
      return [doc, ...prev];
    });
  }, []);

  // Delete document
  const deleteDocument = useCallback(async (id: string) => {
    await indexedDB.deleteDocument(id);
    setSources(prev => prev.filter(s => s.id !== id));
  }, []);

  // Save chat
  const saveChat = useCallback(async (chat: ChatSession) => {
    // Strip fullContent from sources to save space
    const chatToSave = {
      ...chat,
      messages: chat.messages?.map(msg => ({
        ...msg,
        sources: msg.sources?.map(s => ({
          id: s.id,
          title: s.title,
          type: s.type,
          citation: s.citation,
          url: s.url,
          preview: s.preview
        }))
      }))
    };
    await indexedDB.saveChat(chatToSave as ChatSession);
  }, []);

  // Delete chat
  const deleteChat = useCallback(async (id: string) => {
    await indexedDB.deleteChat(id);
    setChatHistory(prev => prev.filter(c => c.id !== id));
  }, []);

  return {
    isDBReady,
    dbInitProgress,
    sources,
    setSources,
    chatHistory,
    setChatHistory,
    saveDocument,
    deleteDocument,
    saveChat,
    deleteChat
  };
}
