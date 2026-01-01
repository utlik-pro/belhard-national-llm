import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import LoginScreen from './components/LoginScreen';
import DocumentViewer from './components/DocumentViewer';
import DocumentEditor from './components/DocumentEditor';
import HelpPage from './components/HelpPage';
import AppLoadingScreen from './components/AppLoadingScreen';
import AppHeader from './components/AppHeader';
import ChatArea from './components/ChatArea';
import ChatInput from './components/ChatInput';
import SettingsModal from './components/SettingsModal';
import LogoutConfirmModal from './components/LogoutConfirmModal';
import { Message, ChatSession, AuthState, DepartmentId, Source } from './types';
import { INITIAL_CHATS, MOCK_SOURCES } from './constants';
import { streamResponse } from './services/mockApiService';
import { streamMultiAgentWithGemini } from './services/langgraph';
import { indexedDB } from './services/indexedDBService';
import { migrationService, MigrationProgress } from './services/migrationService';
import { chunkingService } from './services/chunkingService';
import { embeddingService } from './services/embeddingService';

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

  // Department State
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentId>('general');

  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [useMultiAgent, setUseMultiAgent] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showHelpPage, setShowHelpPage] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Knowledge Base State
  const [sources, setSources] = useState<Source[]>([]);

  // Document Viewer/Editor State
  const [viewingDocument, setViewingDocument] = useState<Source | null>(null);
  const [documentHighlightText, setDocumentHighlightText] = useState<string>('');
  const [editingDocument, setEditingDocument] = useState<Source | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

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

        setSources(allDocuments);
        console.log(`✅ Total documents: ${allDocuments.length}`);

        // Generate chunks for structured documents
        setDbInitProgress({
          step: 'Генерация chunks документов...',
          current: 87,
          total: 100,
          percentage: 87
        });

        let existingChunks = await indexedDB.getAllChunks();
        console.log(`📊 Existing chunks in IndexedDB: ${existingChunks.length}`);

        // MIGRATION v2.3: Re-chunk legal documents (TK_RB, etc.) with proper article content
        // Old chunks only had titles, new ones have full article text
        const legalDocIds = ['TK_RB', 'NK_RB', 'GK_RB', 'UK_RB']; // Main legal codes
        for (const docId of legalDocIds) {
          const docChunks = existingChunks.filter(c => c.sourceId === docId);
          const doc = allDocuments.find(d => d.id === docId);

          // Check if chunks are missing content (only have titles like "Статья 11. Основные права работников")
          const chunksNeedUpgrade = docChunks.length > 0 && doc?.fullContent &&
            docChunks.some(c => c.content.length < 200 && c.content.includes('Статья'));

          if (chunksNeedUpgrade) {
            console.log(`🔄 MIGRATION v2.3: Re-chunking ${docId} with full article content...`);
            await indexedDB.deleteChunksBySourceId(docId);
            let newChunks = chunkingService.chunkDocument(doc!);
            if (embeddingService.isAvailable()) {
              console.log(`   🧠 Generating embeddings for ${docId}...`);
              newChunks = await embeddingService.embedChunks(newChunks);
            }
            for (const chunk of newChunks) {
              await indexedDB.saveChunk(chunk);
            }
            console.log(`✅ MIGRATION v2.3: Created ${newChunks.length} chunks for ${docId}`);
            existingChunks = await indexedDB.getAllChunks();
          }
        }

        // MIGRATION v2.1: Re-chunk SOTRUDNIKI document with new "пункт N" format
        const sotrudnikiChunks = existingChunks.filter(c => c.sourceId === 'SOTRUDNIKI_2025');
        const needsRechunk = sotrudnikiChunks.length > 0 &&
          sotrudnikiChunks.some(c => c.path.includes('РАЗДЕЛ') || c.path.includes('Статья'));

        if (needsRechunk) {
          console.log('🔄 MIGRATION: Re-chunking SOTRUDNIKI_2025 with new format...');
          await indexedDB.deleteChunksBySourceId('SOTRUDNIKI_2025');
          const sotrudnikiDoc = allDocuments.find(d => d.id === 'SOTRUDNIKI_2025');
          if (sotrudnikiDoc) {
            const newChunks = chunkingService.chunkDocument(sotrudnikiDoc);
            for (const chunk of newChunks) {
              await indexedDB.saveChunk(chunk);
            }
            console.log(`✅ MIGRATION: Created ${newChunks.length} new chunks for SOTRUDNIKI_2025`);
          }
          // Reload chunks after migration
          existingChunks = await indexedDB.getAllChunks();
        }

        // MIGRATION v2.2: Re-chunk KLIENTY_2025 if missing 5th client (Санта Бремор)
        const klientyChunks = existingChunks.filter(c => c.sourceId === 'KLIENTY_2025');
        const klientyDoc = allDocuments.find(d => d.id === 'KLIENTY_2025');
        const klientyNeedsRechunk = klientyDoc && klientyChunks.length > 0 && klientyChunks.length < 5;

        if (klientyNeedsRechunk) {
          console.log(`🔄 MIGRATION: Re-chunking KLIENTY_2025 (found ${klientyChunks.length} chunks, expected 5)...`);
          await indexedDB.deleteChunksBySourceId('KLIENTY_2025');
          let newChunks = chunkingService.chunkDocument(klientyDoc!);
          // Generate embeddings
          if (embeddingService.isAvailable()) {
            console.log(`   🧠 Generating embeddings for KLIENTY_2025...`);
            newChunks = await embeddingService.embedChunks(newChunks);
          }
          for (const chunk of newChunks) {
            await indexedDB.saveChunk(chunk);
          }
          console.log(`✅ MIGRATION: Created ${newChunks.length} new chunks for KLIENTY_2025`);
          // Reload chunks after migration
          existingChunks = await indexedDB.getAllChunks();
        }

        // Find documents that don't have any chunks
        const chunkedDocIds = new Set(existingChunks.map(c => c.sourceId));
        const docsWithoutChunks = allDocuments.filter(doc => !chunkedDocIds.has(doc.id));

        if (docsWithoutChunks.length > 0) {
          console.log(`🔄 Generating chunks for ${docsWithoutChunks.length} documents without chunks...`);

          let totalChunks = 0;
          for (const doc of docsWithoutChunks) {
            let chunks = chunkingService.chunkDocument(doc);

            if (chunks.length > 0) {
              // Generate embeddings for semantic search
              if (embeddingService.isAvailable()) {
                console.log(`   🧠 Generating embeddings for ${doc.citation}...`);
                chunks = await embeddingService.embedChunks(chunks);
              }
              for (const chunk of chunks) {
                await indexedDB.saveChunk(chunk);
              }
              totalChunks += chunks.length;
              console.log(`   ✅ ${doc.citation}: ${chunks.length} chunks`);
            } else {
              console.warn(`   ⚠️ ${doc.citation}: no chunks created (check document structure)`);
            }
          }

          console.log(`✅ Generated ${totalChunks} total chunks for ${docsWithoutChunks.length} documents`);
        } else {
          console.log(`✅ All ${allDocuments.length} documents have chunks`);
        }

        // Load chats from IndexedDB
        setDbInitProgress({
          step: 'Загрузка истории чатов...',
          current: 90,
          total: 100,
          percentage: 90
        });

        const allChats = await indexedDB.getAllChats();
        setChatHistory(allChats.length > 0 ? allChats : INITIAL_CHATS);
        console.log(`✅ Loaded ${allChats.length} chats from IndexedDB`);

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

        // Fallback to localStorage/MOCK_SOURCES on error
        console.warn('⚠️ Falling back to localStorage...');

        try {
          const lsSources = localStorage.getItem('belhard_sources');
          const lsChats = localStorage.getItem('belhard_chats');

          setSources(lsSources ? JSON.parse(lsSources) : MOCK_SOURCES);
          setChatHistory(lsChats ? JSON.parse(lsChats) : INITIAL_CHATS);
        } catch (e) {
          setSources(MOCK_SOURCES);
          setChatHistory(INITIAL_CHATS);
        }

        setIsDBReady(true);
      }
    }

    initializeDatabase();
  }, []);

  // ==================== Persistence Effects ====================
  useEffect(() => {
    if (!isDBReady || chatHistory.length === 0) return;

    async function saveChats() {
      try {
        for (const chat of chatHistory) {
          const chatToSave = {
            ...chat,
            messages: chat.messages?.map(msg => ({
              ...msg,
              sources: msg.sources?.map(s => ({
                id: s.id,
                title: s.title,
                type: s.type,
                citation: s.citation,
                url: s.url,
                preview: s.preview
              }))
            }))
          };
          await indexedDB.saveChat(chatToSave as ChatSession);
        }
        console.log(`💾 Saved ${chatHistory.length} chats to IndexedDB`);
      } catch (e) {
        console.error('Failed to save chats to IndexedDB:', e);
      }
    }

    saveChats();
  }, [chatHistory, isDBReady]);

  useEffect(() => {
    if (!isDBReady || sources.length === 0) return;

    async function saveSources() {
      try {
        // Get existing chunks to know which documents already have them
        const existingChunks = await indexedDB.getAllChunks();
        const chunkedDocIds = new Set(existingChunks.map(c => c.sourceId));

        for (const source of sources) {
          // Save document to IndexedDB
          await indexedDB.saveDocument(source);

          // Create chunks for documents that don't have them yet (for RAG search)
          if (!chunkedDocIds.has(source.id)) {
            console.log(`📦 Creating chunks for new document: ${source.citation}`);
            const chunks = chunkingService.chunkDocument(source);

            if (chunks.length > 0) {
              await indexedDB.saveChunks(chunks);
              console.log(`✅ Created ${chunks.length} chunks for ${source.citation}`);
            } else {
              console.warn(`⚠️ No chunks created for ${source.citation} - check document structure`);
            }
          }
        }
      } catch (e) {
        console.error('Failed to save sources to IndexedDB:', e);
      }
    }

    saveSources();
  }, [sources, isDBReady]);

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
  const handleLogin = (email: string) => {
    setAuth({
      isAuthenticated: true,
      user: {
        id: 'u1',
        email,
        name: 'Алексей Петров',
        avatarUrl: 'https://picsum.photos/200'
      },
      isLoading: false,
      error: null
    });

    if (chatHistory.length > 0) {
      const firstNonArchived = chatHistory.find(c => !c.archived) || chatHistory[0];
      setCurrentChatId(firstNonArchived.id);
      setSelectedDepartment(firstNonArchived.department || 'general');
      setMessages(firstNonArchived.messages || []);
    }
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, user: null, isLoading: false, error: null });
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
            setIsGenerating(false);
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
  const handleNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: 'Новый диалог',
      preview: 'Выберите отдел и задайте вопрос...',
      lastUpdated: Date.now(),
      department: selectedDepartment
    };
    setChatHistory(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
    setMessages([]);
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

    indexedDB.deleteChat(id).catch(e => console.error('Failed to delete chat:', e));
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
      } else {
        console.warn(`⚠️ No chunks created for ${source.citation} - document may be too short`);
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
      } else {
        console.warn(`⚠️ No chunks created for ${source.citation} - document may be too short or have unsupported structure`);
      }

      setSources(prev => [source, ...prev]);
    }
  };

  const handleDeleteSource = (id: string) => {
    if (window.confirm('Вы уверены, что хотите удалить этот документ из базы знаний?')) {
      setSources(prev => prev.filter(s => s.id !== id));
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

  const handleSelectChat = (id: string) => {
    const chat = chatHistory.find(c => c.id === id);
    if (chat) {
      setCurrentChatId(id);
      setSelectedDepartment(chat.department || 'general');
      setMessages(chat.messages || []);
    }
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  // ==================== Render ====================

  // Loading screen
  if (!isDBReady) {
    return <AppLoadingScreen progress={dbInitProgress} />;
  }

  // Login screen
  if (!auth.isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
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
        sources={sources}
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
        />

        {/* Chat Area */}
        <ChatArea
          messages={messages}
          selectedDepartment={selectedDepartment}
          onViewSource={handleViewSource}
          onEditMessage={handleEditMessage}
          onRegenerateMessage={handleRegenerateMessage}
        />

        {/* Chat Input */}
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSendMessage}
          onAddSource={handleOpenAddSource}
          isGenerating={isGenerating}
          selectedDepartment={selectedDepartment}
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
