/**
 * Synthesizer Agent
 *
 * Объединяет ответы от нескольких департаментных агентов
 * в один связный ответ.
 */

import { GoogleGenAI } from "@google/genai";
import { DEPARTMENTS } from '../../constants';
import { DepartmentId } from '../../types';
import { AgentStateType } from './state';

// Get department name helper
function getDeptName(deptId: DepartmentId): string {
  const dept = DEPARTMENTS.find(d => d.id === deptId);
  return dept?.name || deptId;
}

// Generate response using native Gemini SDK
async function generateSynthesis(prompt: string): Promise<string> {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      temperature: 0.3,
    }
  });

  return response.text || '';
}

/**
 * Synthesizer Node
 *
 * Если несколько агентов ответили - объединяет их ответы.
 * Если один агент - возвращает его ответ напрямую.
 */
export async function synthesizerAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const responses = state.agentResponses;
  const agentIds = Object.keys(responses) as DepartmentId[];

  console.log('🔄 Synthesizer Agent: Processing', agentIds.length, 'responses');

  // If only one agent responded, return directly
  if (agentIds.length === 1) {
    const singleResponse = responses[agentIds[0]];
    console.log('   Single agent response, passing through');
    return {
      finalResponse: singleResponse
    };
  }

  // If no responses
  if (agentIds.length === 0) {
    console.warn('   ⚠️ No agent responses to synthesize');
    return {
      finalResponse: 'Извините, не удалось получить ответ от экспертов.'
    };
  }

  // Multiple agents - synthesize
  console.log('   Synthesizing responses from:', agentIds.map(getDeptName).join(', '));

  try {
    // Build synthesis prompt
    const responsesText = agentIds.map(agentId =>
      `### ${getDeptName(agentId)}:\n${responses[agentId]}`
    ).join('\n\n');

    const synthesisPrompt = `
Ты — Belhard AI. Объедини ответы от нескольких экспертов в один связный ответ.

ВОПРОС ПОЛЬЗОВАТЕЛЯ:
${state.currentQuery}

ОТВЕТЫ ЭКСПЕРТОВ:
${responsesText}

ПРАВИЛА СИНТЕЗА:
1. Объедини информацию логично, избегая повторов
2. Сохрани ВСЕ цитаты источников (формат: "ТК РБ - РАЗДЕЛ X. ГЛАВА Y - Статья Z")
3. НЕ используй скобки вокруг цитат - пиши просто: ТК РБ - Статья 16 (не "(ТК РБ - Статья 16)")
4. Если эксперты дают разную информацию - укажи, от какого эксперта
5. Структурируй ответ пошагово (1. 2. 3.)
6. Цитаты ставь в КОНЦЕ пункта в той же строке, не на новой строке

ВАЖНО: Ты создан Дмитрием Утликом в компании Belhard Group.

ПРИОРИТЕТ: Если в ответах экспертов есть цитаты из контекста - СОХРАНИ ИХ в синтезе!
`;

    const synthesizedResponse = await generateSynthesis(synthesisPrompt);

    console.log('   ✅ Synthesis complete');

    return {
      finalResponse: synthesizedResponse
    };

  } catch (error) {
    console.error('   ❌ Synthesis Error:', error);

    // Fallback: concatenate responses
    const fallbackResponse = agentIds.map(agentId =>
      `**${getDeptName(agentId)}:**\n${responses[agentId]}`
    ).join('\n\n---\n\n');

    return {
      finalResponse: fallbackResponse
    };
  }
}
