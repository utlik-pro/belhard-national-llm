/**
 * Server-side search service — keyword-based RAG search
 * Port of services/searchService.ts for server use
 */

interface Chunk {
  id: string;
  sourceId: string;
  sourceTitle?: string;
  citation: string;
  path: string;
  content: string;
  chunkType: string;
}

const STOP_WORDS = new Set([
  'и', 'в', 'на', 'с', 'по', 'для', 'от', 'из', 'к', 'до', 'за', 'о', 'об', 'при',
  'не', 'но', 'а', 'же', 'ли', 'бы', 'как', 'что', 'это', 'он', 'она', 'оно', 'они',
  'мы', 'вы', 'я', 'ты', 'мне', 'мой', 'его', 'её', 'их', 'нас', 'вас',
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'of', 'in', 'to', 'for', 'and', 'or',
  'по', 'какой', 'какая', 'какие', 'какое', 'кто', 'что', 'где', 'когда', 'почему',
  'скажи', 'расскажи', 'объясни', 'подскажи',
]);

const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  hr: ['труд', 'работ', 'отпуск', 'увольнен', 'договор', 'зарплат', 'кадр', 'сотрудник', 'персонал', 'əmək', 'məzuniyyət', 'labor'],
  accounting: ['налог', 'бухгалтер', 'отчет', 'платеж', 'ндс', 'прибыл', 'vergi', 'tax'],
  legal: ['договор', 'право', 'закон', 'гражданск', 'суд', 'иск', 'hüquq', 'qanun'],
  it: ['информац', 'данны', 'програм', 'кибер', 'безопасн', 'защит'],
  labor: ['əmək', 'iş', 'müqavil', 'məzuniyyət', 'işdən', 'kompensasiya', 'труд', 'работ'],
  family: ['ailə', 'nikah', 'boşanma', 'aliment', 'uşaq', 'семь', 'брак'],
  property: ['əmlak', 'mülkiyyət', 'icarə', 'miras', 'daşınmaz', 'имущ', 'собственн'],
  tax: ['vergi', 'ödəniş', 'güzəşt', 'bəyannam', 'налог', 'платеж'],
};

function normalizeWord(word: string): string {
  word = word.toLowerCase().trim();
  if (/^[а-яё]/i.test(word)) {
    // Russian stemming (basic suffix removal)
    return word
      .replace(/(ость|ение|ание|ство|ация|ский|ская|ское|ские|ного|ному|ной|ных|ным|ному|ать|ять|ить|еть|уть|ыть|ова|ева|нн|ен|ём|ой|ий|ый|ая|ое|ие|ые|ую|юю|ом|ем|ам|ям|ах|ях|ей|ов|ев|ию|ию)$/i, '')
      .replace(/(ей|ов|ев|ам|ям|ах|ях|ом|ем|ою|ою)$/i, '');
  }
  return word;
}

function extractKeywords(query: string, departmentId?: string): string[] {
  const words = query.toLowerCase().split(/[\s,;.!?()]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
  const keywords = words.map(normalizeWord).filter(w => w.length > 2);

  // Add department-specific keywords
  if (departmentId && DEPARTMENT_KEYWORDS[departmentId]) {
    const deptKws = DEPARTMENT_KEYWORDS[departmentId];
    for (const kw of deptKws) {
      if (query.toLowerCase().includes(kw.substring(0, 4))) {
        keywords.push(normalizeWord(kw));
      }
    }
  }

  return [...new Set(keywords)];
}

export function searchChunks(chunks: Chunk[], query: string, departmentId?: string, topK: number = 15): Chunk[] {
  const keywords = extractKeywords(query, departmentId);
  if (keywords.length === 0) return chunks.slice(0, topK);

  const queryLower = query.toLowerCase();

  const scored = chunks.map(chunk => {
    const contentLower = chunk.content.toLowerCase();
    const pathLower = chunk.path.toLowerCase();
    const citationLower = chunk.citation.toLowerCase();
    let score = 0;

    // Exact phrase match
    if (contentLower.includes(queryLower)) score += 500;

    // Special document type boosting
    const isEmployeeDoc = citationLower.includes('сотрудник') || chunk.sourceId === 'SOTRUDNIKI_2025';
    const isClientDoc = citationLower.includes('клиент') || chunk.sourceId === 'KLIENTY_2025';
    const isFinanceDoc = citationLower.includes('финанс') || chunk.sourceId === 'FINANCE_BELHARD_2025';

    if (isEmployeeDoc && /сотрудник|работник|персонал|трудоустро|кадр|кто|штат/i.test(queryLower)) score += 15000;
    if (isClientDoc && /клиент|заказчик|контракт|партнёр|партнер/i.test(queryLower)) score += 15000;
    if (isFinanceDoc && /финанс|бюджет|расход|доход|прибыл|отчёт|отчет|баланс/i.test(queryLower)) score += 10000;

    // Keyword matching
    let matched = 0;
    for (const kw of keywords) {
      if (citationLower.includes(kw)) { score += 25; matched++; }
      if (pathLower.includes(kw)) { score += 15; matched++; }
      if (contentLower.includes(kw)) { score += 10; matched++; }
    }

    // All keywords matched bonus
    if (matched >= keywords.length * 2) score += 200;

    // Position bonus: keyword near start
    for (const kw of keywords) {
      const idx = contentLower.indexOf(kw);
      if (idx >= 0 && idx < 200) score += 30;
    }

    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(s => s.chunk);
}
