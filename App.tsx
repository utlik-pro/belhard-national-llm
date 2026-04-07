import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import LandingPage from './components/LandingPage';
import DocumentViewer from './components/DocumentViewer';
import DocumentEditor from './components/DocumentEditor';
import HelpPage from './components/HelpPage';
import AppLoadingScreen from './components/AppLoadingScreen';
import AppHeader from './components/AppHeader';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import { Message, ChatSession, AuthState, DepartmentId, CountryId, Source } from './types';
import { INITIAL_CHATS, MOCK_SOURCES, COUNTRY_CONFIGS } from './constants';
import { streamResponse } from './services/mockApiService';
import { streamMultiAgentWithGemini } from './services/langgraph';
import { indexedDB } from './services/indexedDBService';
import { migrationService, MigrationProgress } from './services/migrationService';
import { chunkingService } from './services/chunkingService';
import { embeddingService } from './services/embeddingService';
import { userDB } from './services/userDBService';
import * as api from './services/apiClient';

// Main App Component
const App: React.FC = () => {
  // Auth State
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: false,
    error: null
  });

  // DB Initialization State
  const [isDBReady, setIsDBReady] = useState(false);
  const [dbInitProgress, setDbInitProgress] = useState<MigrationProgress>({
    step: 'Инициализация...',
    current: 0,
    total: 100,
    percentage: 0
  });

  // Chat State
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  // Country & Department State
  const [selectedCountry, setSelectedCountry] = useState<CountryId>('belarus');
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentId>('general');

  // Landing / Auth View State
  const [appView, setAppView] = useState<'landing' | 'login' | 'register' | 'app'>('landing');
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useMultiAgent, setUseMultiAgent] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHelpPage, setShowHelpPage] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Knowledge Base State
  const [sources, setSources] = useState<Source[]>([]);
  const [indexedSourceIds, setIndexedSourceIds] = useState<Set<string>>(new Set());

  // Document Viewer/Editor State
  const [viewingDocument, setViewingDocument] = useState<Source | null>(null);
  const [documentHighlightText, setDocumentHighlightText] = useState<string>('');
  const [editingDocument, setEditingDocument] = useState<Source | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // ==================== Session Restoration ====================
  useEffect(() => {
    async function restoreSession() {
      try {
        await userDB.init();
        await userDB.seedDemoUsers();
        const savedUser = await userDB.restoreSession();
        if (savedUser) {
          setAuth({
            isAuthenticated: true,
            user: {
              id: savedUser.id,
              email: savedUser.email,
              name: savedUser.name,
              avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(savedUser.name)}`,
              country: savedUser.country as CountryId,
            },
            isLoading: false,
            error: null,
          });
          setSelectedCountry(savedUser.country as CountryId);
          setAppView('app');
        }
      } catch (e) {
        console.warn('Session restore failed:', e);
      } finally {
        setIsRestoringSession(false);
      }
    }
    restoreSession();
  }, []);

  // ==================== Database Initialization ====================
  useEffect(() => {
    async function initializeDatabase() {
      try {
        console.log('🔄 Initializing IndexedDB...');

        setDbInitProgress({
          step: 'Инициализация базы данных...',
          current: 0,
          total: 100,
          percentage: 0
        });

        await indexedDB.init();
        console.log('✅ IndexedDB initialized');

        // Check if migration is needed
        const needsMigration = await migrationService.needsMigration();

        if (needsMigration) {
          console.log('🔄 Migration needed, starting migration...');
          await migrationService.migrate((progress) => {
            setDbInitProgress(progress);
          });
          console.log('✅ Migration completed');
        } else {
          console.log('ℹ️ No migration needed');
          setDbInitProgress({
            step: 'Загрузка данных...',
            current: 50,
            total: 100,
            percentage: 50
          });
        }

        // Load documents from IndexedDB
        setDbInitProgress({
          step: 'Загрузка документов...',
          current: 60,
          total: 100,
          percentage: 60
        });

        let allDocuments = await indexedDB.getAllDocuments();
        console.log(`📊 Loaded ${allDocuments.length} documents from IndexedDB`);

        // Import from MOCK_SOURCES if needed (better quality than parsed JSON files)
        if (allDocuments.length < 5) {
          console.log('📥 Importing from MOCK_SOURCES (high-quality data)...');

          setDbInitProgress({
            step: 'Импорт документов из базы знаний...',
            current: 70,
            total: 100,
            percentage: 70
          });

          // Use MOCK_SOURCES instead of poorly parsed JSON files
          for (let i = 0; i < MOCK_SOURCES.length; i++) {
            const source = MOCK_SOURCES[i];
            await indexedDB.saveDocument(source);

            const percentage = 70 + Math.round(((i + 1) / MOCK_SOURCES.length) * 15);
            setDbInitProgress({
              step: `Импорт документов (${i + 1}/${MOCK_SOURCES.length})...`,
              current: i + 1,
              total: MOCK_SOURCES.length,
              percentage
            });
          }

          console.log(`✅ Imported ${MOCK_SOURCES.length} documents from MOCK_SOURCES`);
          allDocuments = await indexedDB.getAllDocuments();
        }

        // Import SOTRUDNIKI_2025 from public data if not exists
        const hasEmployeeDoc = allDocuments.some(d => d.id === 'SOTRUDNIKI_2025');
        if (!hasEmployeeDoc) {
          console.log('📥 Importing SOTRUDNIKI_2025 from public data...');
          try {
            const response = await fetch('/data/documents/SOTRUDNIKI_2025.json');
            if (response.ok) {
              const employeeDoc = await response.json();
              await indexedDB.saveDocument(employeeDoc);
              allDocuments = await indexedDB.getAllDocuments();
              console.log('✅ SOTRUDNIKI_2025 imported successfully');
            }
          } catch (err) {
            console.warn('⚠️ Failed to import SOTRUDNIKI_2025:', err);
          }
        }

        // Import KLIENTY_2025 from public data if not exists
        const hasClientDoc = allDocuments.some(d => d.id === 'KLIENTY_2025');
        if (!hasClientDoc) {
          console.log('📥 Importing KLIENTY_2025 from public data...');
          try {
            const response = await fetch('/data/documents/KLIENTY_2025.json');
            if (response.ok) {
              const clientDoc = await response.json();
              await indexedDB.saveDocument(clientDoc);
              allDocuments = await indexedDB.getAllDocuments();
              console.log('✅ KLIENTY_2025 imported successfully');
            }
          } catch (err) {
            console.warn('⚠️ Failed to import KLIENTY_2025:', err);
          }
        }

        // Import FINANCE_BELHARD_2025 from public data if not exists
        const hasFinanceDoc = allDocuments.some(d => d.id === 'FINANCE_BELHARD_2025');
        if (!hasFinanceDoc) {
          console.log('📥 Importing FINANCE_BELHARD_2025 from public data...');
          try {
            const response = await fetch('/data/documents/FINANCE_BELHARD_2025.json');
            if (response.ok) {
              const financeDoc = await response.json();
              await indexedDB.saveDocument(financeDoc);
              allDocuments = await indexedDB.getAllDocuments();
              console.log('✅ FINANCE_BELHARD_2025 imported successfully');
            }
          } catch (err) {
            console.warn('⚠️ Failed to import FINANCE_BELHARD_2025:', err);
          }
        }

        // Import Azerbaijan documents from public data
        const azDocIds = ['EMEK_AZ', 'AILE_AZ', 'MULKI_AZ', 'VERGI_AZ', 'MENZIL_AZ', 'TORPAQ_AZ', 'CINAYAT_AZ'];
        for (const azDocId of azDocIds) {
          const hasDoc = allDocuments.some(d => d.id === azDocId);
          if (!hasDoc) {
            try {
              const response = await fetch(`/data/documents/${azDocId}.json`);
              if (response.ok) {
                const azDoc = await response.json();
                await indexedDB.saveDocument(azDoc);
                console.log(`✅ ${azDocId} imported`);
              }
            } catch (err) {
              console.warn(`⚠️ Failed to import ${azDocId}:`, err);
            }
          }
        }
        allDocuments = await indexedDB.getAllDocuments();

        setSources(allDocuments);
        console.log(`✅ Total documents: ${allDocuments.length}`);

        // Load pre-built chunks from static file (generated by scripts/prebuild-chunks.cjs)
        setDbInitProgress({
          step: 'Загрузка chunks...',
          current: 87,
          total: 100,
          percentage: 87
        });

        let existingChunks = await indexedDB.getAllChunks();
        console.log(`📊 Existing chunks in IndexedDB: ${existingChunks.length}`);

        if (existingChunks.length === 0) {
          try {
            console.log('📥 Loading pre-built chunks from /data/chunks.json...');
            const chunksResponse = await fetch('/data/chunks.json');
            if (chunksResponse.ok) {
              const prebuiltChunks = await chunksResponse.json();
              console.log(`📦 Loaded ${prebuiltChunks.length} pre-built chunks, saving to IndexedDB...`);

              // Batch save in single transaction
              const batchSize = 500;
              for (let i = 0; i < prebuiltChunks.length; i += batchSize) {
                const batch = prebuiltChunks.slice(i, i + batchSize);
                for (const chunk of batch) {
                  await indexedDB.saveChunk(chunk);
                }
                const pct = 87 + Math.round(((i + batchSize) / prebuiltChunks.length) * 5);
                setDbInitProgress({
                  step: `Загрузка chunks (${Math.min(i + batchSize, prebuiltChunks.length)}/${prebuiltChunks.length})...`,
                  current: Math.min(i + batchSize, prebuiltChunks.length),
                  total: prebuiltChunks.length,
                  percentage: Math.min(pct, 92)
                });
              }
              existingChunks = prebuiltChunks;
              console.log(`✅ Loaded ${prebuiltChunks.length} pre-built chunks`);
            } else {
              console.warn('⚠️ Pre-built chunks not found, falling back to runtime chunking...');
              // Fallback: chunk at runtime for documents without chunks
              for (const doc of allDocuments) {
                const chunks = chunkingService.chunkDocument(doc);
                for (const chunk of chunks) {
                  await indexedDB.saveChunk(chunk);
                }
              }
              existingChunks = await indexedDB.getAllChunks();
            }
          } catch (err) {
            console.warn('⚠️ Failed to load pre-built chunks:', err);
          }
        } else {
          console.log(`✅ Using ${existingChunks.length} cached chunks from IndexedDB`);
        }

        // Update indexed source IDs for UI
        const finalChunkedIds = new Set(existingChunks.map((c: any) => c.sourceId));
        setIndexedSourceIds(finalChunkedIds);
        console.log(`📊 Indexed documents: ${finalChunkedIds.size}`);

        // Load chats from server
        setDbInitProgress({
          step: 'Загрузка истории чатов...',
          current: 90,
          total: 100,
          percentage: 90
        });

        try {
          const serverChats = await api.fetchChats();
          setChatHistory(serverChats.length > 0 ? serverChats : INITIAL_CHATS);
          console.log(`✅ Loaded ${serverChats.length} chats from server`);
        } catch {
          // Fallback: IndexedDB chats
          const allChats = await indexedDB.getAllChats();
          setChatHistory(allChats.length > 0 ? allChats : INITIAL_CHATS);
        }

        // Load documents from server
        try {
          const serverDocs = await api.fetchDocuments();
          if (serverDocs.length > 0) {
            setSources(serverDocs);
            console.log(`✅ Loaded ${serverDocs.length} documents from server`);
          }
        } catch {
          console.warn('⚠️ Server docs failed, using local');
        }

        // Finalize
        setDbInitProgress({
          step: 'Готово!',
          current: 100,
          total: 100,
          percentage: 100
        });

        setTimeout(() => {
          setIsDBReady(true);
          console.log('✅ App is ready');
        }, 500);

      } catch (error) {
        console.error('❌ Failed to initialize database:', error);

        setSources(MOCK_SOURCES);
        setChatHistory(INITIAL_CHATS);
        setIsDBReady(true);
      }
    }

    if (auth.isAuthenticated) {
      initializeDatabase();
    }
  }, [auth.isAuthenticated]);

  // ==================== Persistence Effects ====================
  // Chats are now saved server-side via /api/chats — no local sync needed

  // Save messages to current chat state (for display)
  // Server saves messages automatically during LLM streaming

  // Save messages to current chat
  useEffect(() => {
    if (currentChatId) {
      setChatHistory(prev => {
        const currentChat = prev.find(c => c.id === currentChatId);
        if (currentChat && JSON.stringify(currentChat.messages) !== JSON.stringify(messages)) {
          return prev.map(chat =>
            chat.id === currentChatId
              ? { ...chat, messages, lastUpdated: Date.now() }
              : chat
          );
        }
        return prev;
      });
    }
  }, [messages, currentChatId]);

  // Load messages when selecting a different chat
  useEffect(() => {
    if (currentChatId && chatHistory.length > 0) {
      const chat = chatHistory.find(c => c.id === currentChatId);
      if (chat && chat.messages && chat.messages.length > 0) {
        if (JSON.stringify(messages) !== JSON.stringify(chat.messages)) {
          console.log(`📥 Loading ${chat.messages.length} messages from chat ${currentChatId}`);
          setMessages(chat.messages);
        }
      }
    }
  }, [currentChatId]);

  // ==================== Auth Handlers ====================
  const handleLogin = async (email: string, country: CountryId = 'belarus') => {
    const countryConfig = COUNTRY_CONFIGS[country];
    setSelectedCountry(country);

    // Fetch user info from DB
    let userName = email.split('@')[0];
    try {
      const dbUser = await userDB.findByEmail(email);
      if (dbUser) userName = dbUser.name;
    } catch { /* use fallback name */ }

    setAuth({
      isAuthenticated: true,
      user: {
        id: 'u1',
        email,
        name: userName,
        avatarUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(userName)}`,
        country,
      },
      isLoading: false,
      error: null
    });

    // Set default department for the selected country
    const defaultDept = countryConfig.departments[0].id;
    setSelectedDepartment(defaultDept);

    // Start with a fresh chat for the selected country
    setCurrentChatId(null);
    setMessages([]);
    setChatHistory(countryConfig.initialChats);
    setAppView('app');
  };

  const handleLogout = async () => {
    await userDB.logout();
    setAuth({ isAuthenticated: false, user: null, isLoading: false, error: null });
    setAppView('landing');
  };

  // ==================== AI Response Generation ====================
  const generateAIResponse = async (history: Message[]) => {
    setIsGenerating(true);

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

        const lastMessage = history[history.length - 1];
        const chatHistoryForLangGraph = history.slice(0, -1).map(msg => ({
          role: msg.role,
          content: msg.content
        }));

        let relevantSources: Source[] = [];
        let consultedAgents: DepartmentId[] = [];

        let fullContent = '';
        const stream = streamMultiAgentWithGemini(
          lastMessage.content,
          {
            history: chatHistoryForLangGraph,
            preferredDepartment: selectedDepartment
          },
          (status) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, generationStatus: status as any } : m
            ));
          },
          (data) => {
            const uniqueSourceIds = [...new Set(data.chunks.map(c => c.sourceId))];
            relevantSources = sources.filter(s => uniqueSourceIds.includes(s.id));
            consultedAgents = data.consultedAgents;
            console.log('📚 LangGraph sources:', relevantSources.map(s => s.title));
            console.log('🤖 Consulted agents:', consultedAgents);
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
            consultedAgents: consultedAgents,
            sources: relevantSources,
            generationStatus: undefined
          } : m
        ));
        setIsGenerating(false);

      } else {
        // Try server-side streaming, fallback to direct client-side LLM
        let usedServer = false;
        try {
          let accumulatedText = '';
          await api.streamLLMResponse(
            currentChatId,
            history[history.length - 1].content,
            selectedDepartment,
            selectedCountry,
            history.slice(0, -1),
            {
              onStatus: (status) => {
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, generationStatus: status as any } : m
                ));
              },
              onChunk: (chunk) => {
                usedServer = true;
                accumulatedText += chunk;
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, content: accumulatedText } : m
                ));
              },
              onComplete: (citedSources) => {
                const relevantSources = citedSources.map((s: any) => sources.find(src => src.id === s.id) || s);
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, isStreaming: false, sources: relevantSources, generationStatus: undefined } : m
                ));
                setIsGenerating(false);
              },
              onError: (error) => {
                if (!usedServer) throw new Error(error); // No data received — trigger fallback
                setMessages(prev => prev.map(m =>
                  m.id === aiMsgId ? { ...m, isStreaming: false, content: accumulatedText + `\n\n[Ошибка: ${error}]`, generationStatus: undefined } : m
                ));
                setIsGenerating(false);
              },
            },
          );
          if (usedServer) return; // Server handled it successfully
        } catch (serverErr) {
          console.warn('Server LLM unavailable, falling back to direct API:', serverErr);
        }

        // Fallback: direct client-side Gemini/OpenAI (old path)
        const countrySources = selectedCountry === 'azerbaijan'
          ? sources.filter(s => (s as any).country === 'azerbaijan')
          : sources.filter(s => !(s as any).country || (s as any).country === 'belarus');

        await streamResponse(
          history,
          selectedDepartment,
          countrySources,
          (chunk) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, content: m.content + chunk } : m
            ));
          },
          (relevantSources) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, isStreaming: false, sources: relevantSources, generationStatus: undefined } : m
            ));
            setIsGenerating(false);
          },
          (status) => {
            setMessages(prev => prev.map(m =>
              m.id === aiMsgId ? { ...m, generationStatus: status } : m
            ));
          },
          COUNTRY_CONFIGS[selectedCountry].departments,
          selectedCountry,
        );
      }
    } catch (err) {
      console.error("Message sending failed", err);
      setIsGenerating(false);
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId ? {
          ...m,
          isStreaming: false,
          content: m.content + "\n[Ошибка отправки сообщения]",
          generationStatus: undefined
        } : m
      ));
    }
  };

  // ==================== Message Handlers ====================
  const handleSendMessage = async () => {
    if (!input.trim() || isGenerating) return;

    const userText = input;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: Date.now()
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput('');

    // Auto-name chat based on first message
    if (messages.length === 0 && currentChatId) {
      const generateTitle = (text: string): string => {
        const firstSentence = text.split(/[.!?]/)[0].trim();
        if (firstSentence.length > 0 && firstSentence.length <= 60) {
          return firstSentence;
        }
        return text.substring(0, 60).trim() + (text.length > 60 ? '...' : '');
      };

      const newTitle = generateTitle(userText);
      setChatHistory(prev => prev.map(chat =>
        chat.id === currentChatId
          ? { ...chat, title: newTitle, preview: userText.substring(0, 100) }
          : chat
      ));
    }

    await generateAIResponse(newHistory);
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const updatedMessage = { ...messages[msgIndex], content: newContent };
    const newHistory = [...messages.slice(0, msgIndex), updatedMessage];

    setMessages(newHistory);
    await generateAIResponse(newHistory);
  };

  const handleRegenerateMessage = async (messageId: string) => {
    const msgIndex = messages.findIndex(m => m.id === messageId);
    if (msgIndex === -1) return;

    const newHistory = messages.slice(0, msgIndex);
    setMessages(newHistory);
    await generateAIResponse(newHistory);
  };

  // ==================== Chat Management ====================
  const handleNewChat = async () => {
    try {
      const newChat = await api.createChat('Новый диалог', selectedDepartment, selectedCountry);
      setChatHistory(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      setMessages([]);
    } catch (e) {
      console.error('Failed to create chat:', e);
      // Fallback: local-only chat
      const newChat: ChatSession = { id: Date.now().toString(), title: 'Новый диалог', preview: '', lastUpdated: Date.now(), department: selectedDepartment };
      setChatHistory(prev => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      setMessages([]);
    }
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  const handleDeleteChat = (id: string) => {
    setChatHistory(prev => {
      const newChats = prev.filter(c => c.id !== id);

      if (currentChatId === id && newChats.length > 0) {
        setCurrentChatId(newChats[0].id);
        setSelectedDepartment(newChats[0].department || 'general');
        setMessages(newChats[0].messages || []);
      } else if (newChats.length === 0) {
        setCurrentChatId(null);
        setMessages([]);
      }

      return newChats;
    });

    api.deleteChat(id).catch(e => console.error('Failed to delete chat:', e));
  };

  const handleArchiveChat = (id: string) => {
    setChatHistory(prev => {
      const targetChat = prev.find(c => c.id === id);
      if (!targetChat) return prev;

      const newChats = prev.map(c =>
        c.id === id ? { ...c, archived: !c.archived } : c
      );

      if (currentChatId === id && !targetChat.archived) {
        const firstNonArchived = newChats.find(c => !c.archived);
        if (firstNonArchived) {
          setCurrentChatId(firstNonArchived.id);
          setSelectedDepartment(firstNonArchived.department || 'general');
          setMessages(firstNonArchived.messages || []);
        } else {
          setCurrentChatId(null);
          setMessages([]);
        }
      }

      return newChats;
    });
  };

  const handleRenameChat = (id: string, newTitle: string) => {
    if (!newTitle.trim()) return;
    setChatHistory(prev =>
      prev.map(c => c.id === id ? { ...c, title: newTitle.trim() } : c)
    );
  };

  // ==================== Knowledge Base ====================
  const handleOpenAddSource = () => {
    setEditingDocument(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditSource = (source: Source) => {
    setEditingDocument(source);
    setIsEditorOpen(true);
  };

  const handleSaveSource = async (source: Source) => {
    if (editingDocument) {
      // When editing, recreate chunks for the updated document
      console.log(`📝 Updating document: ${source.citation}`);

      // Delete old chunks first
      await indexedDB.deleteChunksBySourceId(source.id);

      // Create new chunks for updated content
      let chunks = chunkingService.chunkDocument(source);
      if (chunks.length > 0) {
        // Generate embeddings for semantic search
        if (embeddingService.isAvailable()) {
          console.log(`🔄 Generating embeddings for ${chunks.length} chunks...`);
          chunks = await embeddingService.embedChunks(chunks);
        }
        await indexedDB.saveChunks(chunks);
        console.log(`✅ Recreated ${chunks.length} chunks for ${source.citation}`);
        // Update indexed status
        setIndexedSourceIds(prev => new Set([...prev, source.id]));
      } else {
        console.warn(`⚠️ No chunks created for ${source.citation} - document may be too short`);
        // Remove from indexed if no chunks
        setIndexedSourceIds(prev => {
          const next = new Set(prev);
          next.delete(source.id);
          return next;
        });
      }

      setSources(prev => prev.map(s => s.id === source.id ? source : s));
    } else {
      // New document - create chunks IMMEDIATELY (not via useEffect)
      console.log(`📝 Adding new document: ${source.citation}`);

      // Save document to IndexedDB first
      await indexedDB.saveDocument(source);

      // Create chunks
      let chunks = chunkingService.chunkDocument(source);
      if (chunks.length > 0) {
        // Generate embeddings for semantic search
        if (embeddingService.isAvailable()) {
          console.log(`🔄 Generating embeddings for ${chunks.length} chunks...`);
          chunks = await embeddingService.embedChunks(chunks);
        }
        await indexedDB.saveChunks(chunks);
        console.log(`✅ Created ${chunks.length} chunks with embeddings for new document ${source.citation}`);
        // Update indexed status
        setIndexedSourceIds(prev => new Set([...prev, source.id]));
      } else {
        console.warn(`⚠️ No chunks created for ${source.citation} - document may be too short or have unsupported structure`);
        // Mark as not indexed
        setIndexedSourceIds(prev => {
          const next = new Set(prev);
          next.delete(source.id);
          return next;
        });
      }

      setSources(prev => [source, ...prev]);
    }
  };

  const handleDeleteSource = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот документ из базы знаний?')) {
      setSources(prev => prev.filter(s => s.id !== id));
      // Remove from indexed status
      setIndexedSourceIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      indexedDB.deleteDocument(id).catch(e => console.error('Failed to delete document:', e));
    }
  };

  // ==================== UI Handlers ====================
  const handleViewSource = (source: Source, highlightText?: string) => {
    const fullSource = sources.find(s => s.id === source.id) || source;
    setViewingDocument(fullSource);
    setDocumentHighlightText(highlightText || '');
  };

  const handleCloseViewer = () => {
    setViewingDocument(null);
    setDocumentHighlightText('');
  };

  const handleSelectChat = async (id: string) => {
    const chat = chatHistory.find(c => c.id === id);
    if (chat) {
      setCurrentChatId(id);
      setSelectedDepartment(chat.department || 'general');
      // Load messages from server
      try {
        const msgs = await api.fetchChatMessages(id);
        setMessages(msgs);
      } catch {
        setMessages(chat.messages || []);
      }
    }
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  // ==================== Render ====================

  // Session restoration in progress
  if (isRestoringSession) {
    return <AppLoadingScreen progress={{ step: 'Восстановление сессии...', current: 0, total: 100, percentage: 0 }} />;
  }

  // Loading screen
  if (auth.isAuthenticated && !isDBReady) {
    return <AppLoadingScreen progress={dbInitProgress} />;
  }

  // Landing page
  if (!auth.isAuthenticated && appView === 'landing') {
    return (
      <LandingPage
        onGoToLogin={() => setAppView('login')}
        onGoToRegister={() => setAppView('register')}
      />
    );
  }

  // Login/Register screen
  if (!auth.isAuthenticated) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        initialMode={appView === 'register' ? 'register' : 'login'}
        onBackToLanding={() => setAppView('landing')}
      />
    );
  }

  // Help page
  if (showHelpPage) {
    return <HelpPage onClose={() => setShowHelpPage(false)} />;
  }

  return (
    <div className="flex h-screen bg-[#F8F9FA] text-belhard-text overflow-hidden">

      {/* Document Viewer */}
      {viewingDocument && (
        <DocumentViewer
          source={viewingDocument}
          onClose={handleCloseViewer}
          searchQuery={documentHighlightText}
        />
      )}

      {/* Document Editor */}
      {isEditorOpen && (
        <DocumentEditor
          source={editingDocument}
          onClose={() => setIsEditorOpen(false)}
          onSave={handleSaveSource}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm transition-opacity animate-fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        history={chatHistory}
        activeChatId={currentChatId}
        sources={selectedCountry === 'azerbaijan'
          ? sources.filter(s => (s as any).country === 'azerbaijan')
          : sources.filter(s => !(s as any).country || (s as any).country === 'belarus')
        }
        indexedSourceIds={indexedSourceIds}
        onSelectChat={handleSelectChat}
        onNewChat={handleNewChat}
        onLogout={handleLogout}
        onViewDocument={handleViewSource}
        onAddSource={handleOpenAddSource}
        onEditSource={handleOpenEditSource}
        onDeleteSource={handleDeleteSource}
        onDeleteChat={handleDeleteChat}
        onArchiveChat={handleArchiveChat}
        onRenameChat={handleRenameChat}
        brandName={COUNTRY_CONFIGS[selectedCountry].brandName}
        selectedCountry={selectedCountry}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative w-full h-full">

        {/* Header */}
        <AppHeader
          selectedDepartment={selectedDepartment}
          onDepartmentChange={setSelectedDepartment}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenHelp={() => setShowHelpPage(true)}
          onLogoutRequest={() => setShowLogoutConfirm(true)}
          departments={COUNTRY_CONFIGS[selectedCountry].departments}
        />

        {/* Chat Area */}
        <ChatArea
          messages={messages}
          selectedDepartment={selectedDepartment}
          onViewSource={handleViewSource}
          onEditMessage={handleEditMessage}
          onRegenerateMessage={handleRegenerateMessage}
          departments={COUNTRY_CONFIGS[selectedCountry].departments}
        />

        {/* Chat Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSendMessage}
          onAddSource={handleOpenAddSource}
          isGenerating={isGenerating}
          selectedDepartment={selectedDepartment}
          departments={COUNTRY_CONFIGS[selectedCountry].departments}
        />

      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        useMultiAgent={useMultiAgent}
        onMultiAgentChange={setUseMultiAgent}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          handleLogout();
        }}
      />
    </div>
  );
};

export default App;
