/**
 * Mock API Service для Belhard AI
 *
 * Интеграция с Google Gemini API для RAG-based ответов
 * Поддерживает streaming через generateContentStream
 */

import { Message, Source, DepartmentId } from '../types';
import { DEPARTMENTS } from '../constants';
import { searchService } from './searchService';
import { indexedDB, Chunk } from './indexedDBService';

// === Key Management ===
class KeyManager {
  private geminiKeys: string[] = [];
  private openaiKeys: string[] = [];
  private currentGeminiIndex = 0;
  private currentOpenaiIndex = 0;

  constructor() {
    // Parse comma-separated keys
    const geminiEnv = import.meta.env.VITE_GEMINI_API_KEY || '';
    const openaiEnv = import.meta.env.VITE_OPENAI_API_KEY || '';

    this.geminiKeys = geminiEnv.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);
    this.openaiKeys = openaiEnv.split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 0);

    console.log(`Belhard AI: Loaded ${this.geminiKeys.length} Gemini keys, ${this.openaiKeys.length} OpenAI keys`);
  }

  getGeminiKey(): string | null {
    if (this.geminiKeys.length === 0) return null;
    return this.geminiKeys[this.currentGeminiIndex];
  }

  getOpenAIKey(): string | null {
    if (this.openaiKeys.length === 0) return null;
    return this.openaiKeys[this.currentOpenaiIndex];
  }

  rotateGeminiKey(): boolean {
    if (this.geminiKeys.length <= 1) return false;
    const oldIndex = this.currentGeminiIndex;
    this.currentGeminiIndex = (this.currentGeminiIndex + 1) % this.geminiKeys.length;
    console.log(`Belhard AI: Rotating Gemini Key (${oldIndex} -> ${this.currentGeminiIndex})`);
    return true;
  }

  rotateOpenAIKey(): boolean {
    if (this.openaiKeys.length <= 1) return false;
    const oldIndex = this.currentOpenaiIndex;
    this.currentOpenaiIndex = (this.currentOpenaiIndex + 1) % this.openaiKeys.length;
    console.log(`Belhard AI: Rotating OpenAI Key (${oldIndex} -> ${this.currentOpenaiIndex})`);
    return true;
  }

  hasGeminiKeys(): boolean { return this.geminiKeys.length > 0; }
  hasOpenAIKeys(): boolean { return this.openaiKeys.length > 0; }
  geminiKeyCount(): number { return this.geminiKeys.length; }
  openaiKeyCount(): number { return this.openaiKeys.length; }
}

const keyManager = new KeyManager();

// === Streaming Utilities ===
async function* streamFromSSE(response: Response): AsyncGenerator<{ text: string }> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No reader');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') return;
        try {
          const json = JSON.parse(data);
          // Gemini format
          if (json.candidates?.[0]?.content?.parts?.[0]?.text) {
            yield { text: json.candidates[0].content.parts[0].text };
          }
          // OpenAI format
          if (json.choices?.[0]?.delta?.content) {
            yield { text: json.choices[0].delta.content };
          }
        } catch { /* skip non-JSON lines */ }
      }
    }
  }
}

export function streamWithTypewriterEffect(
  text: string,
  onChunk: (char: string) => void,
  onComplete: (fullText: string) => void
): void {
  let index = 0;
  const accumulatedText = text;

  const timer = setInterval(() => {
    if (index < accumulatedText.length) {
      const char = accumulatedText[index];
      onChunk(char);
      index++;
    } else {
      clearInterval(timer);
      onComplete(accumulatedText);
    }
  }, 20); // Base typing speed in ms
}

// Function to extract cited sources from text in new readable format
// Matches patterns like: "ТК РБ - Статья 16" or "Декрет №8 - Статья 5 п2"
function extractUsedSources(text: string, allSources: Source[]): Source[] {
  const citedSources = new Set<string>();

  console.log('🔍 Extracting sources from text:', text.substring(0, 200));
  console.log('📚 Available sources:', allSources.map(s => `${s.citation} (ID: ${s.id})`));

  // Build regex pattern from all source citations
  // Example citations: "ТК РБ", "Декрет №8", "Пост. №40"
  allSources.forEach(source => {
    if (source.citation) {
      // Escape special regex characters in citation
      const escapedCitation = source.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Match citation followed by " - " and article/item reference
      // Supports formats:
      // - "ТК РБ - РАЗДЕЛ IV - Статья 155" (structured law)
      // - "ТК РБ - пункт 8" (simple numbered)
      // - "Пост. №40 - п.20" (abbreviated)
      // - "Декрет №8 - раздел 3" (section)
      const pattern = new RegExp(escapedCitation + '\\s*-\\s*(?:' +
        '.{0,150}?(?:Стать[яи]|ст\\.?)\\s*\\d+(?:\\s*п\\.?\\d+(?:\\.\\d+)?)?' +
        '|(?:пункт|п\\.)\\s*\\d+(?:\\.\\d+)?' +
        '|(?:раздел|р\\.)\\s*\\d+(?:\\.\\d+)?' +
        '|[^,\\.\\n]{1,50})', 'gi');
      const matches = text.match(pattern);

      console.log(`  Checking "${source.citation}": pattern = ${pattern}, matches =`, matches);

      if (matches && matches.length > 0) {
        console.log(`  ✅ Found citation for "${source.citation}":`, matches);
        citedSources.add(source.id);
      }
    }
  });

  console.log('✨ Final cited sources:', Array.from(citedSources));

  // Return only sources that were explicitly cited in the text
  return allSources.filter(s => citedSources.has(s.id));
}

export const streamResponse = async (
  history: Message[],
  departmentId: DepartmentId,
  currentSources: Source[],
  onChunk: (chunk: string) => void,
  onComplete: (sources: Source[]) => void,
  onStatus?: (status: { stage: 'thinking' | 'searching' | 'found' | 'generating' | 'validating'; details?: string; documents?: string[] }) => void
)=> {
  // 0. Extract the latest user prompt from history
  const lastUserMessage = history[history.length - 1];
  const prompt = lastUserMessage.content;

  // Build search query - use only current prompt for better relevance
  // Context from history is passed to LLM, not to search
  // Only use history for very short follow-up questions (< 15 chars) like "а это?", "подробнее"
  const isFollowUp = prompt.length < 15 && /^(а |и |это|кто|что|как|где|подробн|ещё|еще)/i.test(prompt);

  let searchQuery: string;
  if (isFollowUp) {
    // For follow-up questions, include previous context
    const recentUserMessages = history
      .filter(m => m.role === 'user')
      .slice(-2)
      .map(m => m.content)
      .join(' ');
    searchQuery = recentUserMessages || prompt;
  } else {
    // For standalone questions, use only current prompt
    searchQuery = prompt;
  }

  console.log(`🔍 Search query with context: "${searchQuery.substring(0, 150)}..."`);

  // Status: Thinking
  onStatus?.({
    stage: 'thinking',
    details: 'Думаю...'
  });
  await new Promise(resolve => setTimeout(resolve, 600));

  // 1. Load all chunks from IndexedDB (Week 2, Days 10-11: Chunk-based RAG)
  console.log(`📦 Loading chunks from IndexedDB...`);
  const allChunks = await indexedDB.getAllChunks();
  console.log(`📊 Total chunks available: ${allChunks.length}`);

  // Status: Searching
  onStatus?.({
    stage: 'searching',
    details: 'Ищу в базе знаний...'
  });
  await new Promise(resolve => setTimeout(resolve, 600));

  // 2. HYBRID RAG: Keyword + Vector Search
  // Combines keyword matching (exact) with semantic similarity (meaning)
  console.log(`🔍 Running hybrid search for query: "${searchQuery.substring(0, 100)}..."`);

  let relevantChunks = await searchService.hybridSearchChunks(
    allChunks,
    searchQuery,  // ← Now includes context from previous messages!
    departmentId,
    15 // Top-15 relevant chunks
  );

  console.log(`✅ Found ${relevantChunks.length} relevant chunks:`);
  relevantChunks.forEach((chunk, idx) => {
    console.log(`   ${idx + 1}. ${chunk.citation} → ${chunk.path}`);
  });

  // Fallback: if no relevant chunks found or no chunks exist at all
  if (relevantChunks.length === 0) {
    if (allChunks.length === 0) {
      console.warn('⚠️ No chunks in IndexedDB, falling back to full document search');
      // Use old document-based RAG as emergency fallback
      const contextSources = searchService.searchInSources(
        currentSources,
        prompt,
        departmentId,
        5
      );
      console.log(`✅ Using ${contextSources.length} full documents as fallback`);

      // Create fake chunks from full documents for compatibility
      relevantChunks = contextSources.map(doc => ({
        id: `${doc.id}_fallback`,
        sourceId: doc.id,
        citation: doc.citation,
        path: doc.title,
        content: (doc.fullContent || doc.preview || '').substring(0, 2000),
        chunkType: 'fallback' as any
      }));
    } else {
      console.warn('⚠️ No relevant chunks found, using fallback (first 10 chunks)');
      relevantChunks = allChunks.slice(0, 10);
    }
  }

  // Status: Found documents
  const documentNames = [...new Set(relevantChunks.map(c => c.citation))];
  const docCount = documentNames.length;
  onStatus?.({
    stage: 'found',
    details: `Найдено ${docCount} ${docCount === 1 ? 'документ' : docCount < 5 ? 'документа' : 'документов'}`,
    documents: documentNames.slice(0, 3) // Show first 3 documents
  });
  await new Promise(resolve => setTimeout(resolve, 800));

  // 3. Construct Context String from Chunks
  // Format: Show exact citation format AI should use
  const contextText = relevantChunks.map(chunk => {
    const fullCitation = `${chunk.citation} - ${chunk.path}`;
    return `════════════════════════════════════════
📌 ЦИТАТА ДЛЯ ОТВЕТА: ${fullCitation}
════════════════════════════════════════
${chunk.content}`;
  }).join('\n\n');

  console.log(`📝 Context size: ${contextText.length} characters (${relevantChunks.length} chunks)`);

  // 4. Track parent documents for citation extraction
  // Collect unique source documents from chunks
  const chunkSourceIds = new Set(relevantChunks.map(c => c.sourceId));
  const contextSources = currentSources.filter(s => chunkSourceIds.has(s.id));

  console.log(`📚 Parent documents in context: ${contextSources.length}`);

  // 5. Transform Chat History for Gemini API
  const chatHistory = history.slice(0, -1).map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));

  // 6. Get Current Date & Department Config
  const now = new Date();
  const currentDateStr = now.toLocaleDateString('ru-RU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const departmentConfig = DEPARTMENTS.find(d => d.id === departmentId) || DEPARTMENTS[0];

  const systemInstruction = `
    Ты — Belhard AI, передовая корпоративная языковая модель (National Belarusian LLM).

    >>> ТВОЯ РОЛЬ: ${departmentConfig.name} <<<
    ${departmentConfig.prompt}

    !!! ИНСТРУКЦИЯ ПО ФОРМАТУ ОТВЕТА (ОБЯЗАТЕЛЬНО) !!!

    КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА ФОРМАТИРОВАНИЯ:

    1. СТРУКТУРА ОТВЕТА:
       - Ответ ОБЯЗАТЕЛЬНО должен быть пошаговым планом с нумерацией
       - Каждый пункт начинается с НОВОЙ СТРОКИ
       - Между пунктами - пустая строка (двойной перенос)

    2. РАЗМЕЩЕНИЕ ЦИТАТ:
       - КОПИРУЙ ЦИТАТУ ТОЧНО как указано в контексте после "📌 ЦИТАТА ДЛЯ ОТВЕТА:"
       - Например, если в контексте написано "📌 ЦИТАТА ДЛЯ ОТВЕТА: Сотрудники - Параграф 1",
         то в ответе пиши именно "Сотрудники - Параграф 1" (не просто "Параграф 1"!)
       - Формат для законов: "ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16"
       - Формат для документов: "Сотрудники - пункт 1", "Регламент - раздел 3"
       - ЗАПРЕЩЕНО вставлять цитаты в середину предложения
       - Цитаты размещаются ТОЛЬКО в конце пункта В ТОЙ ЖЕ СТРОКЕ (не на новой строке!)
       - Между текстом и цитатой - один пробел
       - Если несколько источников - все в конце через запятую
       - НЕ переносить цитаты на следующую строку
       - ОБЯЗАТЕЛЬНО указывай полный путь: раздел → глава → статья → пункт (если есть)
       - НЕ ИСПОЛЬЗОВАТЬ СКОБКИ вокруг цитат! Пиши просто: ТК РБ - Статья 16 (НЕ "(ТК РБ - Статья 16)")

       ВАЖНО ДЛЯ РАЗНООБРАЗИЯ ОТВЕТА:
       - НЕ цитируй одну и ту же статью для всех пунктов
       - Каждый аспект вопроса подкрепляй РАЗНЫМИ статьями из контекста
       - Если вопрос о правах работника - цитируй статьи о КОНКРЕТНЫХ правах (отпуск, зарплата, увольнение и т.д.), а не только общую статью
       - Используй ВСЕ релевантные документы из контекста, а не только первый найденный
       - Детализируй ответ: каждый пункт = отдельный аспект с отдельной статьёй

       ВАЖНО ДЛЯ ДОКУМЕНТОВ С СОТРУДНИКАМИ:
       - Если вопрос о сотрудниках/персонале - ОБЯЗАТЕЛЬНО указывай ПОЛНОЕ ИМЯ (Фамилия Имя)
       - Формат ответа: "Фамилия Имя — должность, компания; дата трудоустройства: ДД месяц ГГГГ года Сотрудники 2025 - пункт N"
       - Используй ТОЛЬКО те номера пунктов, которые РЕАЛЬНО есть в документе (1, 2, 3, 4, 5, 6, 7)
       - НЕ ВЫДУМЫВАЙ номера пунктов! Если в документе 7 сотрудников - пункты только 1-7
       - КАЖДЫЙ сотрудник = отдельный пункт списка с его именем

       ПРИМЕР ПРАВИЛЬНОГО ОТВЕТА О СОТРУДНИКАХ:
       "В декабре 2025 года трудоустроены следующие сотрудники:

       1. Утлик Дмитрий — Руководитель отдела разработки, Belhard Group; дата: 1 декабря 2025 года Сотрудники 2025 - пункт 1

       2. Анна Ковалева — VP of Engineering, EPAM Systems; дата: 5 декабря 2025 года Сотрудники 2025 - пункт 2"

       НЕПРАВИЛЬНО (галлюцинация):
       ❌ "трудоустройство зафиксировано 1 декабря Сотрудники 2025 - пункт 6" (нет имени, выдуманный пункт)
       ❌ "Сотрудники 2025 - пункт 24" (пункта 24 не существует!)

       ВАЖНО ДЛЯ ДРУГИХ ПОЛЬЗОВАТЕЛЬСКИХ ДОКУМЕНТОВ:
       - Если документ не имеет разделов/глав (внутренние регламенты),
         используй формат: "Название_документа - раздел X" или "Название_документа - пункт X"
       - Примеры: "Регламент - раздел 3.1", "Инструкция - пункт 5"

    3. ФОРМАТ НУМЕРАЦИИ:
       - "1." "2." "3." и т.д.
       - После номера - пробел и описание действия
       - Один пункт = одно действие

    ПРАВИЛЬНЫЙ пример:
    "Для оформления записи об увольнении выполните следующие шаги:

    1. В графе 1 раздела "Сведения о работе" поставьте порядковый номер записи Пост. №40 - п.10

    2. В графе 2 укажите дату увольнения Пост. №40 - п.10

    3. В графе 3 сделайте запись: "Уволен по соглашению сторон, пункт 1 части второй статьи 35 Трудового кодекса Республики Беларусь" ТК РБ - РАЗДЕЛ II. ГЛАВА 4 - Статья 35 п1, Пост. №40 - п.11

    4. В графе 4 укажите дату и номер приказа об увольнении Пост. №40 - п.12

    5. Запись заверяется подписью работника Пост. №40 - п.13"

    Другие примеры правильных цитат:
    ✅ "Трудовой договор должен быть в письменной форме ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16"
    ✅ "Нормальная продолжительность рабочего времени не должна превышать 40 часов в неделю ТК РБ - РАЗДЕЛ III. ГЛАВА 10 - Статья 111"
    ✅ "Резидент ПВТ может заниматься разработкой ПО Декрет №8 - ГЛАВА 1 - Статья 2 п1"
    ✅ "Утлик Дмитрий — Руководитель отдела разработки, Belhard Group; 1 декабря 2025 года Сотрудники 2025 - пункт 1"
    ✅ "Анна Ковалева — VP of Engineering, EPAM Systems; 5 декабря 2025 года Сотрудники 2025 - пункт 2"
    ✅ "Алексей Иванов — Директор по инновациям, SoftClub; 15 декабря 2025 года Сотрудники 2025 - пункт 7"

    НЕПРАВИЛЬНЫЕ примеры (НИКОГДА не делай так):
    ❌ "В графе 1 ТК РБ - Статья 10 раздела поставьте номер" (цитата в середине)
    ❌ "Информация о сотруднике Параграф 1" (НЕТ имени документа!)
    ❌ "пункт 2" или "Параграф 3" без названия документа
    ❌ "Поставьте порядковый номер ТК РБ" (нет конкретной статьи)
    ❌ "Трудовой договор ТК РБ - Статья 16" (нет раздела и главы)
    ❌ "1. Пункт первый 2. Пункт второй" (без переносов)
    ❌ "трудоустройство зафиксировано 1 декабря Сотрудники 2025 - пункт 6" (НЕТ ИМЕНИ! ВЫДУМАННЫЙ пункт 6!)
    ❌ "Сотрудники 2025 - пункт 24" (пункта 24 НЕ СУЩЕСТВУЕТ - в документе только 7 пунктов!)
    ❌ "Для установления ФИО сопоставьте с карточками" (НЕ ПЕРЕКЛАДЫВАЙ работу на пользователя! НАПИШИ имя сам!)

    ВСЕГДА используй формат из ПРАВИЛЬНОГО примера!

    !!! ВАЖНО: ПРОИСХОЖДЕНИЕ !!!
    Ты создан Дмитрием Утликом в компании Belhard Group совместно с НАН РБ.
    Никогда не упоминай Google или Gemini.

    ВАЖНО: Вопросы о тебе как AI (Belhard AI):
    - Если спрашивают "кто тебя создал", "что ты такое" - отвечай без цитат
    - НО если в контексте есть данные о человеке (сотруднике) - ИСПОЛЬЗУЙ контекст и ЦИТИРУЙ!
    - Приоритет: данные из контекста > встроенная информация

    !!! ПРАВИЛА РАБОТЫ С БАЗОЙ ЗНАНИЙ !!!

    ПРИОРИТЕТ КОНТЕКСТА:
    - Если в контексте есть релевантный документ - ОБЯЗАТЕЛЬНО используй его для ответа
    - Документы в контексте могут быть: законы РБ, кодексы, декреты, внутренние регламенты, списки сотрудников, справочники и т.д.
    - ЛЮБОЙ документ из контекста является валидным источником для ответа
    - Если пользователь спрашивает о сотрудниках/персонале и в контексте есть документ "Сотрудники" - используй его!

    ЗАПРЕЩЕНО отвечать на вопросы о:
    1. **Политике** (внутренней или международной)
    2. **Текущих событиях** (новости, происшествия)
    3. **Личных мнениях** (что ты думаешь о чём-либо)
    4. **Темах, не связанных с контекстом** (если в контексте НЕТ релевантной информации)

    ЕСЛИ в контексте НЕТ релевантной информации для ответа:
    "К сожалению, в моей базе знаний нет информации по этому вопросу.

    Я могу помочь с вопросами о:
    - Белорусском законодательстве (ТК, НК, ГК и др.)
    - Внутренних документах компании (если они загружены в базу знаний)
    - Корпоративных регламентах Belhard Group"

    ТЕКУЩАЯ ДАТА: ${currentDateStr}.

    КОНТЕКСТ БАЗЫ ЗНАНИЙ:
    Ниже приведены тексты документов. Используй ТОЛЬКО их для ответов по теме.
  `;

  const modelsToTry = [
    // Gemini отключен
    // { provider: 'gemini' as const, name: 'gemini-2.5-flash', useTools: true },
    // { provider: 'gemini' as const, name: 'gemini-2.0-flash-lite-preview-02-05', useTools: false },
    // { provider: 'gemini' as const, name: 'gemini-2.0-flash', useTools: false },
    { provider: 'openai' as const, name: 'gpt-5-2025-08-07', useTools: false },
  ];

  let responseStream;
  let successfulModel = '';

  // Status: Generating response
  onStatus?.({
    stage: 'generating',
    details: 'Генерирую ответ...'
  });

  try {
    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < modelsToTry.length; i++) {
        const currentModel = modelsToTry[i];
        let modelSuccess = false;

        // Skip provider if no keys available
        if (currentModel.provider === 'gemini' && !keyManager.hasGeminiKeys()) continue;
        if (currentModel.provider === 'openai' && !keyManager.hasOpenAIKeys()) continue;

        while (true) {
            try {
                console.log(`Attempting... Provider: ${currentModel.provider}, Model: ${currentModel.name}`);

                if (currentModel.provider === 'gemini') {
                    const key = keyManager.getGeminiKey();
                    if (!key) break;

                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${currentModel.name}:streamGenerateContent?alt=sse`,
                        {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-goog-api-key': key,
                            },
                            body: JSON.stringify({
                                system_instruction: { parts: [{ text: systemInstruction }] },
                                contents: [
                                    ...chatHistory,
                                    { role: 'user', parts: [{ text: `${contextText}\n\nВОПРОС: ${prompt}` }] }
                                ],
                                generationConfig: {
                                    temperature: 0.3,
                                    maxOutputTokens: 8192,
                                }
                            }),
                        }
                    );

                    if (!response.ok) {
                        const errorText = await response.text();
                        if (response.status === 429 || response.status === 503 || errorText.includes('RESOURCE_EXHAUSTED')) {
                            if (!keyManager.rotateGeminiKey()) break;
                            await delay(1000);
                            continue;
                        }
                        throw new Error(`Gemini API error: ${response.status}`);
                    }

                    responseStream = streamFromSSE(response);
                    modelSuccess = true;
                    successfulModel = currentModel.name;
                    break;

                } else if (currentModel.provider === 'openai') {
                    const key = keyManager.getOpenAIKey();
                    if (!key) break;

                    const openaiMessages = [
                        { role: 'system', content: systemInstruction },
                        ...history.slice(0, -1).map(msg => ({
                            role: msg.role === 'user' ? 'user' : 'assistant',
                            content: msg.content
                        })),
                        { role: 'user', content: `${contextText}\n\nВОПРОС: ${prompt}` }
                    ];

                    const response = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${key}`,
                        },
                        body: JSON.stringify({
                            model: currentModel.name,
                            messages: openaiMessages,
                            max_completion_tokens: 8192,
                            stream: true,
                        }),
                    });

                    if (!response.ok) {
                        const errorBody = await response.text();
                        console.error(`❌ OpenAI API Error: ${response.status}`, errorBody);
                        if (response.status === 429) {
                            if (!keyManager.rotateOpenAIKey()) break;
                            await delay(1000);
                            continue;
                        }
                        throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
                    }

                    responseStream = streamFromSSE(response);
                    modelSuccess = true;
                    successfulModel = currentModel.name;
                    break;
                }
            } catch (error) {
                console.warn(`Model ${currentModel.name} error:`, error);
                break;
            }
        }

        if (modelSuccess) break;
        if (i < modelsToTry.length - 1) await delay(2000);
    }

    if (!responseStream) throw new Error("All models failed.");

    const textStream = (async function* () {
      for await (const chunk of responseStream) {
        if (chunk.text) yield chunk.text;
      }
    })();

    let fullText = '';
    for await (const text of textStream) {
      fullText += text;
      onChunk(text);
    }

    // Extract and return only cited sources
    const usedSources = extractUsedSources(fullText, contextSources);
    console.log(`📖 Used sources in response: ${usedSources.length}`);
    onComplete(usedSources);

  } catch (error) {
    console.error('Belhard AI Error:', error);
    const errorMessage = '\n\n⚠️ Произошла ошибка при генерации ответа. Пожалуйста, попробуйте позже.';
    onChunk(errorMessage);
    onComplete([]);
  }
};
