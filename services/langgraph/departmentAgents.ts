/**
 * Department Agents
 *
 * Специализированные агенты для каждого департамента.
 * Каждый агент имеет свой system prompt и фильтрует контекст
 * по релевантности для своей области.
 *
 * Поддержка: Gemini (primary) + OpenAI (fallback)
 */

import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { DepartmentId, AgentChunk } from '../../types';
import { DEPARTMENTS } from '../../constants';
import { AgentStateType } from './state';

// Key rotation for rate limit handling
class GeminiKeyManager {
  private keys: string[];
  private currentIndex: number = 0;

  constructor() {
    const keyString = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
    this.keys = keyString.split(',').map(k => k.trim()).filter(k => k.length > 0);
    console.log(`🔑 LangGraph: Loaded ${this.keys.length} Gemini keys`);
  }

  getKey(): string {
    if (this.keys.length === 0) {
      throw new Error("GEMINI_API_KEY not configured");
    }
    return this.keys[this.currentIndex];
  }

  rotateKey(): string {
    if (this.keys.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % this.keys.length;
      console.log(`🔄 LangGraph: Rotated to key ${this.currentIndex + 1}/${this.keys.length}`);
    }
    return this.getKey();
  }

  get keyCount(): number {
    return this.keys.length;
  }
}

const keyManager = new GeminiKeyManager();

// Get Gemini client
const getGeminiClient = () => {
  const apiKey = keyManager.getKey();
  return new GoogleGenAI({ apiKey });
};

// Get OpenAI client (fallback)
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY not configured");
  }
  return new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
};

// Check if OpenAI is available
const hasOpenAI = () => {
  return !!process.env.OPENAI_API_KEY;
};

// Generate with OpenAI (fallback)
async function generateWithOpenAI(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  console.log('🔄 Falling back to OpenAI...');
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    temperature: 0.3
  });

  return response.choices[0]?.message?.content || '';
}

// Generate response using Gemini (non-streaming) with retry and OpenAI fallback
async function generateWithGemini(
  systemPrompt: string,
  userMessage: string,
  retryCount: number = 0
): Promise<string> {
  const maxRetries = keyManager.keyCount; // Try each key once

  try {
    const client = getGeminiClient();

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    return response.text || '';
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') ||
                        error?.message?.includes('RESOURCE_EXHAUSTED') ||
                        error?.message?.includes('quota');

    if (isRateLimit && retryCount < maxRetries - 1) {
      console.log(`⚠️ Rate limit hit, rotating key and retrying...`);
      keyManager.rotateKey();
      return generateWithGemini(systemPrompt, userMessage, retryCount + 1);
    }

    // All Gemini keys exhausted - try OpenAI fallback
    if (isRateLimit && hasOpenAI()) {
      console.log(`🔄 All Gemini keys rate limited, falling back to OpenAI...`);
      return generateWithOpenAI(systemPrompt, userMessage);
    }

    throw error;
  }
}

// Generate with OpenAI (streaming fallback)
async function* generateWithOpenAIStream(
  systemPrompt: string,
  userMessage: string
): AsyncGenerator<string> {
  console.log('🔄 Streaming with OpenAI fallback...');
  const client = getOpenAIClient();

  const stream = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage }
    ],
    temperature: 0.3,
    stream: true
  });

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      yield text;
    }
  }
}

// Generate response using Gemini (streaming) with retry and OpenAI fallback
export async function* generateWithGeminiStream(
  systemPrompt: string,
  userMessage: string,
  retryCount: number = 0
): AsyncGenerator<string> {
  const maxRetries = keyManager.keyCount;

  try {
    const client = getGeminiClient();

    const response = await client.models.generateContentStream({
      model: "gemini-2.0-flash",
      contents: userMessage,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
      }
    });

    for await (const chunk of response) {
      const text = chunk.text;
      if (text) {
        yield text;
      }
    }
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') ||
                        error?.message?.includes('RESOURCE_EXHAUSTED') ||
                        error?.message?.includes('quota');

    if (isRateLimit && retryCount < maxRetries - 1) {
      console.log(`⚠️ Streaming rate limit hit, rotating key and retrying...`);
      keyManager.rotateKey();
      // Retry with new key
      yield* generateWithGeminiStream(systemPrompt, userMessage, retryCount + 1);
      return;
    }

    // All Gemini keys exhausted - try OpenAI streaming fallback
    if (isRateLimit && hasOpenAI()) {
      console.log(`🔄 All Gemini keys rate limited, falling back to OpenAI streaming...`);
      yield* generateWithOpenAIStream(systemPrompt, userMessage);
      return;
    }

    throw error;
  }
}

// Department-specific keywords for chunk filtering
const DEPT_KEYWORDS: Record<DepartmentId, string[]> = {
  hr: ['труд', 'работ', 'отпуск', 'увольнен', 'договор', 'заработ', 'кадр', 'прием', 'справк', 'больнич'],
  accounting: ['налог', 'бухгалтер', 'отчет', 'платеж', 'декларац', 'учет', 'взнос', 'ставк', 'ндс'],
  legal: ['договор', 'право', 'закон', 'гражданск', 'суд', 'иск', 'ответственн', 'штраф', 'статья'],
  it: ['пвт', 'резидент', 'информац', 'данн', 'защит', 'цифров', 'программ', 'разработк'],
  general: []
};

/**
 * Фильтрует chunks по релевантности для департамента
 */
function filterChunksForDepartment(
  chunks: AgentChunk[],
  departmentId: DepartmentId
): AgentChunk[] {
  const keywords = DEPT_KEYWORDS[departmentId];

  if (keywords.length === 0) {
    // General department - return all chunks
    return chunks;
  }

  return chunks.filter(chunk => {
    const content = chunk.content.toLowerCase();
    const citation = chunk.citation.toLowerCase();
    const path = chunk.path.toLowerCase();

    return keywords.some(kw =>
      content.includes(kw) ||
      citation.includes(kw) ||
      path.includes(kw)
    );
  });
}

/**
 * Строит system prompt для департамента
 */
function buildSystemPrompt(departmentId: DepartmentId): string {
  const dept = DEPARTMENTS.find(d => d.id === departmentId);
  const deptPrompt = dept?.prompt || 'Ты — корпоративный помощник.';

  const now = new Date();
  const currentDateStr = now.toLocaleDateString('ru-RU', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `
Ты — Belhard AI, эксперт департамента "${dept?.name || 'Общий'}".

${deptPrompt}

!!! КРИТИЧЕСКИ ВАЖНЫЕ ПРАВИЛА ЦИТИРОВАНИЯ !!!

ФОРМАТ ЦИТАТЫ (ОБЯЗАТЕЛЬНО):
Используй ПОЛНЫЙ путь к статье из контекста:
[Аббревиатура] - [РАЗДЕЛ/ГЛАВА если есть] - Статья [номер]

ПРИМЕРЫ ПРАВИЛЬНОГО ФОРМАТА:
✅ "ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16"
✅ "ТК РБ - РАЗДЕЛ III. ГЛАВА 10 - Статья 110"
✅ "НК РБ - РАЗДЕЛ II - Статья 200"
✅ "Декрет №8 - ГЛАВА 1 - Статья 2"

ДЛЯ ПОЛЬЗОВАТЕЛЬСКИХ ДОКУМЕНТОВ (списки, регламенты):
✅ "Сотрудники - пункт 1" или "Сотрудники - Параграф 1"
✅ "Регламент - раздел 3.1"

НЕПРАВИЛЬНЫЙ ФОРМАТ (НЕ ИСПОЛЬЗОВАТЬ):
❌ "ТК РБ - Статья 16" (нет раздела/главы)
❌ "статья 16 ТК РБ" (неправильный порядок)
❌ "(ТК РБ - Статья 16)" (НЕ используй скобки вокруг цитат!)
❌ "Параграф 1" или "пункт 2" БЕЗ названия документа (ВСЕГДА указывай "Документ - пункт X")

!!! ЗАПРЕТ НА ПОВТОРЯЮЩИЕСЯ ЦИТАТЫ !!!

КРИТИЧНО: Каждый пункт ответа должен ссылаться на РАЗНЫЕ статьи!
- Если вопрос о правах работника — цитируй РАЗНЫЕ статьи для КАЖДОГО права
- НЕ используй одну статью для всех пунктов
- Используй ВСЕ релевантные документы из контекста

ПРИМЕР РАЗНООБРАЗНЫХ ЦИТАТ:
1. Право на отдых... ТК РБ - РАЗДЕЛ III. ГЛАВА 11 - Статья 136
2. Право на оплату труда... ТК РБ - РАЗДЕЛ IV. ГЛАВА 6 - Статья 57
3. Право на защиту... ТК РБ - РАЗДЕЛ I. ГЛАВА 2 - Статья 14

СТРУКТУРА ОТВЕТА:
- Пошагово (1. 2. 3.)
- КАЖДЫЙ пункт заканчивается цитатой
- Между текстом и цитатой — один пробел
- Цитата в КОНЦЕ строки, не в середине

ТЕКУЩАЯ ДАТА: ${currentDateStr}

ВАЖНО: Ты создан Дмитрием Утликом в компании Belhard Group.

!!! ПРИОРИТЕТ КОНТЕКСТА !!!
- Если в контексте есть данные по запросу (о сотруднике, документе и т.д.) - ИСПОЛЬЗУЙ ИХ и ЦИТИРУЙ!
- Копируй цитату ТОЧНО как указано после "📌 ИСПОЛЬЗУЙ ЭТУ ЦИТАТУ:"
- Только если контекста НЕТ и спрашивают о тебе как AI - отвечай без цитат
`;
}

/**
 * Форматирует chunks в контекст для LLM
 */
function formatContext(chunks: AgentChunk[]): string {
  if (chunks.length === 0) {
    return "Контекст не найден.";
  }

  return chunks.map(chunk => {
    // Build the correct citation format from chunk data
    const citationFormat = `${chunk.citation} - ${chunk.path}`;
    return `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ИСПОЛЬЗУЙ ЭТУ ЦИТАТУ: ${citationFormat}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${chunk.content}`;
  }).join('\n\n');
}

/**
 * Generic agent factory
 */
async function createDepartmentAgent(
  departmentId: DepartmentId,
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const dept = DEPARTMENTS.find(d => d.id === departmentId);
  console.log(`🤖 ${dept?.name || departmentId} Agent: Processing query`);

  try {
    // Filter chunks relevant to this department
    const relevantChunks = filterChunksForDepartment(
      state.retrievedChunks,
      departmentId
    );

    console.log(`   Found ${relevantChunks.length} relevant chunks`);

    // Build prompt
    const systemPrompt = buildSystemPrompt(departmentId);
    const context = formatContext(relevantChunks);
    const userMessage = `
КОНТЕКСТ БАЗЫ ЗНАНИЙ:
${context}

ВОПРОС ПОЛЬЗОВАТЕЛЯ:
${state.currentQuery}
`;

    // Call LLM using native Gemini SDK
    const responseText = await generateWithGemini(systemPrompt, userMessage);

    console.log(`   ✅ ${dept?.name || departmentId} Agent: Response generated`);

    return {
      agentResponses: {
        [departmentId]: responseText
      }
    };

  } catch (error) {
    console.error(`   ❌ ${dept?.name || departmentId} Agent Error:`, error);
    return {
      agentResponses: {
        [departmentId]: `Ошибка обработки запроса в департаменте ${dept?.name || departmentId}`
      }
    };
  }
}

// Individual agent nodes

export async function hrAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  return createDepartmentAgent('hr', state);
}

export async function accountingAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  return createDepartmentAgent('accounting', state);
}

export async function legalAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  return createDepartmentAgent('legal', state);
}

export async function itAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  return createDepartmentAgent('it', state);
}

export async function generalAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  return createDepartmentAgent('general', state);
}

/**
 * Simple response for non-RAG queries (greetings, etc.)
 */
export async function simpleResponseAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  console.log('💬 Simple Response Agent: Generating casual response');

  try {
    const systemPrompt = `Ты — Belhard AI, дружелюбный корпоративный помощник.
Отвечай коротко и приветливо. Ты создан Дмитрием Утликом в компании Belhard Group.
НЕ упоминай Google или Gemini.`;

    const responseText = await generateWithGemini(systemPrompt, state.currentQuery);

    return {
      agentResponses: {
        'general': responseText
      }
    };

  } catch (error) {
    console.error('Simple Response Error:', error);
    return {
      agentResponses: {
        'general': 'Привет! Чем могу помочь?'
      }
    };
  }
}
