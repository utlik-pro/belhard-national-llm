/**
 * Migration Service
 *
 * Миграция данных из localStorage в IndexedDB при первом запуске
 */

import { indexedDB } from './indexedDBService';
import { MOCK_SOURCES } from '../constants';
import { Source, ChatSession } from '../types';

export interface MigrationProgress {
  step: string;
  current: number;
  total: number;
  percentage: number;
}

class MigrationService {
  /**
   * Проверка: нужна ли миграция
   */
  async needsMigration(): Promise<boolean> {
    const stats = await indexedDB.getStats();

    // Если в IndexedDB уже есть документы, миграция не нужна
    if (stats.documentsCount > 0) {
      return false;
    }

    // Проверить localStorage
    const lsSources = localStorage.getItem('belhard_sources');
    const lsChats = localStorage.getItem('belhard_chats');

    // Миграция нужна, если есть данные в localStorage
    return !!(lsSources || lsChats);
  }

  /**
   * Выполнить миграцию из localStorage в IndexedDB
   */
  async migrate(onProgress?: (progress: MigrationProgress) => void): Promise<void> {
    console.log('🔄 Starting migration from localStorage to IndexedDB...');

    try {
      // Шаг 1: Миграция источников
      onProgress?.({
        step: 'Миграция источников данных...',
        current: 0,
        total: 100,
        percentage: 0
      });

      const lsSources = localStorage.getItem('belhard_sources');
      let sources: Source[] = [];

      if (lsSources) {
        try {
          sources = JSON.parse(lsSources);
          console.log(`Found ${sources.length} sources in localStorage`);
        } catch (e) {
          console.error('Failed to parse localStorage sources:', e);
          sources = [];
        }
      }

      // Если нет источников в localStorage, использовать MOCK_SOURCES
      if (sources.length === 0) {
        sources = MOCK_SOURCES;
        console.log(`Using ${MOCK_SOURCES.length} MOCK_SOURCES`);
      }

      // Импорт источников в IndexedDB
      await indexedDB.bulkImportDocuments(sources, (current, total) => {
        onProgress?.({
          step: `Импорт документов (${current}/${total})...`,
          current,
          total,
          percentage: Math.round((current / total) * 50) // 0-50%
        });
      });

      console.log(`✅ Migrated ${sources.length} sources to IndexedDB`);

      // Шаг 2: Миграция чатов
      onProgress?.({
        step: 'Миграция истории чатов...',
        current: 50,
        total: 100,
        percentage: 50
      });

      const lsChats = localStorage.getItem('belhard_chats');
      let chats: ChatSession[] = [];

      if (lsChats) {
        try {
          chats = JSON.parse(lsChats);
          console.log(`Found ${chats.length} chats in localStorage`);
        } catch (e) {
          console.error('Failed to parse localStorage chats:', e);
        }
      }

      // Импорт чатов в IndexedDB
      for (let i = 0; i < chats.length; i++) {
        await indexedDB.saveChat(chats[i]);

        if (onProgress && i % 5 === 0) {
          onProgress({
            step: `Импорт чатов (${i + 1}/${chats.length})...`,
            current: 50 + Math.round((i / chats.length) * 40),
            total: 100,
            percentage: 50 + Math.round((i / chats.length) * 40) // 50-90%
          });
        }
      }

      console.log(`✅ Migrated ${chats.length} chats to IndexedDB`);

      // Шаг 3: Финализация
      onProgress?.({
        step: 'Завершение миграции...',
        current: 90,
        total: 100,
        percentage: 90
      });

      // Пометить миграцию как завершенную
      localStorage.setItem('belhard_migrated_to_indexeddb', 'true');

      onProgress?.({
        step: 'Миграция завершена!',
        current: 100,
        total: 100,
        percentage: 100
      });

      console.log('✅ Migration completed successfully');

    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }
  }

  /**
   * Очистить старые данные из localStorage (опционально)
   */
  clearLegacyStorage(): void {
    try {
      localStorage.removeItem('belhard_sources');
      localStorage.removeItem('belhard_chats');
      console.log('✅ Cleared legacy localStorage data');
    } catch (e) {
      console.error('Failed to clear localStorage:', e);
    }
  }

  /**
   * Проверка: была ли миграция выполнена ранее
   */
  wasMigrated(): boolean {
    return localStorage.getItem('belhard_migrated_to_indexeddb') === 'true';
  }
}

export const migrationService = new MigrationService();
