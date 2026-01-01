import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Download, Share2, Printer, Search, FileText } from 'lucide-react';
import { Source } from '../types';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';

interface DocumentViewerProps {
  source: Source;
  onClose: () => void;
  searchQuery?: string;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ source, onClose, searchQuery }) => {
  const [localSearch, setLocalSearch] = useState(searchQuery || '');
  const contentRef = useRef<HTMLDivElement>(null);

  // Update local search when searchQuery prop changes
  useEffect(() => {
    if (searchQuery) {
      console.log('DocumentViewer received searchQuery:', searchQuery);
      setLocalSearch(searchQuery);
    }
  }, [searchQuery]);

  // Scroll to first highlight when search changes - use DOM query instead of ref
  useEffect(() => {
    if (!localSearch) return;

    // Wait for re-render, then find and scroll to first mark element
    const timer = setTimeout(() => {
      const firstMark = contentRef.current?.querySelector('mark');
      if (firstMark) {
        firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.log('📍 Scrolled to first match');
      } else {
        console.log('⚠️ No match found for:', localSearch);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [localSearch]);

  // Normalize text for comparison (remove extra spaces, lowercase)
  const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/\s+/g, ' ').trim();
  };

  // Find if this paragraph contains the search phrase
  const paragraphContainsPhrase = useCallback((paragraphText: string): boolean => {
    if (!localSearch || !paragraphText) return false;

    const normalizedParagraph = normalizeText(paragraphText);
    const trimmedParagraph = paragraphText.trim();

    // CITATION FORMAT PATTERNS:
    // "ТК РБ - РАЗДЕЛ II. ГЛАВА 2 - Статья 16"
    // "Декрет №8 - ГЛАВА 1 - Статья 2 п1"
    // "Пост. №40 - Параграф 26."
    // "НК РБ - Статья 310 п.5"
    // "НК РБ - РАЗДЕЛ I. Основные положения - ГЛАВА 1. Общие положения - Статья 118 п1.20"

    // Extract all possible identifiers from the search query
    const articleMatch = localSearch.match(/статья\s+(\d+)/i);
    const paragraphFormatMatch = localSearch.match(/параграф\s+(\d+)/i);
    // Match "пункт X" format (full word, not just "п")
    const punktFullMatch = localSearch.match(/пункт\s+(\d+)/i);
    // Improved punkt regex to capture full number like "1.20" from "п1.20" or "п.1.20"
    const punktMatch = localSearch.match(/п[\.\s]*(\d+(?:\.\d+)?)/i);
    const chapterMatch = localSearch.match(/глава\s+(\d+)/i);
    const sectionMatch = localSearch.match(/раздел\s+([IVX\d]+)/i);

    // PRIORITY 1: "Параграф X" format (numbered items in instructions like Пост. №40)
    if (paragraphFormatMatch) {
      const paragraphNumber = paragraphFormatMatch[1];

      // Match patterns: "26. Text", "26.Text", "26) Text"
      const patterns = [
        new RegExp(`^${paragraphNumber}\\.\\s`, 'i'),       // "26. "
        new RegExp(`^${paragraphNumber}\\.\\S`, 'i'),       // "26.Text"
        new RegExp(`^${paragraphNumber}\\)\\s`, 'i'),       // "26) "
      ];

      for (const pattern of patterns) {
        if (pattern.test(trimmedParagraph)) {
          console.log('✅ PARAGRAPH MATCH:', paragraphNumber, '→', trimmedParagraph.substring(0, 50));
          return true;
        }
      }

      return false;
    }

    // PRIORITY 1.5: "Пункт X" format (full word - common in laws like "пункт 84")
    if (punktFullMatch && !articleMatch) {
      const punktNumber = punktFullMatch[1];

      // Match patterns: "84. Text", "84) Text", or text containing "пункт 84" / "п. 84"
      const patterns = [
        new RegExp(`^${punktNumber}\\.\\s`, 'i'),           // "84. "
        new RegExp(`^${punktNumber}\\)\\s`, 'i'),           // "84) "
        new RegExp(`пункт\\s+${punktNumber}[.\\s)]`, 'i'),  // "пункт 84." or "пункт 84 "
        new RegExp(`п\\.?\\s*${punktNumber}[.\\s)]`, 'i'),  // "п.84" or "п 84"
      ];

      for (const pattern of patterns) {
        if (pattern.test(trimmedParagraph)) {
          console.log('✅ PUNKT FULL MATCH:', punktNumber, '→', trimmedParagraph.substring(0, 50));
          return true;
        }
      }

      return false;
    }

    // PRIORITY 2: "Статья X" format
    if (articleMatch) {
      const articleNumber = articleMatch[1];

      // Check for article HEADER (starts with "Статья X." or contains "Статья X.")
      const articleHeaderPattern = new RegExp(`^статья\\s+${articleNumber}[.\\s]`, 'i');
      const articleContainsPattern = new RegExp(`статья\\s+${articleNumber}[.\\s]`, 'i');

      if (articleHeaderPattern.test(trimmedParagraph)) {
        console.log('✅ ARTICLE HEADER:', articleNumber, '→', trimmedParagraph.substring(0, 50));
        return true;
      }

      // If we also have a punkt number, look for numbered list items
      if (punktMatch) {
        const punktNumber = punktMatch[1];
        // Escape dots in punkt number for regex (e.g., "1.20" -> "1\.20")
        const escapedPunktNumber = punktNumber.replace(/\./g, '\\.');

        // Match patterns for punkt: "1.20) Text", "1.20. Text", "1.20 Text", or just "1.20" in text
        const patterns = [
          new RegExp(`^${escapedPunktNumber}\\)\\s`, 'i'),      // "1.20) "
          new RegExp(`^${escapedPunktNumber}\\.\\s`, 'i'),      // "1.20. "
          new RegExp(`^${escapedPunktNumber}\\s`, 'i'),         // "1.20 "
          new RegExp(`^${escapedPunktNumber}[\\)\\.]`, 'i'),    // "1.20)" or "1.20."
        ];

        for (const pattern of patterns) {
          if (pattern.test(trimmedParagraph)) {
            console.log('✅ PUNKT MATCH:', punktNumber, '→', trimmedParagraph.substring(0, 50));
            return true;
          }
        }

        // Also check if article header contains the punkt reference
        if (articleContainsPattern.test(trimmedParagraph)) {
          console.log('✅ ARTICLE CONTAINS:', articleNumber, '→', trimmedParagraph.substring(0, 50));
          return true;
        }
      }

      // If no punkt, just check for article anywhere in text (not just start)
      if (!punktMatch && articleContainsPattern.test(trimmedParagraph)) {
        console.log('✅ ARTICLE FOUND:', articleNumber, '→', trimmedParagraph.substring(0, 50));
        return true;
      }

      return false;
    }

    // PRIORITY 3: "ГЛАВА X" format (chapter headers)
    if (chapterMatch && !articleMatch) {
      const chapterNumber = chapterMatch[1];
      const chapterHeaderPattern = new RegExp(`^глава\\s+${chapterNumber}[.\\s]`, 'i');
      if (chapterHeaderPattern.test(trimmedParagraph)) {
        console.log('✅ CHAPTER HEADER:', chapterNumber, '→', trimmedParagraph.substring(0, 50));
        return true;
      }
      return false;
    }

    // PRIORITY 4: "РАЗДЕЛ X" format (section headers)
    if (sectionMatch && !articleMatch && !chapterMatch) {
      const sectionNumber = sectionMatch[1];
      const sectionHeaderPattern = new RegExp(`^раздел\\s+${sectionNumber}[.\\s]`, 'i');
      if (sectionHeaderPattern.test(trimmedParagraph)) {
        console.log('✅ SECTION HEADER:', sectionNumber, '→', trimmedParagraph.substring(0, 50));
        return true;
      }
      return false;
    }

    // PRIORITY 5: Standalone punkt "п.X" without article context
    if (punktMatch && !articleMatch && !paragraphFormatMatch) {
      const punktNumber = punktMatch[1];
      const patterns = [
        new RegExp(`^${punktNumber}\\)\\s`, 'i'),
        new RegExp(`^${punktNumber}\\.\\s`, 'i'),
      ];

      for (const pattern of patterns) {
        if (pattern.test(trimmedParagraph)) {
          console.log('✅ STANDALONE PUNKT:', punktNumber, '→', trimmedParagraph.substring(0, 50));
          return true;
        }
      }
      return false;
    }

    // PRIORITY 6: Manual search (no citation format detected)
    const normalizedSearch = normalizeText(localSearch);

    // If search query is short (< 10 chars), require exact substring match
    if (normalizedSearch.length < 10) {
      return normalizedParagraph.includes(normalizedSearch);
    }

    // For longer searches, require at least 50% word match
    // Note: removed 'пункт' from common words so it can be used in fuzzy search
    const commonWords = ['для', 'это', 'как', 'или', 'при', 'том', 'что', 'так', 'вам', 'вас', 'она', 'они', 'ткрб', 'раздел', 'глава', 'статья'];
    const searchWords = normalizedSearch
      .split(' ')
      .filter(w => w.length > 2 && !commonWords.includes(w));

    if (searchWords.length === 0) {
      return false;
    }

    // Count how many search words appear in this paragraph
    const matchingWords = searchWords.filter(word =>
      normalizedParagraph.includes(word)
    );

    const matchRatio = matchingWords.length / searchWords.length;

    // Require 50%+ match for longer queries (slightly relaxed)
    if (matchRatio >= 0.5) {
      console.log('✅ FUZZY MATCH:', matchRatio.toFixed(2), '→', trimmedParagraph.substring(0, 50));
      return true;
    }

    return false;
  }, [localSearch]);

  // Helper to process children and highlight matching paragraphs
  const processChildren = useCallback((children: React.ReactNode, _elementType?: string): React.ReactNode => {
    if (typeof children === 'string') {
      const shouldHighlight = paragraphContainsPhrase(children);

      if (shouldHighlight) {
        return (
          <mark
            className="bg-yellow-200 rounded px-2 py-1 block"
            style={{ backgroundColor: '#fef08a', display: 'block', margin: '4px 0' }}
          >
            {children}
          </mark>
        );
      }
      return children;
    }

    if (Array.isArray(children)) {
      return children.map((child, idx) => {
        if (typeof child === 'string') {
          const shouldHighlight = paragraphContainsPhrase(child);
          if (shouldHighlight) {
            return (
              <mark
                key={idx}
                className="bg-yellow-200 rounded px-2 py-1"
                style={{ backgroundColor: '#fef08a' }}
              >
                {child}
              </mark>
            );
          }
        }
        return <React.Fragment key={idx}>{child}</React.Fragment>;
      });
    }

    return children;
  }, [paragraphContainsPhrase]);

  // Custom components for ReactMarkdown - intercept at element level
  const components: Components = useMemo(() => ({
    p: ({ children, ...props }) => <p {...props}>{processChildren(children, 'p')}</p>,
    h1: ({ children, ...props }) => <h1 {...props}>{processChildren(children, 'h1')}</h1>,
    h2: ({ children, ...props }) => <h2 {...props}>{processChildren(children, 'h2')}</h2>,
    h3: ({ children, ...props }) => <h3 {...props}>{processChildren(children, 'h3')}</h3>,
    h4: ({ children, ...props }) => <h4 {...props}>{processChildren(children, 'h4')}</h4>,
    li: ({ children, ...props }) => <li {...props}>{processChildren(children, 'li')}</li>,
    td: ({ children, ...props }) => <td {...props}>{processChildren(children, 'td')}</td>,
    th: ({ children, ...props }) => <th {...props}>{processChildren(children, 'th')}</th>,
    strong: ({ children, ...props }) => <strong {...props}>{processChildren(children, 'strong')}</strong>,
    em: ({ children, ...props }) => <em {...props}>{processChildren(children, 'em')}</em>,
    blockquote: ({ children, ...props }) => <blockquote {...props}>{processChildren(children, 'blockquote')}</blockquote>,
  }), [processChildren]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-white border border-gray-200 rounded-lg">
              <FileText className="w-6 h-6 text-belhard-blue" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 line-clamp-1">{source.title}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-semibold text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded uppercase">
                  {source.type}
                </span>
                <span className="text-xs text-gray-400">
                  ID: {source.id} • Индексировано 12.10.2024
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Поиск в документе..."
                className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-belhard-blue w-64"
              />
            </div>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Печать">
              <Printer className="w-5 h-5" />
            </button>
            <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors" title="Скачать">
              <Download className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-gray-300 mx-1"></div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 bg-white custom-scrollbar">
          <div className="max-w-3xl mx-auto" ref={contentRef}>
            {source.fullContent ? (
               <div className="markdown-body">
                 <ReactMarkdown components={components}>
                   {source.fullContent}
                 </ReactMarkdown>
               </div>
            ) : (
                <div className="text-center py-20">
                    <p className="text-gray-400 italic">Предпросмотр недоступен для этого документа.</p>
                    <p className="text-gray-800 mt-4 font-medium">{source.preview}</p>
                </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-between items-center text-xs text-gray-500">
           <div>
             {localSearch ? `Поиск: "${localSearch}"` : source.citation || source.title}
           </div>
           <div>
             Belhard Secure Viewer v2.4
           </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;