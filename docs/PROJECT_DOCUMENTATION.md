# Belhard AI - Национальная LLM: Полная документация проекта

**Версия:** 2.0.0
**Дата:** Декабрь 2025
**Автор:** Дмитрий Утлик
**Компания:** Belhard Group & НАН РБ

---

## Оглавление

1. [Обзор проекта](#1-обзор-проекта)
2. [Технологический стек](#2-технологический-стек)
3. [Структура проекта](#3-структура-проекта)
4. [Компоненты React](#4-компоненты-react)
5. [Сервисы](#5-сервисы)
6. [LangGraph мультиагентная система](#6-langgraph-мультиагентная-система)
7. [Система хранения данных](#7-система-хранения-данных)
8. [RAG Pipeline](#8-rag-pipeline)
9. [Система цитирования](#9-система-цитирования)
10. [Парсер документов](#10-парсер-документов)
11. [Типы и константы](#11-типы-и-константы)
12. [Основные процессы](#12-основные-процессы)
13. [Архитектурная диаграмма](#13-архитектурная-диаграмма)

---

## 1. Обзор проекта

### Назначение

**Belhard AI** — корпоративный чат-бот для белорусских компаний, специализирующийся на консультировании по белорусскому законодательству. Приложение предоставляет:

- **5 специализированных ассистентов** по отделам (HR, Бухгалтерия, Юридический, IT, Общий)
- **RAG (Retrieval-Augmented Generation)** над 50-100 нормативно-правовыми актами РБ
- **Интерактивные цитаты** с мгновенным просмотром документов
- **Полностью клиентское приложение** без бэкенда

### Ключевые особенности

| Функция | Описание |
|---------|----------|
| Мультиагентная система | LangGraph оркестрация нескольких AI-агентов |
| RAG Pipeline | Chunk-based поиск по законодательству |
| Streaming ответы | Посимвольный вывод с эффектом "печатной машинки" |
| Key Rotation | Автоматическая ротация API ключей при rate limits |
| IndexedDB | Хранение 100+ документов без бэкенда |
| Интерактивные цитаты | Click → preview, Double-click → full viewer |

---

## 2. Технологический стек

### Frontend

| Технология | Версия | Назначение |
|------------|--------|------------|
| React | 19.2.1 | UI фреймворк |
| TypeScript | 5.8.2 | Статическая типизация |
| Vite | 6.2.0 | Сборщик и dev-сервер |
| Tailwind CSS | - | Утилитарные стили |
| Lucide React | - | Иконки (500+) |

### AI & ML

| Технология | Версия | Назначение |
|------------|--------|------------|
| @google/genai | 1.32.0 | Google Gemini API |
| @langchain/langgraph | 1.0.4 | Мультиагентная оркестрация |
| OpenAI SDK | - | Fallback модель |

### Хранение данных

| Технология | Назначение |
|------------|------------|
| IndexedDB | Основное хранилище (документы, chunks, чаты) |
| localStorage | Legacy (миграция в IndexedDB) |

### Инструменты парсинга

| Технология | Назначение |
|------------|------------|
| Puppeteer | Браузерная автоматизация |
| Cheerio | HTML парсинг |

---

## 3. Структура проекта

```
bh-national-llm/
├── components/                 # React компоненты
│   ├── App.tsx                # Главный компонент (775 строк)
│   ├── Sidebar.tsx            # Боковая панель (500 строк)
│   ├── ChatMessage.tsx        # Сообщения чата (650 строк)
│   ├── ChatArea.tsx           # Контейнер сообщений
│   ├── ChatInput.tsx          # Поле ввода
│   ├── AppHeader.tsx          # Верхний header
│   ├── DocumentViewer.tsx     # Просмотр документов (400 строк)
│   ├── DocumentEditor.tsx     # Редактор документов
│   ├── SettingsModal.tsx      # Настройки
│   ├── LoginScreen.tsx        # Экран входа
│   ├── HelpPage.tsx           # Страница помощи
│   ├── AppLoadingScreen.tsx   # Загрузочный экран
│   ├── SourceCard.tsx         # Карточка документа
│   ├── ErrorBoundary.tsx      # Обработка ошибок
│   └── LogoutConfirmModal.tsx # Подтверждение выхода
│
├── services/                   # Бизнес-логика
│   ├── mockApiService.ts      # Gemini API интеграция (550 строк)
│   ├── searchService.ts       # Поиск документов (250 строк)
│   ├── indexedDBService.ts    # IndexedDB операции (400 строк)
│   ├── chunkingService.ts     # Разбиение документов (275 строк)
│   ├── migrationService.ts    # Миграция данных (150 строк)
│   └── langgraph/             # Мультиагентная система
│       ├── multiAgentGraph.ts # Основной граф (150 строк)
│       ├── state.ts           # Определение состояния
│       ├── routerAgent.ts     # Маршрутизатор запросов
│       ├── retrievalAgent.ts  # RAG retrieval
│       ├── departmentAgents.ts # Агенты отделов (400 строк)
│       ├── synthesizerAgent.ts # Синтезатор ответов
│       ├── hallucinationChecker.ts # Проверка галлюцинаций
│       └── index.ts           # Экспорты
│
├── hooks/                      # React хуки
│   ├── useChat.ts             # Управление чатами
│   └── useDatabase.ts         # Операции с БД
│
├── scripts/parser/             # Парсер документов
│   └── pravo-by-parser.js     # Puppeteer парсер (700 строк)
│
├── shims/                      # Браузерные полифиллы
│   └── async_hooks.ts         # Для LangGraph
│
├── public/data/                # Статические данные
│   ├── documents/             # JSON документы
│   └── documents-index.json   # Индекс документов
│
├── types.ts                    # TypeScript типы
├── constants.ts                # Константы (3900 строк)
├── index.css                   # Глобальные стили
├── vite.config.ts              # Конфигурация Vite
└── docs/                       # Документация
    ├── SCALING_PLAN.md        # План масштабирования
    └── PROJECT_DOCUMENTATION.md # Этот файл
```

---

## 4. Компоненты React

### 4.1 App.tsx — Главный компонент

**Размер:** ~775 строк
**Назначение:** Управление состоянием всего приложения

#### Состояние приложения

```typescript
// Аутентификация
const [isAuthenticated, setIsAuthenticated] = useState(false)
const [userEmail, setUserEmail] = useState('')

// Инициализация БД
const [isDBInitialized, setIsDBInitialized] = useState(false)
const [dbProgress, setDbProgress] = useState({ step: '', percentage: 0 })

// Чаты
const [chats, setChats] = useState<ChatSession[]>([])
const [selectedChatId, setSelectedChatId] = useState<string>('')
const [messages, setMessages] = useState<Message[]>([])

// UI
const [isSidebarOpen, setIsSidebarOpen] = useState(false)
const [isGenerating, setIsGenerating] = useState(false)
const [isMultiAgentMode, setIsMultiAgentMode] = useState(false)
```

#### Основные функции

| Функция | Описание |
|---------|----------|
| `initializeDatabase()` | Инициализация IndexedDB, миграция, загрузка документов |
| `generateAIResponse()` | Генерация ответа (Gemini или LangGraph) |
| `handleSendMessage()` | Отправка сообщения пользователя |
| `handleEditMessage()` | Редактирование сообщения с регенерацией |
| `handleNewChat()` | Создание новой сессии чата |
| `handleDeleteChat()` | Удаление чата с автопереключением |
| `handleSaveSource()` | Сохранение документа с автоматическим chunking |

#### Логика рендеринга

```
if (!isDBInitialized) → AppLoadingScreen
else if (!isAuthenticated) → LoginScreen
else if (showHelp) → HelpPage
else → Main UI (Sidebar + ChatArea + ChatInput)
```

---

### 4.2 Sidebar.tsx — Боковая панель

**Размер:** ~500 строк
**Назначение:** Навигация по чатам и базе знаний

#### Два режима работы

| Режим | viewMode | Функционал |
|-------|----------|------------|
| Чаты | `'chats'` | Список чатов, создание, архивирование, удаление |
| База знаний | `'knowledge'` | Список документов, поиск, редактирование |

#### Контекстное меню чата

- Переименовать (inline input)
- Архивировать / Восстановить
- Удалить (с подтверждением)

---

### 4.3 ChatMessage.tsx — Сообщения чата

**Размер:** ~650 строк (самый сложный компонент)
**Назначение:** Отображение сообщений с интерактивными цитатами

#### Ключевые функции

```typescript
// Парсинг Markdown с заменой цитат на интерактивные компоненты
renderContentWithCitations(content: string)

// Извлечение контекста вокруг цитаты для поиска
extractCitationContext(text: string, citation: string): string

// Поиск локального контекста в нумерованных списках
getLocalContext(text: string, citation: string): string

// Маппинг цитаты на Source объект
findSourceByCitation(citation: string): Source | null
```

#### Интерактивные цитаты

| Действие | Результат |
|----------|-----------|
| Single click | Inline preview в сообщении |
| Double click | Открытие DocumentViewer с поиском |

#### Статусы генерации

```
thinking → searching → found → generating
```

---

### 4.4 DocumentViewer.tsx — Просмотр документов

**Размер:** ~400 строк
**Назначение:** Полнотекстовый поиск и просмотр документов

#### Умная система поиска

Поддерживаемые форматы:
- `Статья 16` — найти заголовок статьи
- `Статья 16 п1.20` — найти пункт внутри статьи
- `Параграф 5` — для инструкций
- `Раздел II` — для разделов

#### Функции

- Полнотекстовый поиск с `<mark>` подсветкой
- Auto-scroll к первому совпадению
- Fuzzy matching с нормализацией текста

---

### 4.5 Другие компоненты

| Компонент | Строк | Назначение |
|-----------|-------|------------|
| AppHeader.tsx | ~170 | Выбор отдела, профиль пользователя |
| ChatArea.tsx | ~60 | Контейнер сообщений с auto-scroll |
| ChatInput.tsx | ~120 | Поле ввода с auto-resize |
| DocumentEditor.tsx | ~180 | Форма создания/редактирования документа |
| SettingsModal.tsx | ~175 | Настройки (тема, язык, мультиагент) |
| LoginScreen.tsx | ~100 | Форма входа (mock auth) |
| HelpPage.tsx | ~300 | Документация с навигацией |
| AppLoadingScreen.tsx | ~50 | Splash-screen с progress bar |

---

## 5. Сервисы

### 5.1 mockApiService.ts — Интеграция с Gemini API

**Размер:** ~550 строк

#### Key Management

```typescript
class KeyManager {
  private keys: string[]
  private currentIndex: number

  rotate(): void      // Переключение на следующий ключ
  getCurrent(): string // Получение текущего ключа
}
```

**Использование:** `GEMINI_API_KEY="key1,key2,key3"`

#### Основная функция streamResponse()

```
1. Извлечение последнего user prompt
2. Сбор контекста из 3 последних сообщений
3. Загрузка chunks из IndexedDB
4. Поиск top-15 релевантных chunks
5. Конструирование context string
6. Отправка в Gemini API
7. Streaming ответа через callback
8. Извлечение использованных sources
```

#### System Instruction

```typescript
const systemInstruction = `
Ты - ${departmentConfig.name}...
Правила форматирования:
1. Пошаговый план с нумерацией (1. 2. 3.)
2. Цитаты ТОЛЬКО в конце пункта
3. Формат: "ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16"
4. НЕ использовать скобки вокруг цитат
...
`
```

#### Активная модель

```
OpenAI GPT-5 (gpt-5-2025-08-07) — основная модель
```

> **Примечание:** Gemini модели закомментированы в коде. При необходимости можно переключить на:
> - gemini-2.5-flash
> - gemini-2.0-flash-lite-preview
> - gemini-2.0-flash

---

### 5.2 searchService.ts — Поиск документов

**Размер:** ~250 строк

#### Алгоритм scoring

| Критерий | Вес |
|----------|-----|
| Citation match | +10 |
| Title match | +5 |
| Content match | +1 (макс +10) |
| Employee doc + employee query | +100 |
| Name/surname exact match | +200 |

#### Department-specific keywords

```typescript
const departmentKeywords = {
  hr: ['труд', 'отпуск', 'увольнение', 'сотрудник', ...],
  accounting: ['налог', 'бухгалтер', 'отчет', 'взнос', ...],
  legal: ['договор', 'право', 'закон', 'суд', ...],
  it: ['программа', 'защита', 'разработка', ...]
}
```

---

### 5.3 indexedDBService.ts — IndexedDB операции

**Размер:** ~400 строк

#### Структура базы данных

| Object Store | keyPath | Indices | Назначение |
|--------------|---------|---------|------------|
| documents | id | - | Полные документы |
| metadata | id | title, keywords | Быстрый поиск |
| chunks | id | sourceId | Части документов для RAG |
| chats | id | lastUpdated, department | История чатов |
| settings | key | - | Настройки |

#### API методы

```typescript
// Документы
saveDocument(doc: Source)
getAllDocuments(): Source[]
deleteDocument(id: string)

// Chunks
saveChunks(chunks: Chunk[])
getAllChunks(): Chunk[]
deleteChunksBySourceId(sourceId: string)

// Чаты
saveChat(chat: ChatSession)
getAllChats(): ChatSession[]
deleteChat(id: string)

// Импорт
importFromPublicData(progressCallback)
bulkImportDocuments(docs, progressCallback)
```

---

### 5.4 chunkingService.ts — Разбиение документов

**Размер:** ~275 строк

#### Алгоритм chunking

**Для структурированных документов:**
```
Document → Sections → Chapters → Articles → Chunks
```

**Chunk структура:**
```typescript
interface Chunk {
  id: string           // "TK_RB_S1_C1_A16"
  sourceId: string     // "TK_RB"
  citation: string     // "ТК РБ"
  path: string         // "РАЗДЕЛ I → ГЛАВА 1 → Статья 16"
  content: string      // Текст chunk'а
  chunkType: 'article' | 'chapter' | 'section'
}
```

**Для неструктурированных документов:**
- Каждая строка = отдельный chunk (для списков)
- Или весь документ = один chunk

---

### 5.5 migrationService.ts — Миграция данных

**Размер:** ~150 строк

#### Процесс миграции

```
1. needsMigration() — проверка необходимости
2. migrate() — выполнение:
   - 0-50%: Импорт sources из localStorage
   - 50-100%: Импорт чатов из localStorage
3. Установка флага миграции
```

---

## 6. LangGraph мультиагентная система

### 6.1 Архитектура графа

```
START
  │
  ▼
┌─────────┐
│ Router  │ → определяет selectedAgents + needsRetrieval
└────┬────┘
     │
     ▼
┌──────────────────────────────────────────────┐
│              (conditional)                    │
├──────────────────┬───────────────────────────┤
│ needsRetrieval   │ !needsRetrieval           │
│        ▼         │         ▼                 │
│  ┌──────────┐    │  ┌──────────────────┐     │
│  │Retrieval │    │  │ Simple Response  │     │
│  └────┬─────┘    │  └────────┬─────────┘     │
│       ▼          │           │               │
│  ┌──────────┐    │           │               │
│  │Dispatcher│    │           │               │
│  └────┬─────┘    │           │               │
│       │          │           │               │
│   ┌───┴───┐      │           │               │
│   ▼   ▼   ▼      │           │               │
│  HR Legal IT     │           │               │
│   └───┬───┘      │           │               │
└───────┼──────────┴───────────┼───────────────┘
        │                      │
        ▼                      │
   ┌────────────┐              │
   │Synthesizer │◄─────────────┘
   └─────┬──────┘
         │
         ▼
        END
```

### 6.2 Состояние графа (state.ts)

```typescript
interface AgentState {
  // Input
  messages: Message[]
  currentQuery: string
  preferredDepartment?: DepartmentId

  // Router decisions
  selectedAgents: DepartmentId[]
  needsRetrieval: boolean

  // Retrieval output
  retrievedChunks: AgentChunk[]

  // Agent outputs
  agentResponses: Record<string, string>

  // Final output
  finalResponse: string
}
```

### 6.3 Router Agent

**Назначение:** Классификация запроса и выбор агентов

#### Department Patterns

```typescript
const DEPARTMENT_PATTERNS = {
  hr: /труд|работа|отпуск|увольнение|прием|кадры/i,
  accounting: /налог|бухгалтер|отчет|платеж|взнос/i,
  legal: /договор|право|закон|суд|иск|претензия/i,
  it: /ПВТ|декрет 8|резидент|информация|защита/i
}
```

#### Simple Patterns (без RAG)

```typescript
const SIMPLE_PATTERNS = /привет|здравствуйте|добрый|спасибо|пока|как дела|кто ты/i
```

### 6.4 Department Agents

| Агент | Специализация |
|-------|---------------|
| hrAgent | Трудовой кодекс, кадровые вопросы |
| accountingAgent | Налоговый кодекс, бухучет |
| legalAgent | Гражданский кодекс, договоры |
| itAgent | ПВТ, Декрет №8, IT-законодательство |
| generalAgent | Общие вопросы |
| simpleResponseAgent | Приветствия (без RAG) |

### 6.5 Synthesizer Agent

**Назначение:** Объединение ответов нескольких агентов

```
Если 1 агент → возвращает его ответ
Если >1 агентов → Gemini синтезирует:
  - Объединяет информацию логично
  - Сохраняет ВСЕ цитаты
  - Указывает источник (какой эксперт)
```

---

## 7. Система хранения данных

### 7.1 IndexedDB (основное хранилище)

**База данных:** `BelhardAI_DB`

```
┌─────────────────────────────────────────────────────────────┐
│                      BelhardAI_DB                           │
├─────────────┬───────────────────────────────────────────────┤
│ documents   │ Полные документы с fullContent               │
│ metadata    │ Индекс для быстрого поиска                   │
│ chunks      │ Разбитые части для RAG                       │
│ chats       │ История чатов                                │
│ settings    │ Настройки приложения                         │
└─────────────┴───────────────────────────────────────────────┘
```

### 7.2 localStorage (legacy)

**Ключи:**
- `belhard_chats` — История чатов (мигрируется)
- `belhard_sources` — База знаний (мигрируется)

**Reset:**
```javascript
localStorage.clear()
indexedDB.deleteDatabase('BelhardAI_DB')
```

---

## 8. RAG Pipeline

### 8.1 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      RAG Pipeline                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User Query                                                 │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────┐                                       │
│  │ Extract Keywords │ ← stopwords removal, stemming        │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │ Search Chunks   │────▶│   IndexedDB     │               │
│  │ (searchService) │     │    chunks       │               │
│  └────────┬────────┘     └─────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │  Score & Rank   │ ← citation +10, title +5, content +1 │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │   Top-15        │                                       │
│  │   Chunks        │                                       │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐     ┌─────────────────┐               │
│  │ Gemini API      │────▶│  System         │               │
│  │ (streaming)     │     │  Instruction    │               │
│  └────────┬────────┘     └─────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐                                       │
│  │ Extract Used    │ ← regex matching citations            │
│  │ Sources         │                                       │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ▼                                                 │
│  Response with Interactive Citations                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Chunking Strategy

| Тип документа | Стратегия |
|---------------|-----------|
| Кодексы (ТК, НК, ГК) | Section → Chapter → Article |
| Декреты | По статьям или пунктам |
| Списки (сотрудники) | Каждая строка = chunk |
| Инструкции | По параграфам |

---

## 9. Система цитирования

### 9.1 Формат цитаты (v2.0.0)

```
{Аббревиатура} - {Раздел} - {Статья/Пункт}
```

**Примеры:**
- `ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16`
- `НК РБ - РАЗДЕЛ IV - Статья 286`
- `Сотрудники 2025 - пункт 5`

### 9.2 Интерактивность

| Действие | Результат |
|----------|-----------|
| Single click | Inline preview в сообщении |
| Double click | DocumentViewer с подсветкой |

### 9.3 Extraction алгоритм

```typescript
function extractCitationContext(text: string, citation: string): string {
  // 1. Удалить markdown разметку
  // 2. Удалить другие цитаты
  // 3. Найти локальный контекст (текущий пункт)
  // 4. Очистить от служебных слов
  // 5. Вернуть текст для поиска в документе
}
```

---

## 10. Парсер документов

### 10.1 pravo-by-parser.js

**Размер:** ~700 строк
**Технологии:** Puppeteer + Cheerio

#### Процесс парсинга

```
1. Открытие страницы pravo.by
2. Извлечение HTML контента
3. Парсинг структуры (sections/chapters/articles)
4. Сохранение в JSON формат
5. Генерация index файла
```

#### Output

- `/public/data/documents/*.json` — Документы
- `/public/data/documents-index.json` — Индекс

#### Запуск

```bash
npm run parse-documents
```

---

## 11. Типы и константы

### 11.1 Основные типы (types.ts)

```typescript
// Роль сообщения
type Role = 'user' | 'assistant' | 'system'

// ID отдела
type DepartmentId = 'general' | 'accounting' | 'hr' | 'legal' | 'it'

// Документ в базе знаний
interface Source {
  id: string
  title: string
  type: 'PDF' | 'DOC' | 'XLSX' | 'WEB'
  citation: string
  preview: string
  fullContent: string
  adoptedDate?: string
  lastUpdated: string
  sections?: Section[]
}

// Сообщение чата
interface Message {
  id: string
  role: Role
  content: string
  timestamp: Date
  department?: DepartmentId
  sources?: Source[]
  isStreaming?: boolean
  generationStatus?: 'thinking' | 'searching' | 'found' | 'generating'
  agentId?: string
  consultedAgents?: string[]
}

// Сессия чата
interface ChatSession {
  id: string
  title: string
  preview: string
  lastUpdated: Date
  department?: DepartmentId
  messages: Message[]
  archived?: boolean
}

// Chunk для RAG
interface Chunk {
  id: string
  sourceId: string
  citation: string
  path: string
  content: string
  chunkType: 'article' | 'chapter' | 'section'
}
```

### 11.2 Константы (constants.ts)

**Размер:** ~3900 строк

```typescript
// Отделы
const DEPARTMENTS = [
  { id: 'general', name: 'Общий ассистент', icon: LayoutGrid, ... },
  { id: 'accounting', name: 'Бухгалтерия', icon: Calculator, ... },
  { id: 'hr', name: 'HR / Кадры', icon: Users, ... },
  { id: 'legal', name: 'Юридический отдел', icon: Scale, ... },
  { id: 'it', name: 'IT & Разработка', icon: Cpu, ... }
]

// Начальные чаты
const INITIAL_CHATS: ChatSession[] = [...]

// База законодательства (MOCK_SOURCES)
const MOCK_SOURCES: Source[] = [
  // Трудовой кодекс
  { id: 'TK_RB', title: 'Трудовой кодекс Республики Беларусь', ... },
  // Налоговый кодекс
  { id: 'NK_RB', title: 'Налоговый кодекс Республики Беларусь', ... },
  // Гражданский кодекс
  { id: 'GK_RB', ... },
  // Уголовный кодекс
  { id: 'UK_RB', ... },
  // Декреты, постановления
  { id: 'DECREE_8', title: 'Декрет №8 О ПВТ', ... },
  // Список сотрудников
  { id: 'SOTRUDNIKI_2025', ... }
]
```

---

## 12. Основные процессы

### 12.1 Инициализация приложения

```
1. IndexedDB init
2. Проверка необходимости миграции
3. Импорт из /public/data/ (если нужно)
4. Генерация chunks для всех документов
5. Загрузка чатов из IndexedDB
6. Ready!
```

### 12.2 Отправка сообщения (обычный режим)

```
1. Пользователь отправляет сообщение
2. Создание объекта Message
3. Добавление в чат
4. generateAIResponse():
   - Сбор контекста из последних 3 сообщений
   - Загрузка всех chunks из IndexedDB
   - Поиск top-15 релевантных chunks
   - Отправка в Gemini с system instruction
   - Streaming ответа через callback
   - Извлечение использованных sources
5. Обновление сообщения с ответом и sources
```

### 12.3 Отправка сообщения (мультиагент режим)

```
1. Пользователь отправляет сообщение
2. Router Agent:
   - Определение нужных агентов
   - needsRetrieval флаг
3. Retrieval Agent (если нужно):
   - Загрузка chunks
   - Поиск релевантных
4. Agent Dispatcher:
   - Параллельный вызов выбранных агентов
5. Department Agents:
   - Генерация специализированных ответов
6. Synthesizer Agent:
   - Объединение ответов
7. Финальный ответ с consultedAgents[]
```

---

## 13. Архитектурная диаграмма

```
┌─────────────────────────────────────────────────────────────────────┐
│                        UI LAYER (React)                             │
├─────────────────────────────────────────────────────────────────────┤
│  App.tsx (State Management)                                         │
│  ├── Sidebar (Chat history + Knowledge Base)                        │
│  ├── ChatArea (Message display with inline citations)               │
│  ├── ChatInput (Message input with auto-resize)                     │
│  ├── DocumentViewer/Editor (Knowledge Base management)              │
│  └── Modals (Settings, Logout, Login)                              │
├─────────────────────────────────────────────────────────────────────┤
│                    SERVICE LAYER (Business Logic)                   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐               │
│  │  RAG Pipeline                                     │               │
│  ├──────────────────────────────────────────────────┤               │
│  │  searchService → keyword-based ranking           │               │
│  │  chunkingService → document splitting            │               │
│  │  mockApiService → Gemini API + streaming         │               │
│  └──────────────────────────────────────────────────┘               │
│                                                                      │
│  ┌──────────────────────────────────────────────────┐               │
│  │  LangGraph Multi-Agent System                     │               │
│  ├──────────────────────────────────────────────────┤               │
│  │  routerAgent → department detection              │               │
│  │  retrievalAgent → chunk search                   │               │
│  │  departmentAgents → specialized responses        │               │
│  │  synthesizerAgent → response combination         │               │
│  └──────────────────────────────────────────────────┘               │
│                                                                      │
│  ┌──────────────────────────────────────────────────┐               │
│  │  Data Layer                                       │               │
│  ├──────────────────────────────────────────────────┤               │
│  │  indexedDBService → 100+ documents + chunks      │               │
│  │  migrationService → localStorage → IndexedDB     │               │
│  │  pravo-by-parser → document scraping             │               │
│  └──────────────────────────────────────────────────┘               │
├─────────────────────────────────────────────────────────────────────┤
│                      EXTERNAL APIS                                  │
├─────────────────────────────────────────────────────────────────────┤
│  OpenAI GPT-5 (primary) ← Stream responses                         │
│  Google Gemini (disabled) ← Закомментировано в коде                │
│  pravo.by (document source) ← Web scraping                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Приложения

### A. Команды разработки

```bash
npm install           # Установка зависимостей
npm run dev           # Dev-сервер (порт 3000)
npm run build         # Production сборка
npm run preview       # Preview production build
npm run parse-documents  # Парсинг НПА с pravo.by
```

### B. Переменные окружения

```bash
# .env.local
GEMINI_API_KEY=key1,key2,key3    # Обязательно (поддержка ротации)
OPENAI_API_KEY=your_key          # Опционально (fallback)
```

### C. Сброс данных

```javascript
// В консоли браузера
localStorage.clear()
indexedDB.deleteDatabase('BelhardAI_DB')
location.reload()
```

---

**Документ создан:** Декабрь 2025
**Версия проекта:** 2.0.0
