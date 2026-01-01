/**
 * Multi-Agent Graph
 *
 * Основной граф LangGraph, объединяющий все агенты.
 *
 * Архитектура:
 *   User Query
 *       ↓
 *   [Router] → определяет агентов + needsRAG
 *       ↓
 *   [Retrieval] → (если needsRAG) загружает chunks
 *       ↓
 *   [Department Agents] → параллельно или последовательно
 *       ↓
 *   [Synthesizer] → объединяет ответы
 *       ↓
 *   Final Response
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { MemorySaver } from "@langchain/langgraph";
import { AgentStateAnnotation, AgentStateType } from './state';
import { routerAgent, routeToNextNode } from './routerAgent';
import { retrievalAgent } from './retrievalAgent';
import {
  hrAgent,
  accountingAgent,
  legalAgent,
  itAgent,
  generalAgent,
  simpleResponseAgent
} from './departmentAgents';
import { synthesizerAgent } from './synthesizerAgent';
import { hallucinationCheckerAgent, ValidationResult } from './hallucinationChecker';
import { DepartmentId, AgentChunk } from '../../types';
import { DEPARTMENTS } from '../../constants';

/**
 * Agent dispatcher node
 *
 * Calls the appropriate agent(s) based on router decision
 */
async function agentDispatcher(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  console.log('🎯 Agent Dispatcher: Calling selected agents');

  const selectedAgents = state.selectedAgents;
  const results: Record<string, string> = {};

  // Call agents sequentially (can be parallelized in production)
  for (const agentId of selectedAgents) {
    let agentResult: Partial<AgentStateType>;

    switch (agentId) {
      case 'hr':
        agentResult = await hrAgent(state);
        break;
      case 'accounting':
        agentResult = await accountingAgent(state);
        break;
      case 'legal':
        agentResult = await legalAgent(state);
        break;
      case 'it':
        agentResult = await itAgent(state);
        break;
      case 'general':
      default:
        agentResult = await generalAgent(state);
        break;
    }

    if (agentResult.agentResponses) {
      Object.assign(results, agentResult.agentResponses);
    }
  }

  return { agentResponses: results };
}

/**
 * Conditional routing function
 */
function routeAfterRouter(state: AgentStateType): string {
  if (!state.needsRetrieval) {
    return "simple_response";
  }
  return "retrieve";
}

/**
 * Build the multi-agent graph
 */
function buildGraph() {
  const workflow = new StateGraph(AgentStateAnnotation)
    // Add nodes
    .addNode("router", routerAgent)
    .addNode("retrieve", retrievalAgent)
    .addNode("agent_dispatcher", agentDispatcher)
    .addNode("simple_response", simpleResponseAgent)
    .addNode("synthesizer", synthesizerAgent)

    // Define edges
    .addEdge(START, "router")
    .addConditionalEdges("router", routeAfterRouter, {
      "simple_response": "simple_response",
      "retrieve": "retrieve"
    })
    .addEdge("retrieve", "agent_dispatcher")
    .addEdge("agent_dispatcher", "synthesizer")
    .addEdge("simple_response", "synthesizer")
    .addEdge("synthesizer", END);

  return workflow;
}

// Memory saver for persistence
const checkpointer = new MemorySaver();

// Compile the graph
const workflow = buildGraph();

// Export compiled graph without memory (for simple usage)
export const multiAgentGraph = workflow.compile();

// Export compiled graph with memory (for session persistence)
export const multiAgentGraphWithMemory = workflow.compile({
  checkpointer
});

/**
 * Helper function to invoke the graph
 */
export async function invokeMultiAgent(
  query: string,
  threadId?: string
): Promise<{
  response: string;
  consultedAgents: DepartmentId[];
}> {
  const input: Partial<AgentStateType> = {
    currentQuery: query,
    messages: [],
    retrievedChunks: [],
    agentResponses: {},
    selectedAgents: [],
    needsRetrieval: true
  };

  let result: AgentStateType;

  if (threadId) {
    // Use memory-enabled graph
    result = await multiAgentGraphWithMemory.invoke(input, {
      configurable: { thread_id: threadId }
    }) as AgentStateType;
  } else {
    // Simple invocation
    result = await multiAgentGraph.invoke(input) as AgentStateType;
  }

  return {
    response: result.finalResponse || 'Нет ответа',
    consultedAgents: result.selectedAgents || []
  };
}

/**
 * Stream multi-agent response with real Gemini streaming
 *
 * Flow:
 * 1. Run router → retrieval → agents (non-streaming, collect responses)
 * 2. Stream the synthesizer output (real streaming to UI)
 * 3. Return sources and consulted agents via callbacks
 *
 * @param query - Current user query
 * @param options - Optional configuration
 * @param options.history - Chat history for context
 * @param options.preferredDepartment - User's selected department (hint for router)
 * @param onStatus - Status callback for UI updates
 * @param onComplete - Completion callback with sources and agents
 */
export async function* streamMultiAgentWithGemini(
  query: string,
  options?: {
    history?: { role: string; content: string }[];
    preferredDepartment?: DepartmentId;
  },
  onStatus?: (status: { stage: string; details?: string }) => void,
  onComplete?: (data: { chunks: AgentChunk[]; consultedAgents: DepartmentId[]; validationResult?: ValidationResult }) => void
): AsyncGenerator<string> {
  // Import streaming function
  const { generateWithGeminiStream } = await import('./departmentAgents');

  const history = options?.history || [];
  const preferredDepartment = options?.preferredDepartment;

  onStatus?.({ stage: 'thinking', details: 'Анализирую запрос...' });

  // Convert history to Message format
  const messages = history.map((msg, idx) => ({
    id: `hist_${idx}`,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: Date.now() - (history.length - idx) * 1000
  }));

  // Step 1: Run router
  const routerInput: Partial<AgentStateType> = {
    currentQuery: query,
    messages,
    preferredDepartment,
    retrievedChunks: [],
    agentResponses: {},
    selectedAgents: [],
    needsRetrieval: true
  };

  const routerResult = await routerAgent(routerInput as AgentStateType);
  const selectedAgents = routerResult.selectedAgents || ['general'];
  const needsRetrieval = routerResult.needsRetrieval !== false;

  console.log('🎯 Router decided:', selectedAgents, 'needsRAG:', needsRetrieval);

  // Step 2: Retrieval (if needed)
  let retrievedChunks: AgentChunk[] = [];
  if (needsRetrieval) {
    onStatus?.({ stage: 'searching', details: 'Поиск в базе знаний...' });
    const retrievalResult = await retrievalAgent({
      ...routerInput,
      ...routerResult
    } as AgentStateType);
    retrievedChunks = retrievalResult.retrievedChunks || [];
    onStatus?.({ stage: 'found', details: `Найдено ${retrievedChunks.length} документов` });
  }

  // Step 3: Run department agents (non-streaming)
  onStatus?.({ stage: 'generating', details: `Консультация экспертов: ${selectedAgents.join(', ')}` });

  const agentResponses: Record<string, string> = {};
  const state: AgentStateType = {
    ...routerInput as AgentStateType,
    selectedAgents,
    needsRetrieval,
    retrievedChunks
  };

  for (const agentId of selectedAgents) {
    let agentResult: Partial<AgentStateType>;

    switch (agentId) {
      case 'hr':
        agentResult = await hrAgent(state);
        break;
      case 'accounting':
        agentResult = await accountingAgent(state);
        break;
      case 'legal':
        agentResult = await legalAgent(state);
        break;
      case 'it':
        agentResult = await itAgent(state);
        break;
      case 'general':
      default:
        if (!needsRetrieval) {
          agentResult = await simpleResponseAgent(state);
        } else {
          agentResult = await generalAgent(state);
        }
        break;
    }

    if (agentResult.agentResponses) {
      Object.assign(agentResponses, agentResult.agentResponses);
    }
  }

  // Step 4: Stream the synthesis (or direct response if single agent)
  const agentIds = Object.keys(agentResponses) as DepartmentId[];

  if (agentIds.length === 1) {
    // Single agent - stream the response directly
    let response = agentResponses[agentIds[0]];

    // Run hallucination checker
    onStatus?.({ stage: 'validating', details: 'Проверка источников...' });
    const { validatedResponse, validationResult } = await hallucinationCheckerAgent(
      response,
      retrievedChunks
    );
    response = validatedResponse;

    // Simulate streaming by yielding chunks
    const chunkSize = 20;
    for (let i = 0; i < response.length; i += chunkSize) {
      yield response.slice(i, i + chunkSize);
      await new Promise(r => setTimeout(r, 10)); // Small delay for typewriter effect
    }
    // Call onComplete with sources, agents, and validation result
    onComplete?.({ chunks: retrievedChunks, consultedAgents: selectedAgents, validationResult });
    return;
  }

  // Multiple agents - synthesize with streaming
  onStatus?.({ stage: 'generating', details: 'Синтез ответов...' });

  const responsesText = agentIds.map(agentId => {
    const dept = DEPARTMENTS.find(d => d.id === agentId);
    return `### ${dept?.name || agentId}:\n${agentResponses[agentId]}`;
  }).join('\n\n');

  const synthesisPrompt = `
Ты — Belhard AI. Объедини ответы от нескольких экспертов в один связный ответ.

ВОПРОС ПОЛЬЗОВАТЕЛЯ:
${query}

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

  // Collect full response for validation
  let fullSynthesisResponse = '';

  // Stream the synthesis response
  for await (const chunk of generateWithGeminiStream(synthesisPrompt, 'Синтезируй ответы')) {
    fullSynthesisResponse += chunk;
    yield chunk;
  }

  // Run hallucination checker on synthesized response
  onStatus?.({ stage: 'validating', details: 'Проверка источников...' });
  const { validatedResponse, validationResult } = await hallucinationCheckerAgent(
    fullSynthesisResponse,
    retrievedChunks
  );

  // If there are warnings, append them
  if (validatedResponse !== fullSynthesisResponse) {
    const additionalContent = validatedResponse.slice(fullSynthesisResponse.length);
    if (additionalContent) {
      yield additionalContent;
    }
  }

  // Call onComplete with sources, agents, and validation result
  onComplete?.({ chunks: retrievedChunks, consultedAgents: selectedAgents, validationResult });
}

/**
 * Legacy streaming (for compatibility)
 */
export async function* streamMultiAgent(
  query: string,
  threadId?: string
): AsyncGenerator<{
  type: 'status' | 'chunk' | 'complete';
  data: any;
}> {
  const input: Partial<AgentStateType> = {
    currentQuery: query,
    messages: [],
    retrievedChunks: [],
    agentResponses: {},
    selectedAgents: [],
    needsRetrieval: true
  };

  const config = threadId
    ? { configurable: { thread_id: threadId } }
    : undefined;

  const graph = threadId ? multiAgentGraphWithMemory : multiAgentGraph;

  // Stream events
  for await (const event of graph.streamEvents(input, {
    ...config,
    version: "v2"
  })) {
    if (event.event === "on_chain_start") {
      yield {
        type: 'status',
        data: { stage: event.name, status: 'started' }
      };
    }

    if (event.event === "on_chain_end") {
      yield {
        type: 'status',
        data: { stage: event.name, status: 'completed' }
      };
    }

    if (event.event === "on_llm_stream") {
      const chunk = event.data?.chunk;
      if (chunk?.content) {
        yield {
          type: 'chunk',
          data: chunk.content
        };
      }
    }
  }

  yield {
    type: 'complete',
    data: null
  };
}
