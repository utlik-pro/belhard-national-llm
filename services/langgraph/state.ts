/**
 * LangGraph State Definitions
 *
 * Определяет состояние, которое передается между узлами графа
 */

import { Annotation } from "@langchain/langgraph";
import { DepartmentId, Message, AgentChunk, UserMemory } from '../../types';

// State Annotation for LangGraph
export const AgentStateAnnotation = Annotation.Root({
  // Input
  messages: Annotation<Message[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
  currentQuery: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => "",
  }),
  // User's preferred department (hint for router)
  preferredDepartment: Annotation<DepartmentId | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined,
  }),

  // Router decisions
  selectedAgents: Annotation<DepartmentId[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),
  needsRetrieval: Annotation<boolean>({
    reducer: (prev, next) => next ?? prev,
    default: () => true,
  }),

  // Retrieved context
  retrievedChunks: Annotation<AgentChunk[]>({
    reducer: (prev, next) => next ?? prev,
    default: () => [],
  }),

  // Agent responses (accumulates from multiple agents)
  agentResponses: Annotation<Record<string, string>>({
    reducer: (prev, next) => ({ ...prev, ...next }),
    default: () => ({}),
  }),

  // Final output
  finalResponse: Annotation<string>({
    reducer: (prev, next) => next ?? prev,
    default: () => "",
  }),

  // Memory (optional)
  memory: Annotation<UserMemory | undefined>({
    reducer: (prev, next) => next ?? prev,
    default: () => undefined,
  }),
});

// Type inference from annotation
export type AgentStateType = typeof AgentStateAnnotation.State;
