/**
 * Hallucination Checker Agent
 *
 * Проверяет ответы на галлюцинации:
 * 1. Верифицирует что все цитаты реально существуют в контексте
 * 2. Проверяет что факты подтверждаются документами
 * 3. Помечает непроверенные утверждения
 */

import { AgentChunk } from '../../types';

export interface ValidationResult {
  isValid: boolean;
  validCitations: string[];
  invalidCitations: string[];
  suggestedFixes: string[];
  confidence: number; // 0-1
  warnings: string[];
}

export interface CitationMatch {
  citation: string;
  articleNumber: string;
  foundInContext: boolean;
  contextSnippet?: string;
}

/**
 * Извлекает все цитаты из ответа
 * Форматы:
 * - "ТК РБ - Статья 40"
 * - "ТК РБ - РАЗДЕЛ I - Статья 11"
 * - "Декрет №8 - Статья 5"
 * - "статье 57 ТК РБ" (неформальное)
 */
export function extractCitationsFromResponse(response: string): string[] {
  const citations: string[] = [];

  // Pattern 1: Formal citations "ТК РБ - [path] - Статья N"
  const formalPattern = /([А-ЯЁа-яё\s]+(?:РБ|кодекс|№\d+))\s*-\s*(?:[^-]+\s*-\s*)?(?:Стать[яи]|ст\.?)\s*(\d+)/gi;
  let match;

  while ((match = formalPattern.exec(response)) !== null) {
    const doc = match[1].trim();
    const article = match[2];
    citations.push(`${doc} - Статья ${article}`);
  }

  // Pattern 2: Inline references "статье 57 ТК РБ" or "ст. 40 ТК РБ"
  const inlinePattern = /(?:стать[яеи]|ст\.?)\s*(\d+)\s+([А-ЯЁа-яё\s]+(?:РБ|кодекс))/gi;

  while ((match = inlinePattern.exec(response)) !== null) {
    const article = match[1];
    const doc = match[2].trim();
    citations.push(`${doc} - Статья ${article}`);
  }

  // Deduplicate
  return [...new Set(citations)];
}

/**
 * Проверяет наличие статьи в контексте
 */
function findArticleInContext(
  citation: string,
  chunks: AgentChunk[]
): { found: boolean; snippet?: string; chunk?: AgentChunk } {
  // Extract document abbreviation and article number
  const match = citation.match(/(.+?)\s*-\s*Статья\s*(\d+)/i);
  if (!match) return { found: false };

  const docAbbrev = match[1].trim().toLowerCase();
  const articleNum = match[2];

  // Search in chunks
  for (const chunk of chunks) {
    const citationLower = chunk.citation.toLowerCase();
    const pathLower = chunk.path.toLowerCase();
    const contentLower = chunk.content.toLowerCase();

    // Check if document matches
    const docMatches = citationLower.includes(docAbbrev) ||
                       docAbbrev.includes(citationLower.replace(/\s+/g, ' ').trim());

    if (!docMatches) continue;

    // Check if article number is mentioned in path or content
    const articlePattern = new RegExp(`стать[яеи]\\s*${articleNum}(?![0-9])`, 'i');
    const articleInPath = articlePattern.test(pathLower);
    const articleInContent = articlePattern.test(contentLower);

    if (articleInPath || articleInContent) {
      // Extract snippet around the article mention
      const snippetMatch = chunk.content.match(new RegExp(`.{0,100}стать[яеи]\\s*${articleNum}.{0,100}`, 'i'));
      return {
        found: true,
        snippet: snippetMatch ? snippetMatch[0].trim() : chunk.content.substring(0, 200),
        chunk
      };
    }
  }

  return { found: false };
}

/**
 * Основная функция валидации ответа
 */
export function validateResponse(
  response: string,
  chunks: AgentChunk[]
): ValidationResult {
  const extractedCitations = extractCitationsFromResponse(response);

  const validCitations: string[] = [];
  const invalidCitations: string[] = [];
  const suggestedFixes: string[] = [];
  const warnings: string[] = [];

  console.log('🔍 Hallucination Check: Found', extractedCitations.length, 'citations');

  // Available articles in context
  const availableArticles = new Set<string>();
  chunks.forEach(chunk => {
    // Extract articles from chunk paths
    const articleMatches = chunk.path.match(/Статья\s*(\d+)/gi);
    if (articleMatches) {
      articleMatches.forEach(m => {
        const num = m.match(/\d+/)?.[0];
        if (num) {
          availableArticles.add(`${chunk.citation} - Статья ${num}`);
        }
      });
    }
  });

  console.log('📚 Available in context:', [...availableArticles].slice(0, 10), '...');

  // Check each citation
  for (const citation of extractedCitations) {
    const result = findArticleInContext(citation, chunks);

    if (result.found) {
      validCitations.push(citation);
      console.log(`  ✅ Valid: ${citation}`);
    } else {
      invalidCitations.push(citation);
      console.log(`  ❌ NOT FOUND: ${citation}`);

      // Suggest similar articles from context
      const docMatch = citation.match(/(.+?)\s*-/);
      if (docMatch) {
        const doc = docMatch[1].trim();
        const similar = [...availableArticles]
          .filter(a => a.toLowerCase().includes(doc.toLowerCase()))
          .slice(0, 3);

        if (similar.length > 0) {
          suggestedFixes.push(`Вместо "${citation}" возможно имелось в виду: ${similar.join(', ')}`);
        }
      }
    }
  }

  // Calculate confidence
  const totalCitations = extractedCitations.length;
  const validCount = validCitations.length;
  const confidence = totalCitations > 0 ? validCount / totalCitations : 1;

  // Add warnings
  if (invalidCitations.length > 0) {
    warnings.push(`⚠️ Обнаружено ${invalidCitations.length} непроверенных цитат`);
  }

  if (totalCitations === 0) {
    warnings.push('⚠️ В ответе отсутствуют ссылки на источники');
  }

  // Check for repetitive citations
  const citationCounts = new Map<string, number>();
  extractedCitations.forEach(c => {
    citationCounts.set(c, (citationCounts.get(c) || 0) + 1);
  });

  const maxRepetition = Math.max(...citationCounts.values(), 0);
  if (maxRepetition > 3) {
    warnings.push(`⚠️ Одна статья цитируется ${maxRepetition} раз - возможно недостаточное разнообразие источников`);
  }

  return {
    isValid: invalidCitations.length === 0 && totalCitations > 0,
    validCitations,
    invalidCitations,
    suggestedFixes,
    confidence,
    warnings
  };
}

/**
 * Форматирует предупреждение для пользователя
 */
export function formatValidationWarning(result: ValidationResult): string | null {
  if (result.isValid && result.warnings.length === 0) {
    return null;
  }

  const parts: string[] = [];

  if (result.invalidCitations.length > 0) {
    parts.push(`\n\n---\n⚠️ **Проверка источников:** Следующие ссылки не найдены в базе знаний:`);
    result.invalidCitations.forEach(c => {
      parts.push(`- ${c}`);
    });
    parts.push(`\nРекомендуем перепроверить информацию в официальных источниках.`);
  }

  return parts.length > 0 ? parts.join('\n') : null;
}

/**
 * Исправляет ответ, удаляя или помечая непроверенные цитаты
 */
export function sanitizeResponse(
  response: string,
  validationResult: ValidationResult
): string {
  let sanitized = response;

  // Mark invalid citations with warning emoji
  for (const invalid of validationResult.invalidCitations) {
    // Escape special regex chars
    const escaped = invalid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the citation in various formats
    const pattern = new RegExp(escaped.replace(/Статья/i, '(?:Статья|Статьи|ст\\.?)'), 'gi');
    sanitized = sanitized.replace(pattern, `⚠️ ${invalid} (не подтверждено)`);
  }

  return sanitized;
}

/**
 * Агент валидации для LangGraph
 */
export async function hallucinationCheckerAgent(
  response: string,
  chunks: AgentChunk[]
): Promise<{
  validatedResponse: string;
  validationResult: ValidationResult;
}> {
  console.log('🛡️ Hallucination Checker Agent: Validating response...');

  const validationResult = validateResponse(response, chunks);

  let validatedResponse = response;

  // If confidence is too low, add warning
  if (validationResult.confidence < 0.7 || validationResult.invalidCitations.length > 0) {
    const warning = formatValidationWarning(validationResult);
    if (warning) {
      validatedResponse = response + warning;
    }
  }

  console.log(`🛡️ Validation complete: ${Math.round(validationResult.confidence * 100)}% confidence`);

  return {
    validatedResponse,
    validationResult
  };
}
