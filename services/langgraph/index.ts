/**
 * LangGraph Multi-Agent System
 *
 * Экспорты для интеграции с основным приложением
 */

// Main graph exports
export {
  multiAgentGraph,
  multiAgentGraphWithMemory,
  invokeMultiAgent,
  streamMultiAgent,
  streamMultiAgentWithGemini
} from './multiAgentGraph';

// State types
export { AgentStateAnnotation, type AgentStateType } from './state';

// Individual agents (for testing/debugging)
export { routerAgent } from './routerAgent';
export { retrievalAgent } from './retrievalAgent';
export {
  hrAgent,
  accountingAgent,
  legalAgent,
  itAgent,
  generalAgent,
  simpleResponseAgent
} from './departmentAgents';
export { synthesizerAgent } from './synthesizerAgent';
export {
  hallucinationCheckerAgent,
  validateResponse,
  extractCitationsFromResponse,
  type ValidationResult
} from './hallucinationChecker';
