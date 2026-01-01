
export type Role = 'user' | 'assistant' | 'system';

export type DepartmentId = 'general' | 'accounting' | 'hr' | 'legal' | 'it';

export interface Source {
  id: string;
  title: string;
  type: 'PDF' | 'DOC' | 'XLSX' | 'WEB';
  citation: string;
  url: string;
  preview?: string;
  fullContent?: string;
  adoptedDate?: string;
  lastUpdated?: string;
  sections?: DocumentSection[];
}

export interface DocumentSection {
  number: string;
  title: string;
  chapters: DocumentChapter[];
}

export interface DocumentChapter {
  number: string;
  title: string;
  articles: DocumentArticle[];
}

export interface DocumentArticle {
  number: string;
  title: string;
  content: string;
  paragraphs: DocumentParagraph[];
}

export interface DocumentParagraph {
  number: string;
  text: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  department?: DepartmentId;
  sources?: Source[];
  isStreaming?: boolean;
  generationStatus?: {
    stage: 'thinking' | 'searching' | 'found' | 'generating';
    details?: string;
    documents?: string[];
  };
  // Multi-agent fields
  agentId?: DepartmentId;
  consultedAgents?: DepartmentId[];
  isMultiAgentResponse?: boolean;
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  lastUpdated: number;
  department: DepartmentId;
  messages?: Message[];
  archived?: boolean;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
}

// --- LangGraph Multi-Agent Types ---

export interface AgentState {
  messages: Message[];
  currentQuery: string;
  selectedAgents: DepartmentId[];
  agentResponses: Record<string, string>;
  retrievedChunks: AgentChunk[];
  finalResponse?: string;
  needsRetrieval?: boolean;
  memory?: UserMemory;
}

export interface AgentChunk {
  id: string;
  sourceId: string;
  citation: string;
  path: string;
  content: string;
  chunkType?: string;
}

export interface UserMemory {
  userId: string;
  preferences: Record<string, string>;
  frequentTopics: string[];
  lastInteractions: { topic: string; timestamp: number }[];
}

export interface RouterDecision {
  agents: DepartmentId[];
  needsRAG: boolean;
  reasoning?: string;
}

export interface AgentResponse {
  agentId: DepartmentId;
  content: string;
  sources: Source[];
  confidence?: number;
}
