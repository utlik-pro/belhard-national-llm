# Belhard AI - Национальная LLM

Корпоративный чатбот на базе Google Gemini для работы с нормативными правовыми актами Республики Беларусь.

## 📚 Документация

- **[SCALING_PLAN.md](./docs/SCALING_PLAN.md)** - План масштабирования системы до 100 НПА
- **[CHANGELOG.md](./CHANGELOG.md)** - История изменений (v2.0.0 - новый формат цитирований)
- **[CITATION_FORMAT.md](./CITATION_FORMAT.md)** - Справочник по формату цитирований
- **[CLAUDE.md](./CLAUDE.md)** - Инструкции для Claude Code
- **[TESTING.md](./TESTING.md)** - Сценарии тестирования RAG

## 🚀 Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск dev сервера
npm run dev

# Парсинг НПА с pravo.by (после реализации)
npm run parse-documents
```

## 🏗️ Архитектура (v2.0 - в разработке)

### Масштабирование
- **Хранилище**: IndexedDB (100+ MB) вместо localStorage (5-10 MB)
- **RAG**: Keyword-based поиск топ-5 релевантных вместо всех документов
- **Chunking**: Разбиение документов по статьям для точности
- **Цель**: 50-100 НПА РБ

## 📁 Ключевые файлы

```
/services/
  ├── indexedDBService.ts   # Хранилище документов
  ├── searchService.ts      # Поиск релевантных источников
  ├── chunkingService.ts    # Разбиение документов
  └── mockApiService.ts     # Gemini API

/scripts/parser/
  └── pravo-by-parser.js    # Парсер НПА с pravo.by

/docs/
  └── SCALING_PLAN.md       # Детальный план масштабирования
```

## 🎯 Статус реализации

См. [SCALING_PLAN.md](./docs/SCALING_PLAN.md) для детального плана.

**Текущий этап**: Неделя 1 (Инфраструктура)
- ✅ Парсер, IndexedDB, SearchService, ChunkingService
- 🔄 Интеграция в App.tsx
- ⏳ Тестирование и оптимизация

---

**Версия**: 2.0.0 (в разработке)
**Организация**: Belhard Group + НАН РБ
