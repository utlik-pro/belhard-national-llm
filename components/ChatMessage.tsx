
import React, { useState } from 'react';
import { Message, Source } from '../types';
import { Copy, ThumbsUp, ThumbsDown, RefreshCcw, Pencil, FileText, ChevronRight, X, ExternalLink, Check } from 'lucide-react';
import SourceCard from './SourceCard';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';

interface ChatMessageProps {
  message: Message;
  onViewSource: (source: Source, highlightText?: string) => void;
  onEditMessage?: (id: string, newContent: string) => void;
  onRegenerateMessage?: (messageId: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, onViewSource, onEditMessage, onRegenerateMessage }) => {
  const isUser = message.role === 'user';
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isCopied, setIsCopied] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // State for Inline Preview
  const [expandedSourceId, setExpandedSourceId] = useState<string | null>(null);
  const [expandedSourceContext, setExpandedSourceContext] = useState<string>('');

  // Timer for distinguishing single vs double click
  const clickTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleSaveEdit = () => {
    if (onEditMessage && editContent.trim() !== '') {
      onEditMessage(message.id, editContent);
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleRegenerate = () => {
    if (onRegenerateMessage) {
      setIsRegenerating(true);
      setTimeout(() => setIsRegenerating(false), 2000);
      onRegenerateMessage(message.id);
    }
  };

  const toggleSourcePreview = (sourceId: string) => {
    setExpandedSourceId(prev => prev === sourceId ? null : sourceId);
  };

  // Extract context around a SPECIFIC citation occurrence for highlighting in document
  const extractCitationContext = (sourceId: string, citationText: string): string => {
    if (!message.content) return '';

    // Find the source to get its citation abbreviation
    const source = findSourceById(sourceId);
    if (!source || !source.citation) return '';

    // Build regex to match citation in new format
    // Supports: "ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16", "ТК РБ - пункт 8", "Пост. №40 - п.20"
    const escapedCitation = source.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const citationPattern = new RegExp(escapedCitation + '\\s*-\\s*(?:' +
      '.{0,150}?(?:Стать[яи]|ст\\.?)\\s*\\d+(?:\\s*п\\.?\\d+(?:\\.\\d+)?)?' +
      '|(?:пункт|п\\.)\\s*\\d+(?:\\.\\d+)?' +
      '|(?:раздел|р\\.)\\s*\\d+(?:\\.\\d+)?' +
      '|[^,\\.\\n]{1,50})', 'gi');

    // Remove markdown formatting and ALL citations from all sources
    let cleanText = citationText
      .replace(/\*\*/g, '')
      .replace(/\*/g, '');

    // Remove all possible citation patterns from the text
    if (message.sources) {
      message.sources.forEach(src => {
        if (src.citation) {
          const escaped = src.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          // Match all citation formats: Статья, пункт, раздел, etc.
          const pattern = new RegExp(escaped + '\\s*-\\s*(?:' +
            '.{0,150}?(?:Стать[яи]|ст\\.?)\\s*\\d+(?:\\s*п\\.?\\d+(?:\\.\\d+)?)?' +
            '|(?:пункт|п\\.)\\s*\\d+(?:\\.\\d+)?' +
            '|(?:раздел|р\\.)\\s*\\d+(?:\\.\\d+)?' +
            '|[^,\\.\\n]{1,50})', 'gi');
          cleanText = cleanText.replace(pattern, '');
        }
      });
    }

    // Clean up extra spaces and trim
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    // For numbered lists, try to extract just the current item
    // Pattern: "8. Some text" or "8) Some text"
    const listItemMatch = cleanText.match(/^\d+[\.\)]\s+(.+?)(?=\d+[\.\)]|$)/s);
    if (listItemMatch) {
      cleanText = listItemMatch[1].trim();
    }

    // Remove imperative verbs and common AI phrases from the beginning
    // Common patterns: "Подготовьте", "Принесите", "Предъявите", "Убедитесь", etc.
    const imperativePatterns = [
      /^(подготовьте|принесите|предъявите|убедитесь|проверьте|возьмите|получите|оформите|заполните|представьте)\s+/i,
      /^(вам необходимо|вам нужно|необходимо|нужно|требуется)\s+/i,
      /^(для этого|следует|важно|рекомендуется)\s+/i
    ];

    imperativePatterns.forEach(pattern => {
      cleanText = cleanText.replace(pattern, '');
    });

    // Capitalize first letter after removing imperative
    if (cleanText.length > 0) {
      cleanText = cleanText.charAt(0).toUpperCase() + cleanText.slice(1);
    }

    // Return the actual text fragment (50-200 chars) to search for in document
    const contextLength = Math.min(cleanText.length, 200);
    const contextFragment = cleanText.substring(0, contextLength).trim();

    console.log('📝 Context fragment for search:', contextFragment);
    console.log('📏 Context length:', contextFragment.length);

    return contextFragment;
  };

  // Extract local context around a specific badge position
  const getLocalContext = (fullText: string, citationIndex: number, citationLength: number): string => {
    // Find boundaries of current list item or paragraph
    let start = citationIndex;
    let end = citationIndex + citationLength;

    // Look backwards to find start of current item (number + period/paren or double newline)
    for (let i = citationIndex - 1; i >= 0 && i >= citationIndex - 300; i--) {
      const char = fullText[i];
      const prevChar = i > 0 ? fullText[i - 1] : '';

      // Found start of numbered list item
      if (/\d/.test(prevChar) && /[\.\)]/.test(char)) {
        start = i - 1;
        break;
      }

      // Found paragraph break
      if (fullText.substring(i, i + 2) === '\n\n') {
        start = i + 2;
        break;
      }
    }

    // Look forwards to find end of current item
    for (let i = citationIndex + citationLength; i < fullText.length && i < citationIndex + citationLength + 300; i++) {
      const char = fullText[i];
      const nextChar = i < fullText.length - 1 ? fullText[i + 1] : '';

      // Found start of next numbered list item
      if (/\n/.test(char) && /\d/.test(nextChar)) {
        end = i;
        break;
      }

      // Found paragraph break
      if (fullText.substring(i, i + 2) === '\n\n') {
        end = i;
        break;
      }
    }

    return fullText.substring(start, end);
  };

  // Helper to find source by ID
  const findSourceById = (id: string) => {
    return message.sources?.find(s => s.id === id);
  };

  // Helper to find source by citation abbreviation
  // Matches citations like "ТК РБ" from full citation "ТК РБ - Статья 16" or "ТК РБ - пункт 8"
  const findSourceByCitation = (citationText: string): Source | undefined => {
    if (!message.sources) return undefined;

    // Try multiple patterns to extract the citation abbreviation
    // Pattern 1: "ТК РБ - Статья 16" or "Пост. №40 - пункт 20" -> extract prefix
    const abbrevMatch = citationText.match(/^([А-ЯЁа-яё\s\.№]+(?:РБ|кодекс|№\d+)?)\s*-/i);
    if (abbrevMatch) {
      const abbrev = abbrevMatch[1].trim();
      const found = message.sources.find(s =>
        s.citation && s.citation.toLowerCase() === abbrev.toLowerCase()
      );
      if (found) return found;
    }

    // Pattern 2: Check if text starts with any known citation
    for (const source of message.sources) {
      if (source.citation) {
        const escaped = source.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const pattern = new RegExp(`^${escaped}\\s*-`, 'i');
        if (pattern.test(citationText)) {
          return source;
        }
      }
    }

    // Pattern 3: Match if it looks like a valid citation format
    // Supports: "Статья N", "пункт N", "раздел N", "п.N"
    if (citationText.length < 200 && /(?:Стать[яи]|пункт|п\.|раздел|р\.)\s*\d+/i.test(citationText)) {
      for (const source of message.sources) {
        if (source.citation && citationText.toLowerCase().includes(source.citation.toLowerCase())) {
          return source;
        }
      }
    }

    return undefined;
  };

  const expandedSource = expandedSourceId ? findSourceById(expandedSourceId) : null;

  // Custom components for ReactMarkdown - inline code styling
  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      // Inline code gets custom styling, block code handled by rehype-highlight
      if (inline) {
        return (
          <code className="bg-gray-100 text-belhard-blue px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
            {children}
          </code>
        );
      }
      // Block code will be processed by rehype-highlight
      return <code className={className} {...props}>{children}</code>;
    },
    pre({ node, children, ...props }: any) {
      // Add custom styling to pre blocks
      return (
        <pre className="rounded-lg my-3 overflow-x-auto" {...props}>
          {children}
        </pre>
      );
    }
  };

  // Build citation regex pattern
  const buildCitationPattern = () => {
    const citationPatterns = message.sources?.map(s => {
      if (s.citation) {
        const escaped = s.citation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Match citation with optional path and article/item reference
        // Supports formats:
        // - "ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16" (structured law)
        // - "ТК РБ - пункт 8" (simple numbered)
        // - "Пост. №40 - п.20" (abbreviated)
        // - "Декрет №8 - раздел 3" (section)
        return escaped + '\\s*-\\s*(?:' +
          // Option 1: Full path with Статья
          '.{0,150}?(?:Стать[яи]|ст\\.?)\\s*\\d+(?:\\s*п\\.?\\d+(?:\\.\\d+)?)?' +
          '|' +
          // Option 2: пункт/п. N format
          '(?:пункт|п\\.)\\s*\\d+(?:\\.\\d+)?' +
          '|' +
          // Option 3: раздел N format
          '(?:раздел|р\\.)\\s*\\d+(?:\\.\\d+)?' +
          '|' +
          // Option 4: Generic short reference (up to 50 chars, no comma/period/newline)
          '[^,\\.\\n]{1,50}' +
          ')';
      }
      return null;
    }).filter(Boolean);

    return citationPatterns && citationPatterns.length > 0
      ? new RegExp(`(${citationPatterns.join('|')})`, 'gi')
      : null;
  };

  // Create citation badge component
  // precedingText is the text before the citation, used to extract employee names
  const createCitationBadge = (citationText: string, key: string | number, sourceOverride?: Source, precedingText?: string) => {
    const source = sourceOverride || findSourceByCitation(citationText);
    if (!source) return citationText;

    const isExpanded = expandedSourceId === source.id;

    // Check if this is an employee document
    const isEmployeeDoc = source.citation?.toLowerCase().includes('сотрудник');

    let displayText: string;

    if (isEmployeeDoc && precedingText) {
      // For employee documents, extract the employee name from preceding text
      // Pattern: "ФИО —" or "ФИО:" or "ФИО," at the start of the item
      // Russian names: First Last or Last First (2-3 words, capitalized)
      const nameMatch = precedingText.match(/([А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+(?:\s+[А-ЯЁ][а-яё]+)?)\s*[—:–\-,]/);
      if (nameMatch) {
        displayText = nameMatch[1]; // Use extracted name
      } else {
        // Fallback for employee docs: just show "Статья N" (short and clean)
        const articleMatch = citationText.match(/Стать[яи]\s*\d+/i);
        displayText = articleMatch ? articleMatch[0] : 'Сотрудник';
      }
    } else if (isEmployeeDoc) {
      // Employee doc but no preceding text - show article/item number
      const articleMatch = citationText.match(/(?:Стать[яи]|пункт|п\.)\s*\d+/i);
      displayText = articleMatch ? articleMatch[0] : 'Сотрудник';
    } else {
      // Default: extract article/item part for cleaner look
      // Supports: Статья N, пункт N, п.N, раздел N
      const articleMatch = citationText.match(/(?:ГЛАВА\s*\d+\s*-\s*)?(?:Стать[яи]|пункт|п\.|раздел|р\.)\s*\d+(?:\s*п\.?\d+(?:\.\d+)?)?/i);
      displayText = articleMatch ? articleMatch[0] : citationText;
    }

    // Handle click with timer to distinguish single vs double click
    // For employee documents, construct proper search query
    let searchQuery: string;
    if (isEmployeeDoc) {
      // If displayText is a name (has Cyrillic letters and space), use it directly
      if (/[А-ЯЁ][а-яё]+\s+[А-ЯЁ][а-яё]+/.test(displayText)) {
        searchQuery = displayText; // Search by employee name
      } else {
        // If displayText is "Статья N", convert to "Пункт N" for employee docs
        // because the actual document uses "Пункт N." format
        const articleNum = displayText.match(/\d+/);
        searchQuery = articleNum ? `Пункт ${articleNum[0]}` : displayText;
      }
    } else {
      searchQuery = citationText;
    }

    const handleClick = (e: React.MouseEvent) => {
      e.preventDefault();

      // Clear any pending single-click action
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
        // This is a double-click - open full document
        console.log('Double-click detected, opening document:', source.id, 'search:', searchQuery);
        onViewSource(source, searchQuery);
      } else {
        // Schedule single-click action with delay
        clickTimerRef.current = setTimeout(() => {
          clickTimerRef.current = null;
          // Single click - show preview
          console.log('Single-click, opening preview:', source.id);
          setExpandedSourceContext(searchQuery);
          toggleSourcePreview(source.id);
        }, 250); // 250ms delay to detect double-click
      }
    };

    return (
      <span
        key={key}
        onClick={handleClick}
        className={`
          inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md text-xs font-semibold cursor-pointer
          transition-all select-none whitespace-nowrap align-baseline
          ${isExpanded
            ? 'bg-belhard-blue text-white shadow-sm ring-2 ring-belhard-blue/20'
            : 'bg-blue-100 text-belhard-blue hover:bg-belhard-blue hover:text-white'}
        `}
        title={`${source.citation} • Клик для предпросмотра, двойной клик для документа`}
      >
        <FileText className="w-3 h-3 flex-shrink-0" />
        {displayText}
      </span>
    );
  };

  // Process text to replace citations with badges
  const processTextWithCitations = (text: string, keyPrefix: string = ''): React.ReactNode[] => {
    const pattern = buildCitationPattern();
    if (!pattern) return [text];

    const parts = text.split(pattern);
    const result: React.ReactNode[] = [];
    let lastSource: Source | null = null;
    let lastTextPart: string = ''; // Track preceding text for employee name extraction

    parts.forEach((part, idx) => {
      if (!part) return;

      const source = findSourceByCitation(part);
      if (source) {
        lastSource = source;

        // Handle comma-separated articles
        const articlesMatch = part.match(/[Сс]татьи?\s+(\d+(?:\s*,\s*\d+)+)/);
        if (articlesMatch) {
          const articleNumbers = articlesMatch[1].split(/\s*,\s*/);
          articleNumbers.forEach((num, numIdx) => {
            const singleCitation = `${source.citation} - Статья ${num}`;
            result.push(createCitationBadge(singleCitation, `${keyPrefix}-${idx}-${numIdx}`, source, lastTextPart));
          });
        } else {
          // Pass preceding text for employee name extraction
          result.push(createCitationBadge(part, `${keyPrefix}-${idx}`, undefined, lastTextPart));
        }
      } else {
        // Check for orphaned article references
        const orphanPattern = /([,–\s]*(?:ГЛАВА\s*\d+\s*-\s*)?Стать[яи]\s*\d+(?:\s*п\.?\d+(?:\.\d+)?)?)/gi;
        if (lastSource && orphanPattern.test(part)) {
          orphanPattern.lastIndex = 0;
          const orphanParts = part.split(orphanPattern);
          orphanParts.forEach((orphanPart, orphanIdx) => {
            if (!orphanPart) return;
            if (orphanPattern.test(orphanPart) && orphanPart.match(/Стать[яи]\s*\d+/i)) {
              orphanPattern.lastIndex = 0;
              const articleMatch = orphanPart.match(/(?:ГЛАВА\s*(\d+)\s*-\s*)?Стать[яи]\s*(\d+)(?:\s*п\.?(\d+(?:\.\d+)?)?)?/i);
              if (articleMatch) {
                const chapter = articleMatch[1] ? `ГЛАВА ${articleMatch[1]} - ` : '';
                const articleNum = articleMatch[2];
                const suffix = articleMatch[3] ? ` п${articleMatch[3]}` : '';
                const fullCitation = `${lastSource!.citation} - ${chapter}Статья ${articleNum}${suffix}`;
                result.push(createCitationBadge(fullCitation, `${keyPrefix}-${idx}-orphan-${orphanIdx}`, lastSource!));
              }
            } else {
              result.push(orphanPart);
              lastTextPart = orphanPart; // Update preceding text
            }
          });
        } else {
          result.push(part);
          lastTextPart = part; // Update preceding text for next citation
        }
      }
    });

    return result;
  };

  // Custom component to process children and inject citation badges
  const TextWithCitations: React.FC<{ children: React.ReactNode; keyPrefix?: string }> = ({ children, keyPrefix = '' }) => {
    if (typeof children === 'string') {
      return <>{processTextWithCitations(children, keyPrefix)}</>;
    }

    if (Array.isArray(children)) {
      return (
        <>
          {children.map((child, idx) => {
            if (typeof child === 'string') {
              return <React.Fragment key={idx}>{processTextWithCitations(child, `${keyPrefix}-${idx}`)}</React.Fragment>;
            }
            return child;
          })}
        </>
      );
    }

    return <>{children}</>;
  };

  // Custom markdown components that preserve structure and inject citation badges
  const citationMarkdownComponents = {
    ...markdownComponents,
    p: ({ node, children, ...props }: any) => (
      <p className="mb-2 last:mb-0" {...props}>
        <TextWithCitations keyPrefix="p">{children}</TextWithCitations>
      </p>
    ),
    li: ({ node, children, ...props }: any) => (
      <li className="mb-1" {...props}>
        <TextWithCitations keyPrefix="li">{children}</TextWithCitations>
      </li>
    ),
    strong: ({ node, children, ...props }: any) => (
      <strong {...props}>
        <TextWithCitations keyPrefix="strong">{children}</TextWithCitations>
      </strong>
    ),
  };

  // Main renderer that preserves markdown structure with citation badges
  const renderContentWithCitations = (content: string) => {
    if (!content) return null;

    return (
      <ReactMarkdown
        rehypePlugins={[rehypeHighlight]}
        components={citationMarkdownComponents}
      >
        {content}
      </ReactMarkdown>
    );
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'} animate-slide-up group`}>
      <div className={`flex flex-col gap-2 ${isUser ? 'max-w-[85%] md:max-w-[75%]' : 'w-full max-w-full'}`}>
        
        {/* Content Bubble */}
        <div className={`relative text-base transition-all duration-200
            ${isUser
              ? 'bg-belhard-blue text-white rounded-[26px] px-4 py-1.5'
              : 'text-gray-900 px-0 py-0'
            }`}>
            
            {isUser && isEditing ? (
              <div className="flex flex-col gap-2 min-w-[300px]">
                <textarea 
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="w-full bg-white/10 text-white border border-white/20 rounded-xl p-2 focus:outline-none focus:ring-1 focus:ring-white/30 resize-none text-sm leading-relaxed"
                  rows={3}
                />
                <div className="flex justify-end gap-2">
                   <button 
                     onClick={handleCancelEdit}
                     className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-full text-xs font-medium transition-colors"
                   >
                     Отмена
                   </button>
                   <button 
                     onClick={handleSaveEdit}
                     className="px-3 py-1 bg-white text-belhard-blue hover:bg-gray-100 rounded-full text-xs font-bold transition-colors shadow-sm"
                   >
                     Отправить
                   </button>
                </div>
              </div>
            ) : (
              message.content ? (
                  <div className="markdown-body">
                    {isUser ? (
                       <ReactMarkdown
                         rehypePlugins={[rehypeHighlight]}
                         components={{
                           ...markdownComponents,
                           p: ({node, ...props}) => <div className="m-0" {...props} />
                         }}
                       >{message.content}</ReactMarkdown>
                    ) : (
                       // AI Message with Citation Parsing
                       // Preserve list structure while keeping citations inline
                       <div className="prose prose-sm max-w-none
                         prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
                         prose-p:my-2 prose-p:leading-relaxed
                         prose-li:leading-relaxed
                         [&_ul]:list-disc [&_ul]:pl-5
                         [&_ol]:list-decimal [&_ol]:pl-5
                       ">
                         {renderContentWithCitations(message.content)}
                       </div>
                    )}
                    {message.isStreaming && (
                        <span className="inline-block w-2 h-5 ml-1 bg-belhard-blue align-sub animate-blink" />
                    )}
                  </div>
              ) : (
                /* Animated Status Indicator for AI */
                !isUser && message.generationStatus && (
                  <div className="overflow-hidden h-8">
                    <div
                      key={message.generationStatus.stage}
                      className="animate-slide-down-fade"
                    >
                      <div className="flex items-center gap-2 text-gray-600">
                        {/* Icon based on stage */}
                        {message.generationStatus.stage === 'thinking' && (
                          <div className="w-5 h-5 border-2 border-belhard-blue border-t-transparent rounded-full animate-spin" />
                        )}
                        {message.generationStatus.stage === 'searching' && (
                          <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                        )}
                        {message.generationStatus.stage === 'found' && (
                          <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {message.generationStatus.stage === 'generating' && (
                          <div className="flex gap-1">
                            <span className="w-2 h-2 bg-belhard-blue rounded-full animate-bounce"></span>
                            <span className="w-2 h-2 bg-belhard-blue rounded-full animate-bounce delay-75"></span>
                            <span className="w-2 h-2 bg-belhard-blue rounded-full animate-bounce delay-150"></span>
                          </div>
                        )}

                        {/* Status text */}
                        <span className="text-sm font-medium">
                          {message.generationStatus.details}
                        </span>

                        {/* Document list if available */}
                        {message.generationStatus.documents && message.generationStatus.documents.length > 0 && (
                          <span className="text-xs text-gray-500 ml-1 truncate">
                            ({message.generationStatus.documents.join(', ')})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              )
            )}

            {/* User Message Actions (Hover) */}
            {isUser && !isEditing && (
              <div className="absolute top-1/2 -translate-y-1/2 -left-16 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="p-1.5 bg-gray-100 text-gray-500 hover:text-belhard-blue hover:bg-white rounded-full shadow-sm transition-all"
                    title="Редактировать"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleCopy}
                    className={`p-1.5 bg-gray-100 rounded-full shadow-sm transition-all ${
                      isCopied
                        ? 'text-green-600 hover:text-green-700'
                        : 'text-gray-500 hover:text-belhard-blue hover:bg-white'
                    }`}
                    title={isCopied ? "Скопировано!" : "Копировать"}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
              </div>
            )}
        </div>

        {/* AI Actions & Sources (Only for AI) */}
        {!isUser && !message.isStreaming && message.content && (
          <div className="mt-2 animate-fade-in pl-0">

            {/* Multi-Agent Badge */}
            {message.isMultiAgentResponse && message.consultedAgents && message.consultedAgents.length > 0 && (
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
                  Мульти-агентный ответ
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {message.consultedAgents.map((agentId) => {
                    const agentColors: Record<string, string> = {
                      'hr': 'bg-purple-100 text-purple-700 border-purple-200',
                      'legal': 'bg-red-100 text-red-700 border-red-200',
                      'accounting': 'bg-green-100 text-green-700 border-green-200',
                      'it': 'bg-blue-100 text-blue-700 border-blue-200',
                      'general': 'bg-gray-100 text-gray-700 border-gray-200'
                    };
                    const agentNames: Record<string, string> = {
                      'hr': 'HR / Кадры',
                      'legal': 'Юридический',
                      'accounting': 'Бухгалтерия',
                      'it': 'IT',
                      'general': 'Общий'
                    };
                    return (
                      <span
                        key={agentId}
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${agentColors[agentId] || agentColors.general}`}
                      >
                        {agentNames[agentId] || agentId}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sources Grid */}
            {message.sources && message.sources.length > 0 && (
              <div className="mb-4">
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-belhard-green"></span>
                  Использованные источники
                </div>
                <div className="flex flex-wrap gap-3">
                  {message.sources.map((src) => (
                    <SourceCard 
                      key={src.id} 
                      source={src} 
                      onClick={() => toggleSourcePreview(src.id)}
                      isActive={expandedSourceId === src.id}
                    />
                  ))}
                </div>
                
                {/* Inline Preview Panel */}
                {expandedSource && (
                  <div className="mt-3 p-0 bg-white border border-gray-200 rounded-xl shadow-lg shadow-gray-100 overflow-hidden animate-slide-up origin-top relative max-w-2xl">
                    <div className="flex items-center justify-between p-3 bg-gray-50 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                         <div className="p-1 bg-white rounded-md border border-gray-100">
                            <FileText className="w-4 h-4 text-belhard-blue" />
                         </div>
                         <div>
                            <div className="text-xs font-bold text-gray-800 line-clamp-1">
                                {expandedSource.title}
                            </div>
                            <div className="text-[10px] text-gray-500">
                                Релевантный фрагмент
                            </div>
                         </div>
                      </div>
                      <button 
                         onClick={() => setExpandedSourceId(null)}
                         className="p-1 text-gray-400 hover:bg-gray-200 rounded-full transition-colors"
                      >
                         <X className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="p-4 bg-white">
                        <div className="text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4 max-h-40 overflow-y-auto custom-scrollbar">
                           "{expandedSource.preview || expandedSource.fullContent?.substring(0, 300)}..."
                        </div>
                        
                        <div className="flex justify-end">
                            <button
                               onClick={() => {
                                 console.log('Full document button clicked with context:', expandedSourceContext);
                                 onViewSource(expandedSource, expandedSourceContext);
                               }}
                               className="flex items-center gap-2 px-4 py-2 bg-belhard-blue text-white text-sm font-semibold rounded-lg hover:bg-belhard-dark transition-all shadow-md shadow-belhard-blue/20"
                            >
                                Читать документ полностью
                                <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Bar */}
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={handleCopy}
                className={`p-1.5 rounded-md transition-colors ${
                  isCopied
                    ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                    : 'text-gray-400 hover:text-belhard-blue hover:bg-blue-50'
                }`}
                title={isCopied ? "Скопировано!" : "Копировать"}
              >
                {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors">
                <ThumbsUp className="w-4 h-4" />
              </button>
              <button className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors">
                <ThumbsDown className="w-4 h-4" />
              </button>
              <button
                onClick={handleRegenerate}
                className={`p-1.5 rounded-md transition-colors ${
                  isRegenerating
                    ? 'text-green-600 hover:text-green-700 hover:bg-green-50'
                    : 'text-gray-400 hover:text-belhard-blue hover:bg-blue-50'
                }`}
                title={isRegenerating ? "Перегенерировано!" : "Перегенерировать"}
              >
                {isRegenerating ? <Check className="w-4 h-4" /> : <RefreshCcw className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
