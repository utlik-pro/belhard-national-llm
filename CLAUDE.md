# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Belhard AI - Национальная LLM** is a frontend-only corporate chatbot for Belarusian companies, providing departmental AI assistants specialized in Belarusian law and regulations. Uses Google Gemini API with RAG over 50-100 legal documents (НПА РБ).

**Tech Stack:** React 19 + TypeScript, Vite 6, Google Gemini AI (@google/genai), LangGraph for multi-agent orchestration, IndexedDB for document storage.

## Development Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Dev server on port 3000
npm run build                  # Production build
npm run preview                # Preview production build
npm run parse-documents        # Parse НПА from pravo.by (Puppeteer)
```

## Environment Setup

Create `.env.local`:
```bash
GEMINI_API_KEY=your_key_here              # Required (supports comma-separated keys for rotation)
OPENAI_API_KEY=your_openai_key_here       # Optional
```

**Key Rotation:** Use comma-separated keys `GEMINI_API_KEY="key1,key2,key3"` - KeyManager auto-rotates on 429/503 errors.

## Project Structure

```
/
├── components/              # React UI components
├── services/
│   ├── mockApiService.ts    # Gemini API integration, streaming, RAG
│   ├── indexedDBService.ts  # Document storage (replaces localStorage)
│   ├── searchService.ts     # Keyword-based document search
│   ├── chunkingService.ts   # Document chunking by article
│   ├── migrationService.ts  # localStorage → IndexedDB migration
│   └── langgraph/           # Multi-agent system
│       ├── multiAgentGraph.ts   # Main graph orchestration
│       ├── routerAgent.ts       # Query routing
│       ├── retrievalAgent.ts    # RAG retrieval
│       ├── departmentAgents.ts  # HR, Legal, Accounting, IT agents
│       └── synthesizerAgent.ts  # Response synthesis
├── scripts/parser/
│   └── pravo-by-parser.js   # Puppeteer parser for pravo.by
├── shims/
│   └── async_hooks.ts       # Browser polyfill for LangGraph
├── App.tsx                  # Main component, state management
├── types.ts                 # TypeScript definitions
├── constants.ts             # Departments, mock sources
└── docs/SCALING_PLAN.md     # Architecture documentation
```

## Architecture

### Data Flow

```
User Query → SearchService (keyword filter) → Top-5 Sources → Gemini API → Streaming Response
                                                     ↓
                                              IndexedDB Storage
```

### Storage Architecture (v2.0)

**IndexedDB** (replaces localStorage for 100+ documents):
- `documents` - Full documents with `fullContent`
- `metadata` - Fast search index (title, keywords, citation)
- `chunks` - Document parts split by article
- `chats` - Chat history
- `settings` - App configuration

**Migration:** `migrationService.ts` handles localStorage → IndexedDB on first load.

### RAG Pipeline

1. **SearchService** extracts keywords from query + department-specific terms
2. **Scoring:** citation match (+10), title match (+5), content match (+1)
3. Top-5 sources sent to Gemini with system instruction enforcing citation format
4. `extractUsedSources()` filters response to show only cited sources

### LangGraph Multi-Agent System

Alternative to direct Gemini calls (in `services/langgraph/`):
- **RouterAgent** - Routes queries to appropriate department
- **RetrievalAgent** - RAG document retrieval
- **DepartmentAgents** - Specialized HR/Legal/Accounting/IT/General agents
- **SynthesizerAgent** - Combines multi-agent responses

### Core Types (types.ts)

- `DepartmentId`: `'general' | 'accounting' | 'hr' | 'legal' | 'it'`
- `Source`: Document with `id`, `title`, `citation`, `fullContent`
- `Message`: Chat message with `sources[]` and `isStreaming` flag
- `ChatSession`: Chat metadata with `department` field
- `Chunk`: Document part with `sourceId`, `path`, `content`, `chunkType`

## AI Integration (mockApiService.ts)

**Model Fallback:** `gemini-2.5-flash` → `gemini-2.0-flash-lite-preview` → `gemini-2.0-flash`

**Streaming:** `streamWithTypewriterEffect()` provides character-by-character rendering with dynamic speed.

**System Instruction:** Enforces department role-playing, citation format `ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16`, and step-by-step responses. Temperature: 0.3.

**Error Handling:** Retryable (429, 503, RESOURCE_EXHAUSTED) triggers key rotation. Non-retryable fails to next model.

## Citation System (v2.0.0)

**Format:** `ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16` (Citation - Section - Article)

**Regex pattern:** `escapedCitation + '\\s*-\\s*[^,\\.\\n]+'`

**Interactivity:** Single click opens preview, double click opens full document with highlighted text.

## Document Parser (scripts/parser/pravo-by-parser.js)

Parses legal documents from pravo.by using Puppeteer + Cheerio. Run with `npm run parse-documents`.

**Output:** JSON files in `/public/data/documents/` with index at `/public/data/documents-index.json`

**Target:** 100 НПА РБ including codes (ТК, НК, ГК, УК), decrees (№8, №7), laws, resolutions.

## Key Implementation Details

1. **No Backend** - All state client-side, mock authentication (any email works)
2. **Message Editing** - Truncates history and regenerates AI response
3. **Source Filtering** - Only cited sources shown in response footer
4. **Streaming** - `isStreaming: true` shows pulsing cursor
5. **Context Window** - Top-5 sources sent (configurable in searchService)
6. **Browser Polyfills** - `shims/async_hooks.ts` for LangGraph browser compatibility

## Adding New Features

**New Department:**
1. Add to `DepartmentId` in `types.ts`
2. Add to `DEPARTMENTS` array in `constants.ts`
3. Add keywords to `searchService.ts` `departmentKeywords`

**New Source (programmatic):**
1. Add to `/public/data/documents/` as JSON
2. Update `/public/data/documents-index.json`
3. Or add to `MOCK_SOURCES` in `constants.ts`

**Modifying AI Behavior:**
Edit `systemInstruction` template in `mockApiService.ts` (line ~174-227).

## Local Storage / IndexedDB Keys

- `belhard_chats` - Chat sessions (migrating to IndexedDB)
- `belhard_sources` - Knowledge base (migrating to IndexedDB)
- IndexedDB: `BelhardAI_DB` with stores: documents, metadata, chunks, chats, settings

**Reset state:** `localStorage.clear(); indexedDB.deleteDatabase('BelhardAI_DB');`

## Related Documentation

- `CHANGELOG.md` - Version history, v2.0.0 citation changes
- `docs/SCALING_PLAN.md` - Architecture for 100+ documents
- `TESTING.md` - 50+ test questions by department
