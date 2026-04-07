/**
 * API Client — centralized server communication
 */

import { ChatSession, Message, Source, DepartmentId, CountryId } from '../types';

// Backend URL: env var in production (Render), proxy in dev
const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

function url(path: string): string {
  return `${API_BASE}${path}`;
}

function headers(): Record<string, string> {
  const token = localStorage.getItem('belhard_access_token');
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function safeFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url(path), { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch {
    clearTimeout(timeout);
    throw new Error('API_UNAVAILABLE');
  }
}

// ==================== CHATS ====================

export async function fetchChats(): Promise<ChatSession[]> {
  const res = await safeFetch('/api/chats', { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((c: any) => ({
    id: c.id, title: c.title, preview: c.preview || '',
    lastUpdated: c.last_updated, department: c.department, archived: !!c.archived,
  }));
}

export async function createChat(title: string, department: DepartmentId, country: CountryId): Promise<ChatSession> {
  const res = await safeFetch('/api/chats', {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ title, department, country }),
  });
  const data = await res.json();
  return { id: data.id, title: data.title, preview: '', lastUpdated: data.last_updated || Date.now(), department: data.department };
}

export async function fetchChatMessages(chatId: string): Promise<Message[]> {
  const res = await safeFetch(`/api/chats/${chatId}`), { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.messages || []).map((m: any) => ({
    id: m.id, role: m.role, content: m.content,
    timestamp: m.created_at, department: m.department, sources: m.sources || [],
  }));
}

export async function saveMessage(chatId: string, role: string, content: string, department?: string, sources?: any[]): Promise<void> {
  await safeFetch(`/api/chats/${chatId}/messages`), {
    method: 'POST', headers: headers(),
    body: JSON.stringify({ role, content, department, sources }),
  });
}

export async function deleteChat(chatId: string): Promise<void> {
  await safeFetch(`/api/chats/${chatId}`), { method: 'DELETE', headers: headers() });
}

export async function renameChat(chatId: string, title: string): Promise<void> {
  await safeFetch(`/api/chats/${chatId}`), {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ title }),
  });
}

export async function archiveChat(chatId: string, archived: boolean): Promise<void> {
  await safeFetch(`/api/chats/${chatId}`), {
    method: 'PATCH', headers: headers(), body: JSON.stringify({ archived }),
  });
}

// ==================== DOCUMENTS ====================

export async function fetchDocuments(country?: string): Promise<Source[]> {
  const path = country ? `/api/documents?country=${country}` : '/api/documents';
  const res = await safeFetch(path, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((d: any) => ({
    id: d.id, title: d.title, type: d.type, citation: d.citation,
    url: d.url, preview: d.preview, adoptedDate: d.adopted_date,
    lastUpdated: d.last_updated, country: d.country,
  }));
}

export async function fetchDocumentFull(docId: string): Promise<Source | null> {
  const res = await safeFetch(`/api/documents/${docId}`), { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}

// ==================== LLM STREAMING ====================

export interface StreamCallbacks {
  onStatus?: (status: { stage: string; details?: string; documents?: string[] }) => void;
  onChunk?: (text: string) => void;
  onComplete?: (sources: any[]) => void;
  onError?: (error: string) => void;
}

export async function streamLLMResponse(
  chatId: string | null, message: string,
  departmentId: DepartmentId, countryId: CountryId,
  history: Message[], callbacks: StreamCallbacks,
): Promise<void> {
  const res = await fetch(url('/api/llm/stream'), {
    method: 'POST', headers: headers(),
    body: JSON.stringify({
      chatId, message, departmentId, countryId,
      history: history.slice(-10).map(m => ({ role: m.role, content: m.content })),
    }),
  });

  if (!res.ok) { callbacks.onError?.(`Server error: ${res.status}`); return; }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;
      try {
        const data = JSON.parse(raw);
        if (data.status) callbacks.onStatus?.(data.status);
        if (data.text) callbacks.onChunk?.(data.text);
        if (data.done) callbacks.onComplete?.(data.sources || []);
        if (data.error) callbacks.onError?.(data.error);
      } catch { /* skip */ }
    }
  }
}
