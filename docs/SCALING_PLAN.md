# План масштабирования Belhard AI до 100 НПА РБ

## Цель
Масштабировать систему с 10 до 100 нормативных правовых актов РБ с минимальными изменениями архитектуры (frontend-only).

## Требования
- **Объем**: 50-100 документов НПА РБ
- **Архитектура**: Frontend-only (без backend)
- **Источник данных**: Автоматический парсинг pravo.by через Node.js скрипт
- **Сроки**: 1-2 недели
- **Приоритет**: Скорость реализации

## Текущие ограничения
- localStorage лимит: 5-10 MB → переполнится при 60+ документах
- constants.ts: 148 KB (10 документов) → раздуется до 1.5 MB при 100 документах
- RAG: Context Stuffing - все 20 источников без фильтрации
- Нет chunking, нет semantic search
- Медленная загрузка при большом объеме данных

## Архитектурное решение

### 1. Хранение данных: IndexedDB вместо localStorage
**Почему**: IndexedDB поддерживает 100+ MB и асинхронную загрузку

**Реализация**:
- Создать `/services/indexedDBService.ts` с object stores:
  - `documents` - полные документы с fullContent
  - `metadata` - индекс для быстрого поиска
  - `chunks` - разбитые части документов
  - `chats` - история чатов
- Миграция из localStorage при первом запуске
- Lazy loading: загружать только metadata при старте, fullContent по требованию

### 2. Парсинг НПА: Node.js скрипт для pravo.by
**Цель**: Автоматизировать загрузку документов из официального портала

**Реализация**:
- Создать `/scripts/parser/pravo-by-parser.js`:
  - Puppeteer для обхода защиты
  - Cheerio для парсинга HTML
  - Извлечение структуры: РАЗДЕЛ → ГЛАВА → Статья → Пункты
- Выходные файлы: `/public/data/documents/*.json` (по одному на НПА)
- Индексный файл: `/public/data/documents-index.json` (метаданные всех документов)

**Целевые документы** (топ-50 НПА РБ):
- Кодексы: Трудовой, Налоговый, Гражданский, Уголовный, Административный
- Декреты: №8 (ПВТ), №7, №3
- Законы: О защите персданных, Об информации, Об авторском праве
- Постановления СовМина: №713, №40

### 3. Улучшение RAG: Keyword-based фильтрация
**Проблема**: Отправка всех 100 документов в Gemini неэффективна

**Реализация**:
- Создать `/services/searchService.ts`:
  - Keyword extraction из запроса пользователя
  - Стемминг для русского языка
  - Scoring по релевантности (citation > title > content)
  - Department-specific keywords (HR, Legal, Accounting, IT)
- **Результат**: Отправлять только топ-5-10 релевантных документов вместо всех 100

### 4. Document Chunking
**Цель**: Улучшить точность RAG путем разбиения документов на части

**Реализация**:
- Создать `/services/chunkingService.ts`:
  - Chunk по статьям/главам (не целый документ)
  - Chunk format: `{ id, sourceId, path, content, chunkType }`
  - Хранение chunks в IndexedDB
- **Результат**: Отправлять топ-10 релевантных chunks вместо полных документов

### 5. Оптимизация загрузки
- Lazy loading документов (только metadata при старте)
- Предзагрузка топ-10 документов в фоне
- Compression JSON файлов (gzip: 40-60% экономии)
- Loading screen с прогресс-баром

### 6. Рефакторинг constants.ts
**Цель**: Уменьшить размер файла с 148 KB до 2 KB

**Изменения**:
- Удалить MOCK_SOURCES (переместить в IndexedDB)
- Оставить только DEPARTMENTS и INITIAL_CHATS
- Все источники загружаются из IndexedDB при старте

## План реализации (2 недели)

### Неделя 1: Инфраструктура и парсинг данных

#### День 1-3: Парсер pravo.by
**Файлы**:
- `/scripts/parser/pravo-by-parser.js` - новый файл

**Задачи**:
1. Setup Puppeteer + Cheerio
2. Определить селекторы для pravo.by (section, chapter, article)
3. Реализовать парсинг структуры документов
4. Генерация JSON файлов в `/public/data/documents/`
5. Создание индексного файла `documents-index.json`
6. Тестирование на 5 документах

**Результат**: 50-100 JSON файлов с НПА РБ в `/public/data/`

#### День 4-5: IndexedDB сервис
**Файлы**:
- `/services/indexedDBService.ts` - новый файл
- `/services/migrationService.ts` - новый файл

**Задачи**:
1. Создать IndexedDBService с 4 object stores
2. Реализовать CRUD операции (saveDocument, getDocument, getAllDocuments)
3. Реализовать bulk import из JSON
4. Реализовать миграцию из localStorage
5. Тестирование с 100 документами

**Результат**: Работающее хранилище в IndexedDB

#### День 6-7: Интеграция в App.tsx
**Файлы**:
- `/App.tsx` - модификация
- `/constants.ts` - модификация (удалить MOCK_SOURCES)

**Задачи**:
1. Заменить localStorage на indexedDB в App.tsx
2. Реализовать lazy loading метаданных при старте
3. Добавить loading screen с прогрессом
4. Миграция существующих данных
5. Уменьшить constants.ts до 2 KB

**Результат**: Приложение работает с IndexedDB

---

### Неделя 2: RAG оптимизация и UI

#### День 8-9: Keyword-based поиск
**Файлы**:
- `/services/searchService.ts` - новый файл
- `/services/mockApiService.ts` - модификация

**Задачи**:
1. Реализовать SearchService с keyword extraction
2. Реализовать scoring по релевантности
3. Добавить department-specific filtering
4. Интегрировать в mockApiService.streamResponse()
5. Тестирование: топ-5 документов вместо всех 100

**Результат**: RAG отправляет только релевантные источники

#### День 10-11: Document chunking
**Файлы**:
- `/services/chunkingService.ts` - новый файл
- `/services/indexedDBService.ts` - добавить chunks store
- `/scripts/generate-chunks.ts` - новый файл

**Задачи**:
1. Реализовать ChunkingService (chunk по статьям)
2. Добавить chunks object store в IndexedDB
3. Создать скрипт для генерации chunks из документов
4. Интегрировать в mockApiService (использовать chunks вместо fullContent)
5. Тестирование: топ-10 chunks вместо 5 документов

**Результат**: RAG работает с гранулярными chunks

#### День 12: Lazy loading и оптимизация
**Файлы**:
- `/services/lazyLoadService.ts` - новый файл
- `/App.tsx` - модификация
- `/scripts/compress-documents.js` - новый файл

**Задачи**:
1. Реализовать LazyLoadService с кэшированием
2. Предзагрузка топ-10 документов
3. Compression JSON файлов (gzip)
4. Оптимизация первой загрузки (< 3 секунд)

**Результат**: Быстрая загрузка приложения

#### День 13-14: UI улучшения и тестирование
**Файлы**:
- `/components/Sidebar.tsx` - добавить поиск по документам
- `/components/DocumentViewer.tsx` - улучшить навигацию по chunks
- `/App.tsx` - добавить loading screen

**Задачи**:
1. Loading screen с прогресс-баром
2. Поиск документов в Sidebar (UI)
3. Улучшенный DocumentViewer с навигацией по разделам
4. End-to-end тестирование с 100 документами
5. Performance profiling

**Результат**: Production-ready система

---

## Критические файлы для изменения

### Новые файлы (создать):
1. `/services/indexedDBService.ts` - главный сервис хранения
2. `/services/searchService.ts` - keyword-based поиск
3. `/services/chunkingService.ts` - разбиение документов
4. `/services/lazyLoadService.ts` - ленивая загрузка
5. `/services/migrationService.ts` - миграция из localStorage
6. `/scripts/parser/pravo-by-parser.js` - парсер НПА
7. `/scripts/import-documents.ts` - импорт JSON в IndexedDB
8. `/scripts/compress-documents.js` - compression
9. `/scripts/generate-chunks.ts` - генерация chunks

### Модифицируемые файлы:
1. `/App.tsx` - интеграция IndexedDB, loading screen
2. `/services/mockApiService.ts` - интеграция search + chunking
3. `/constants.ts` - удаление MOCK_SOURCES (148 KB → 2 KB)
4. `/types.ts` - добавить тип Chunk
5. `/components/Sidebar.tsx` - поиск по документам
6. `/package.json` - добавить puppeteer, cheerio

### Новая структура данных:
```
/public/data/
  ├── documents-index.json (100 KB)
  └── documents/
      ├── TK_RB.json (150 KB)
      ├── NK_RB.json (200 KB)
      └── ... (98 других)
```

---

## Технические метрики (ожидаемые)

### Performance
- **Загрузка приложения**: < 3 сек (vs 8+ сек с 100 документами в constants.ts)
- **Поиск документов**: < 100ms (keyword search IndexedDB)
- **RAG качество**: +30% релевантности (chunking + фильтрация)
- **Gemini API tokens**: -90% (10 chunks вместо 100 документов)

### Storage
- **IndexedDB**: ~10 MB (100 документов)
- **localStorage**: 0 MB (освобожден)
- **constants.ts**: 2 KB (vs 148 KB)

### Scalability
- **Текущий лимит**: 100 документов
- **Потенциал расширения**: 500+ документов (с дополнительной оптимизацией)

---

## Риски и митигация

### Риск 1: Парсинг pravo.by может быть заблокирован
**Митигация**:
- Использовать Puppeteer с эмуляцией браузера
- Добавить задержки между запросами (3-5 сек)
- Fallback: ручная загрузка JSON файлов

### Риск 2: IndexedDB не поддерживается в старых браузерах
**Митигация**:
- Проверка `window.indexedDB` при старте
- Fallback на localStorage с ограничением 20 документов
- Warning для пользователя об обновлении браузера

### Риск 3: Keyword search недостаточно точен
**Митигация**:
- Department-specific keywords для улучшения релевантности
- Hybrid approach: keywords + частотный анализ
- Возможность добавить embeddings позже (transformers.js)

### Риск 4: Структура pravo.by может измениться
**Митигация**:
- Версионирование парсера (v1, v2)
- Fallback на старые JSON файлы
- Логирование ошибок парсинга для ручной коррекции

---

## Альтернативные подходы (отклонены)

### Альтернатива 1: Embeddings на frontend (transformers.js)
**Почему отклонено**:
- +50 MB размер модели
- Медленная инференция в браузере
- Keyword search достаточен для юридических текстов

### Альтернатива 2: Backend API (Node.js + PostgreSQL + pgvector)
**Почему отклонено**:
- Требование пользователя: frontend-only
- Увеличивает сложность deployment
- Keyword search + chunking решает задачу без backend

### Альтернатива 3: Ручная загрузка PDF через UI
**Почему отклонено**:
- Требует PDF parser (pdf.js или backend)
- Трудозатратно для 100 документов
- Автоматический парсинг эффективнее

---

## Следующие шаги после реализации

### Фаза 2 (опционально, если нужно > 100 документов):
1. Добавить embeddings (OpenAI API или transformers.js)
2. Реализовать vector search для семантического поиска
3. Backend API для централизованного хранения
4. Автоматическое обновление НПА (webhook или cron job)

### Фаза 3 (advanced features):
1. Multi-modal RAG (таблицы, изображения из PDF)
2. Citation verification (проверка актуальности ссылок)
3. Change tracking (версионирование НПА)
4. Query expansion (автодополнение запросов)

---

## Критерии успеха

- ✅ Система работает с 100 НПА без тормозов
- ✅ Загрузка приложения < 5 секунд
- ✅ RAG находит релевантные источники (топ-5 из 100)
- ✅ Легко добавлять новые НПА через `npm run parse-documents`
- ✅ Автоматическое обновление данных через скрипт
- ✅ Размер constants.ts < 10 KB

---

## Команды для разработчика

```bash
# Установка зависимостей для парсера
npm install puppeteer cheerio

# Парсинг документов с pravo.by
node scripts/parser/pravo-by-parser.js

# Генерация chunks из документов
npm run generate-chunks

# Compression JSON файлов
node scripts/compress-documents.js

# Импорт в IndexedDB (автоматически при первом запуске)
# Или вручную через DevTools Console:
# await indexedDB.init();
# await importDocumentsFromPublic();

# Очистка IndexedDB для отладки
# localStorage.clear(); indexedDB.clearAll();
```

---

**Дата создания плана**: 2025-12-12
**Версия**: 1.0
**Оценка времени**: 10-14 рабочих дней
**Статус**: Готов к реализации
