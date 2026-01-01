/**
 * useChat Hook
 *
 * Управляет состоянием чата, сообщениями и операциями с чатами.
 */

import { useState, useCallback, useEffect } from 'react';
import { Message, ChatSession, DepartmentId, Source } from '../types';
import { streamResponse } from '../services/mockApiService';
import { streamMultiAgentWithGemini } from '../services/langgraph';

export interface UseChatResult {
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  currentChatId: string | null;
  setCurrentChatId: React.Dispatch<React.SetStateAction<string | null>>;
  isGenerating: boolean;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  sendMessage: (
    content: string,
    history: ChatSession[],
    selectedDepartment: DepartmentId,
    sources: Source[],
    useMultiAgent: boolean,
    userId?: string
  ) => Promise<void>;
  selectChat: (
    chatId: string,
    chatHistory: ChatSession[]
  ) => void;
  createNewChat: (
    department: DepartmentId,
    setChatHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>
  ) => string;
}

export function useChat(): UseChatResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [input, setInput] = useState('');

  // Select a chat and load its messages
  const selectChat = useCallback((
    chatId: string,
    chatHistory: ChatSession[]
  ) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      setCurrentChatId(chatId);
      setMessages(chat.messages || []);
    }
  }, []);

  // Create a new chat
  const createNewChat = useCallback((
    department: DepartmentId,
    setChatHistory: React.Dispatch<React.SetStateAction<ChatSession[]>>
  ): string => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: 'Новый диалог',
      preview: 'Выберите отдел и задайте вопрос...',
      lastUpdated: Date.now(),
      department,
      messages: []
    };

    setChatHistory(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessages([]);

    return newChat.id;
  }, []);

  // Send a message and get AI response
  const sendMessage = useCallback(async (
    content: string,
    chatHistory: ChatSession[],
    selectedDepartment: DepartmentId,
    sources: Source[],
    useMultiAgent: boolean,
    userId?: string
  ) => {
    if (!content.trim() || isGenerating) return;

    // Create user message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      department: selectedDepartment
    };

    // Build history for AI
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setIsGenerating(true);

    // Create AI placeholder
    const aiMsgId = (Date.now() + 1).toString();
    const aiMsgPlaceholder: Message = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      department: selectedDepartment,
      isStreaming: true,
      generationStatus: {
        stage: 'thinking',
        details: useMultiAgent ? 'Мульти-агентный режим...' : 'Думаю...'
      }
    };

    setMessages(prev => [...prev, aiMsgPlaceholder]);

    try {
      if (useMultiAgent) {
        // LangGraph Multi-Agent Mode with Streaming
        console.log('🤖 Using LangGraph Multi-Agent System with Streaming');

        let fullContent = '';
        const stream = streamMultiAgentWithGemini(
          content,
          (status) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? {
                ...m,
                generationStatus: status as any
              } : m
            ));
          }
        );

        for await (const chunk of stream) {
          fullContent += chunk;
          setMessages(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, content: fullContent } : m
          ));
        }

        setMessages(prev => prev.map(m =>
          m.id === aiMsgId ? {
            ...m,
            content: fullContent,
            isStreaming: false,
            isMultiAgentResponse: true,
            generationStatus: undefined
          } : m
        ));

      } else {
        // Original streaming mode
        await streamResponse(
          history,
          selectedDepartment,
          sources,
          (chunk) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
            ));
          },
          (relevantSources) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? {
                ...m,
                isStreaming: false,
                sources: relevantSources,
                generationStatus: undefined
              } : m
            ));
          },
          (status) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, generationStatus: status } : m
            ));
          }
        );
      }
    } catch (err) {
      console.error("Message sending failed", err);
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? {
          ...m,
          isStreaming: false,
          content: m.content + "\n[Ошибка отправки сообщения]",
          generationStatus: undefined
        } : m
      ));
    } finally {
      setIsGenerating(false);
    }
  }, [messages, isGenerating]);

  return {
    messages,
    setMessages,
    currentChatId,
    setCurrentChatId,
    isGenerating,
    input,
    setInput,
    sendMessage,
    selectChat,
    createNewChat
  };
}
