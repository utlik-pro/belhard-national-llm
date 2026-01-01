/**
 * Search Service для hybrid поиска релевантных документов
 *
 * Комбинирует keyword search + vector search для лучших результатов:
 * - Keyword: точные совпадения (статьи, цитаты, имена)
 * - Vector: семантическое понимание (синонимы, перефразирование)
 */

import { Source } from '../types';
import { indexedDB, Chunk } from './indexedDBService';
import { DepartmentId } from '../types';
import { embeddingService } from './embeddingService';

interface SearchResult {
  source: Source;
  score: number;
  matchedKeywords: string[];
}

interface ChunkSearchResult {
  chunk: Chunk;
  score: number;
  matchedKeywords: string[];
}

class SearchService {
  // Расширенные стоп-слова РБ
  private stopWords = new Set([
    'и', 'в', 'на', 'с', 'по', 'о', 'об', 'для', 'к', 'у',
    'от', 'до', 'из', 'за', 'при', 'не', 'без', 'под', 'над',
    'так', 'как', 'что', 'это', 'вам', 'вас', 'или', 'том',
    'мне', 'меня', 'его', 'её', 'ее', 'их', 'нас', 'вы', 'мы',
    'быть', 'был', 'была', 'были', 'будет', 'есть', 'нет',
    'можно', 'нужно', 'надо', 'какой', 'какая', 'какие',
    'если', 'когда', 'где', 'чем', 'кто', 'все', 'всё', 'ещё', 'еще',
    'уже', 'только', 'также', 'тоже', 'очень', 'более', 'менее'
  ]);

  // Синонимы для улучшения поиска
  private synonyms: Record<string, string[]> = {
    'отпуск': ['отдых', 'каникулы', 'vacation'],
    'зарплата': ['оклад', 'заработок', 'вознаграждение', 'оплата'],
    'увольнение': ['расторжение', 'прекращение', 'уход'],
    'договор': ['контракт', 'соглашение'],
    'работник': ['сотрудник', 'служащий', 'работающий'],
    'сотрудник': ['работник', 'служащий', 'персонал'],
    'налог': ['сбор', 'пошлина', 'взнос'],
    'компания': ['организация', 'предприятие', 'фирма'],
    'трудовой': ['рабочий', 'служебный'],
    'больничный': ['нетрудоспособность', 'болезнь', 'лист'],
    'декрет': ['материнство', 'беременность', 'роды'],
    'испытательный': ['пробный', 'испытание'],
    'премия': ['бонус', 'надбавка', 'вознаграждение']
  };

  // Department-specific keywords для улучшения релевантности
  private departmentKeywords: Record<DepartmentId, string[]> = {
    'hr': ['труд', 'работ', 'отпуск', 'увольнен', 'договор', 'заработ', 'кадр', 'прием', 'документ', 'справк', 'сотрудник', 'устро', 'декабр', 'январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр'],
    'accounting': ['налог', 'бухгалтер', 'отчет', 'платеж', 'декларац', 'учет', 'взнос', 'ставк', 'расчет', 'сотрудник', 'труд', 'устро', 'прием', 'декабр', 'январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр'],
    'legal': ['договор', 'право', 'закон', 'гражданск', 'суд', 'обязательств', 'ответственн', 'нарушен'],
    'it': ['информац', 'данн', 'защит', 'цифров', 'програм', 'пвт', 'разработк', 'програмн', 'сотрудник', 'устро', 'прием', 'декабр'],
    'general': ['сотрудник', 'труд', 'работ', 'устро', 'прием', 'декабр', 'январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр']
  };

  /**
   * Извлечение ключевых слов из запроса с расширением синонимами
   */
  private extractKeywords(query: string): string[] {
    const words = query
      .toLowerCase()
      .split(/[\s,;.!?«»""()]+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word));

    const keywords: string[] = [];
    const seen = new Set<string>();

    for (const word of words) {
      const normalized = this.normalizeWord(word);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        keywords.push(normalized);

        // Добавляем синонимы
        const syns = this.getSynonyms(word);
        for (const syn of syns) {
          const normSyn = this.normalizeWord(syn);
          if (!seen.has(normSyn)) {
            seen.add(normSyn);
            keywords.push(normSyn);
          }
        }
      }
    }

    return keywords;
  }

  /**
   * Получение синонимов для слова
   */
  private getSynonyms(word: string): string[] {
    const lowerWord = word.toLowerCase();
    for (const [key, synonyms] of Object.entries(this.synonyms)) {
      if (lowerWord.includes(key) || synonyms.some(s => lowerWord.includes(s))) {
        return [key, ...synonyms];
      }
    }
    return [];
  }

  /**
   * Улучшенный стемминг для русского языка
   */
  private normalizeWord(word: string): string {
    // Сначала проверяем специальные слова, которые не нужно обрезать
    const preserveWords = ['статья', 'глава', 'раздел', 'пункт', 'часть'];
    if (preserveWords.includes(word)) return word;

    // Удаление суффиксов прилагательных
    const adjSuffixes = ['ского', 'ному', 'ными', 'ными', 'ную', 'ного', 'ная', 'ное', 'ный', 'ной'];
    for (const suffix of adjSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 3) {
        return word.slice(0, -suffix.length);
      }
    }

    // Удаление глагольных окончаний
    const verbSuffixes = ['ться', 'ется', 'ются', 'ится', 'ать', 'ять', 'еть', 'уть', 'ить'];
    for (const suffix of verbSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }

    // Удаление существительных окончаний (порядок важен - сначала длинные)
    const nounSuffixes = ['ами', 'ями', 'ием', 'иях', 'ией', 'иям', 'ах', 'ях', 'ом', 'ем', 'ой', 'ей', 'ов', 'ев', 'ам', 'ям', 'ы', 'и', 'у', 'а', 'я', 'е', 'ю', 'о'];

    for (const suffix of nounSuffixes) {
      if (word.endsWith(suffix) && word.length > suffix.length + 2) {
        return word.slice(0, -suffix.length);
      }
    }

    return word;
  }

  /**
   * Расчет релевантности документа
   */
  private calculateRelevanceScore(doc: Source, keywords: string[]): number {
    let score = 0;
    const lowerTitle = doc.title.toLowerCase();
    const lowerContent = (doc.fullContent || '').toLowerCase();
    const lowerCitation = doc.citation.toLowerCase();

    for (const keyword of keywords) {
      // Совпадение в citation = высокий приоритет (+10)
      if (lowerCitation.includes(keyword)) {
        score += 10;
      }

      // Совпадение в заголовке = высокий приоритет (+5)
      if (lowerTitle.includes(keyword)) {
        score += 5;
      }

      // Совпадение в контенте = низкий приоритет (+1 за каждое, макс 10)
      const contentMatches = (lowerContent.match(new RegExp(keyword, 'g')) || []).length;
      score += Math.min(contentMatches, 10);
    }

    return score;
  }

  /**
   * Проверка, является ли слово именем/фамилией (начинается с заглавной буквы)
   */
  private isNameLike(word: string): boolean {
    // Check original form before normalization - names start with capital
    return /^[А-ЯЁA-Z][а-яёa-z]+$/.test(word) && word.length >= 3;
  }

  /**
   * Расчет релевантности chunk (улучшенный алгоритм v2)
   */
  private calculateChunkScore(chunk: Chunk, keywords: string[], queryKeywords: string[], originalQuery?: string): number {
    let score = 0;
    const lowerContent = chunk.content.toLowerCase();
    const lowerPath = chunk.path.toLowerCase();
    const lowerCitation = chunk.citation.toLowerCase();
    const originalContent = chunk.content;
    const lowerQuery = (originalQuery || '').toLowerCase();

    // === 1. ТОЧНОЕ СОВПАДЕНИЕ ФРАЗЫ (максимальный приоритет) ===
    if (originalQuery && originalQuery.length > 5) {
      // Ищем точную фразу запроса в контенте
      const queryPhrases = this.extractPhrases(lowerQuery);
      for (const phrase of queryPhrases) {
        if (phrase.length > 3 && lowerContent.includes(phrase)) {
          score += 500; // Огромный бонус за точную фразу
        }
      }
    }

    // === 2. СПЕЦИАЛЬНЫЕ ДОКУМЕНТЫ (сотрудники, клиенты) ===
    const isEmployeeDoc = lowerCitation.includes('сотрудник');
    const isClientDoc = lowerCitation.includes('клиент') || lowerCitation.includes('заказчик');

    // Паттерны запросов о сотрудниках
    const isHiringQuery = /кто.*(устро|прин|наня)|устро|прин.*на.*работ|новы.*сотрудник|список.*сотрудник|все.*сотрудник/i.test(lowerQuery);
    const isEmployeeKeywordQuery = queryKeywords.some(kw =>
      ['сотрудник', 'устро', 'прием', 'наня', 'трудоустройств', 'работник', 'персонал', 'кадр'].some(emp => kw.includes(emp))
    );
    const months = ['декабр', 'январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр'];
    const isMonthQuery = queryKeywords.some(kw => months.some(m => kw.includes(m)));
    const queryMonth = months.find(m => lowerQuery.includes(m));

    // Если это запрос о сотрудниках - МАКСИМАЛЬНЫЙ приоритет для документа "Сотрудники"
    if (isEmployeeDoc) {
      if (isHiringQuery || isEmployeeKeywordQuery || isMonthQuery) {
        // Базовый бонус для документа сотрудников
        score += 10000;

        // Дополнительный бонус если месяц в запросе совпадает с месяцем в контенте
        if (queryMonth && lowerContent.includes(queryMonth)) {
          score += 5000; // Гарантирует что ВСЕ записи с этим месяцем будут в топе
        }

        // Бонус за слово "трудоустройства" или "устроился" в контенте
        if (lowerContent.includes('трудоустройств') || lowerContent.includes('устро')) {
          score += 2000;
        }
      }
    }

    // Паттерны запросов о клиентах
    const isClientQuery = /клиент|заказчик|контрагент|партнер|компани.*работа|с кем.*работа|список.*клиент|все.*клиент/i.test(lowerQuery);
    const isClientKeywordQuery = queryKeywords.some(kw =>
      ['клиент', 'заказчик', 'контрагент', 'партнер', 'компан'].some(c => kw.includes(c))
    );

    if (isClientDoc && (isClientQuery || isClientKeywordQuery)) {
      score += 15000; // Гарантирует что все клиенты будут в топе
    }

    // === 3. ПОИСК ПО ИМЕНАМ ===
    if (isEmployeeDoc && originalQuery) {
      const potentialNames = originalQuery.match(/[А-ЯЁ][а-яё]+/g) || [];
      for (const name of potentialNames) {
        if (name.length >= 3) {
          const namePattern = new RegExp(name, 'i');
          if (namePattern.test(originalContent)) {
            score += 300;
          }
        }
      }
    }

    // === 4. СОВПАДЕНИЕ ВСЕХ KEYWORDS ===
    const matchedQueryKeywords = queryKeywords.filter(kw =>
      lowerContent.includes(kw) || this.fuzzyMatch(lowerContent, kw)
    );
    const matchRatio = queryKeywords.length > 0
      ? matchedQueryKeywords.length / queryKeywords.length
      : 0;

    if (matchRatio === 1) {
      score += 200; // Все ключевые слова найдены
    } else if (matchRatio >= 0.5) {
      score += 100 * matchRatio; // Частичное совпадение
    }

    // === 5. ПОДСЧЕТ ПО ОТДЕЛЬНЫМ KEYWORDS ===
    for (const keyword of keywords) {
      const isQueryKeyword = queryKeywords.includes(keyword);
      const weight = isQueryKeyword ? 3 : 1; // Query keywords важнее

      // Citation match
      if (lowerCitation.includes(keyword)) {
        score += 25 * weight;
      }

      // Path match (раздел/глава/статья)
      if (lowerPath.includes(keyword)) {
        score += 20 * weight;
      }

      // Content match с учетом частоты
      const matches = (lowerContent.match(new RegExp(this.escapeRegex(keyword), 'g')) || []).length;
      if (matches > 0) {
        // Logarithmic scaling для частоты
        const freqScore = Math.log2(matches + 1) * 10;
        score += freqScore * weight;
      }

      // Fuzzy match (опечатки)
      if (matches === 0 && keyword.length >= 4 && this.fuzzyMatch(lowerContent, keyword)) {
        score += 5 * weight;
      }
    }

    // === 6. ПОЗИЦИОННЫЙ БОНУС ===
    // Если ключевое слово в начале контента - это более релевантно
    for (const kw of queryKeywords) {
      const pos = lowerContent.indexOf(kw);
      if (pos >= 0 && pos < 200) {
        score += 30; // Бонус за позицию в начале
      }
    }

    return score;
  }

  /**
   * Извлечение фраз из запроса (2-3 слова подряд)
   */
  private extractPhrases(query: string): string[] {
    const words = query.split(/\s+/).filter(w => w.length > 2 && !this.stopWords.has(w));
    const phrases: string[] = [];

    // Bigrams
    for (let i = 0; i < words.length - 1; i++) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }

    // Trigrams
    for (let i = 0; i < words.length - 2; i++) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }

    return phrases;
  }

  /**
   * Fuzzy matching для опечаток (расстояние Левенштейна)
   */
  private fuzzyMatch(text: string, keyword: string, maxDistance: number = 2): boolean {
    if (keyword.length < 4) return false;

    // Проверяем, есть ли в тексте слово, похожее на keyword
    const words = text.split(/\s+/);
    for (const word of words) {
      if (Math.abs(word.length - keyword.length) <= maxDistance) {
        if (this.levenshteinDistance(word, keyword) <= maxDistance) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Расстояние Левенштейна
   */
  private levenshteinDistance(a: string, b: string): number {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix: number[][] = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Поиск релевантных документов
   */
  async searchRelevantSources(query: string, topK: number = 5): Promise<Source[]> {
    const keywords = this.extractKeywords(query);

    if (keywords.length === 0) {
      // Если запрос слишком короткий, вернуть топ общих документов
      const allDocs = await indexedDB.getAllDocuments();
      return allDocs.slice(0, topK);
    }

    const allDocs = await indexedDB.getAllDocuments();
    const results: SearchResult[] = [];

    for (const doc of allDocs) {
      const score = this.calculateRelevanceScore(doc, keywords);

      if (score > 0) {
        results.push({
          source: doc,
          score,
          matchedKeywords: keywords.filter(kw =>
            doc.title.toLowerCase().includes(kw) ||
            doc.fullContent?.toLowerCase().includes(kw)
          )
        });
      }
    }

    // Сортировка по релевантности
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK).map(r => r.source);
  }

  /**
   * Поиск с учетом департамента
   */
  /**
   * Поиск в переданных источниках (для mockApiService)
   */
  searchInSources(sources: Source[], query: string, departmentId: DepartmentId, topK: number = 5): Source[] {
    const baseKeywords = this.extractKeywords(query);
    const deptKeywords = this.departmentKeywords[departmentId] || [];

    // Объединить keywords запроса с department-specific keywords
    const combinedKeywords = [...baseKeywords, ...deptKeywords];

    if (combinedKeywords.length === 0 || sources.length === 0) {
      return sources.slice(0, topK);
    }

    const results: SearchResult[] = [];

    for (const doc of sources) {
      const score = this.calculateRelevanceScore(doc, combinedKeywords);

      if (score > 0) {
        results.push({
          source: doc,
          score,
          matchedKeywords: combinedKeywords
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map(r => r.source);
  }

  /**
   * Поиск по отделу (загружает из IndexedDB)
   */
  async searchByDepartment(query: string, departmentId: DepartmentId, topK: number = 5): Promise<Source[]> {
    const allDocs = await indexedDB.getAllDocuments();
    return this.searchInSources(allDocs, query, departmentId, topK);
  }

  /**
   * Поиск chunks в памяти (синхронная версия для mockApiService)
   */
  searchChunksInMemory(chunks: Chunk[], query: string, departmentId: DepartmentId, topK: number = 10): Chunk[] {
    const baseKeywords = this.extractKeywords(query);
    const deptKeywords = this.departmentKeywords[departmentId] || [];
    const combinedKeywords = [...baseKeywords, ...deptKeywords];

    if (combinedKeywords.length === 0 || chunks.length === 0) {
      return chunks.slice(0, topK);
    }

    const results: ChunkSearchResult[] = [];

    for (const chunk of chunks) {
      // Pass baseKeywords as queryKeywords to give them higher weight
      // Pass original query for name matching in employee documents
      const score = this.calculateChunkScore(chunk, combinedKeywords, baseKeywords, query);

      if (score > 0) {
        results.push({
          chunk,
          score,
          matchedKeywords: combinedKeywords
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK).map(r => r.chunk);
  }

  /**
   * Поиск релевантных chunks (загружает из IndexedDB)
   */
  async searchRelevantChunks(query: string, departmentId: DepartmentId, topK: number = 10): Promise<Chunk[]> {
    const allChunks = await indexedDB.getAllChunks();
    return this.searchChunksInMemory(allChunks, query, departmentId, topK);
  }

  /**
   * HYBRID SEARCH: комбинация keyword + vector search
   * Даёт лучшие результаты чем каждый метод по отдельности
   */
  async hybridSearchChunks(
    chunks: Chunk[],
    query: string,
    departmentId: DepartmentId,
    topK: number = 15
  ): Promise<Chunk[]> {
    // Проверяем наличие embeddings
    const chunksWithEmbeddings = chunks.filter(c => c.embedding && c.embedding.length > 0);
    const hasEmbeddings = chunksWithEmbeddings.length > 0 && embeddingService.isAvailable();

    console.log(`🔍 Hybrid search: ${chunks.length} chunks, ${chunksWithEmbeddings.length} with embeddings`);

    // 1. Keyword search (всегда работает)
    const keywordResults = this.searchChunksInMemory(chunks, query, departmentId, topK * 2);

    // Если нет embeddings, возвращаем только keyword результаты
    if (!hasEmbeddings) {
      console.log('📝 Using keyword-only search (no embeddings available)');
      return keywordResults.slice(0, topK);
    }

    // 2. Vector search
    console.log('🧠 Running vector search...');
    const vectorResults = await embeddingService.searchSimilarChunks(query, chunksWithEmbeddings, topK * 2);

    // 3. Combine results with Reciprocal Rank Fusion (RRF)
    // RRF даёт более стабильные результаты чем простое суммирование scores
    const K = 60; // RRF constant
    const combinedScores = new Map<string, { chunk: Chunk; score: number }>();

    // Add keyword scores
    keywordResults.forEach((chunk, rank) => {
      const rrfScore = 1 / (K + rank + 1);
      combinedScores.set(chunk.id, {
        chunk,
        score: rrfScore * 0.4 // 40% weight for keyword
      });
    });

    // Add vector scores
    vectorResults.forEach(({ chunk, similarity }, rank) => {
      const rrfScore = 1 / (K + rank + 1);
      const vectorWeight = rrfScore * 0.6; // 60% weight for vector (semantic understanding)

      const existing = combinedScores.get(chunk.id);
      if (existing) {
        // Chunk found by both methods - boost score!
        existing.score += vectorWeight + 0.1; // Extra boost for appearing in both
      } else {
        combinedScores.set(chunk.id, {
          chunk,
          score: vectorWeight
        });
      }
    });

    // === POST-FUSION BONUS for special document types ===
    // Это гарантирует что ВСЕ записи из "Сотрудники" и "Клиенты" попадут в топ при соответствующем запросе
    const lowerQuery = query.toLowerCase();
    const isEmployeeQuery = /кто.*(устро|прин|наня)|устро|прин.*на.*работ|новы.*сотрудник|список.*сотрудник|все.*сотрудник/i.test(lowerQuery) ||
      ['сотрудник', 'устро', 'прием', 'наня', 'трудоустройств', 'работник', 'персонал', 'кадр'].some(kw => lowerQuery.includes(kw));
    const isClientQuery = /клиент|заказчик|контрагент|партнер|контракт|договор|сделк|все.*клиент|список.*клиент/i.test(lowerQuery) ||
      ['клиент', 'заказчик', 'контрагент', 'партнер', 'контракт'].some(kw => lowerQuery.includes(kw));
    const months = ['декабр', 'январ', 'феврал', 'март', 'апрел', 'май', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр'];
    const isMonthQuery = months.some(m => lowerQuery.includes(m));
    const queryMonth = months.find(m => lowerQuery.includes(m));

    // Проверяем, есть ли конкретная дата в запросе (например "25 декабря", "15 января")
    const specificDateMatch = lowerQuery.match(/(\d{1,2})\s*(декабр|январ|феврал|март|апрел|ма[йя]|июн|июл|август|сентябр|октябр|ноябр)/i);
    const specificDay = specificDateMatch ? specificDateMatch[1] : null;
    const hasSpecificDate = !!specificDay;

    combinedScores.forEach((entry, id) => {
      const lowerCitation = entry.chunk.citation?.toLowerCase() || '';
      const lowerContent = entry.chunk.content?.toLowerCase() || '';

      // Бонус для документа "Сотрудники" - НО НЕ если запрос явно о клиентах
      if (lowerCitation.includes('сотрудник') && (isEmployeeQuery || (isMonthQuery && !isClientQuery))) {
        // Если запрос с конкретной датой - бонус только если дата совпадает
        if (hasSpecificDate) {
          // Ищем паттерн "NN месяц" в контенте
          const datePattern = new RegExp(`${specificDay}\\s*${queryMonth}`, 'i');
          if (datePattern.test(lowerContent)) {
            entry.score += 150; // Точное совпадение даты
          }
          // Без бонуса если дата не совпадает
        } else {
          // Запрос без конкретной даты - бонус всем записям с месяцем
          entry.score += 100;
          if (queryMonth && lowerContent.includes(queryMonth)) {
            entry.score += 50;
          }
        }
      }

      // Бонус для документа "Клиенты" - НО НЕ если запрос явно о сотрудниках
      if (lowerCitation.includes('клиент') && (isClientQuery || (isMonthQuery && !isEmployeeQuery))) {
        // Если запрос с конкретной датой - бонус только если дата совпадает
        if (hasSpecificDate) {
          // Ищем паттерн "NN месяц" в контенте
          const datePattern = new RegExp(`${specificDay}\\s*${queryMonth}`, 'i');
          if (datePattern.test(lowerContent)) {
            entry.score += 150; // Точное совпадение даты
          }
          // Без бонуса если дата не совпадает
        } else {
          // Запрос без конкретной даты - бонус всем записям с месяцем
          entry.score += 100;
          if (queryMonth && lowerContent.includes(queryMonth)) {
            entry.score += 50;
          }
        }
      }
    });

    // Sort by combined score
    const sortedResults = Array.from(combinedScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    console.log(`✅ Hybrid search: found ${sortedResults.length} results`);
    if (sortedResults.length > 0) {
      console.log(`   Top result: ${sortedResults[0].chunk.citation} - ${sortedResults[0].chunk.path.substring(0, 50)}`);
    }

    return sortedResults.map(r => r.chunk);
  }

  /**
   * Поиск документов по метаданным (быстрый)
   */
  async quickSearch(query: string): Promise<Source[]> {
    const keywords = this.extractKeywords(query);

    if (keywords.length === 0) {
      return [];
    }

    const metadata = await indexedDB.getDocumentMetadata();
    const matchedIds = metadata
      .filter(meta =>
        meta.title.toLowerCase().includes(query.toLowerCase()) ||
        meta.citation.toLowerCase().includes(query.toLowerCase()) ||
        keywords.some(kw => meta.keywords.includes(kw))
      )
      .map(meta => meta.id);

    // Загрузить полные документы для найденных ID
    const results: Source[] = [];
    for (const id of matchedIds) {
      const doc = await indexedDB.getDocument(id);
      if (doc) {
        results.push(doc);
      }
    }

    return results;
  }

  /**
   * Debug: показать результаты поиска документов с оценками
   */
  async debugSearch(query: string, departmentId: DepartmentId): Promise<void> {
    const baseKeywords = this.extractKeywords(query);
    const deptKeywords = this.departmentKeywords[departmentId] || [];
    const combinedKeywords = [...baseKeywords, ...deptKeywords];

    console.log('🔍 Debug Document Search:');
    console.log('Query:', query);
    console.log('Base Keywords:', baseKeywords);
    console.log('Dept Keywords:', deptKeywords);
    console.log('Combined Keywords:', combinedKeywords);

    const allDocs = await indexedDB.getAllDocuments();
    const results: SearchResult[] = [];

    for (const doc of allDocs) {
      const score = this.calculateRelevanceScore(doc, combinedKeywords);
      results.push({
        source: doc,
        score,
        matchedKeywords: combinedKeywords.filter(kw =>
          doc.title.toLowerCase().includes(kw) ||
          doc.fullContent?.toLowerCase().includes(kw)
        )
      });
    }

    results.sort((a, b) => b.score - a.score);

    console.table(
      results.slice(0, 10).map(r => ({
        id: r.source.id,
        title: r.source.title.substring(0, 50),
        score: r.score,
        matched: r.matchedKeywords.join(', ')
      }))
    );
  }

  /**
   * Debug: показать результаты поиска chunks с оценками
   */
  async debugChunkSearch(query: string, departmentId: DepartmentId = 'general'): Promise<void> {
    const baseKeywords = this.extractKeywords(query);
    const deptKeywords = this.departmentKeywords[departmentId] || [];
    const combinedKeywords = [...baseKeywords, ...deptKeywords];

    console.log('🔍 Debug Chunk Search:');
    console.log('Query:', query);
    console.log('Base Keywords:', baseKeywords);
    console.log('Dept Keywords:', deptKeywords);

    const allChunks = await indexedDB.getAllChunks();
    console.log(`Total chunks: ${allChunks.length}`);

    // Группировка по документам
    const chunksByDoc = new Map<string, number>();
    allChunks.forEach(c => {
      chunksByDoc.set(c.citation, (chunksByDoc.get(c.citation) || 0) + 1);
    });
    console.log('Chunks по документам:', Object.fromEntries(chunksByDoc));

    const results: ChunkSearchResult[] = [];

    for (const chunk of allChunks) {
      const score = this.calculateChunkScore(chunk, combinedKeywords, baseKeywords, query);
      if (score > 0) {
        results.push({ chunk, score, matchedKeywords: combinedKeywords });
      }
    }

    results.sort((a, b) => b.score - a.score);

    console.log(`\n📊 Top 15 результатов:`);
    console.table(
      results.slice(0, 15).map(r => ({
        citation: r.chunk.citation,
        path: r.chunk.path.substring(0, 40),
        content: r.chunk.content.substring(0, 50) + '...',
        score: r.score
      }))
    );
  }
}

export const searchService = new SearchService();

// Expose for browser console debugging
if (typeof window !== 'undefined') {
  (window as any).debugSearch = (query: string) => searchService.debugChunkSearch(query, 'general');
  (window as any).debugSearchHR = (query: string) => searchService.debugChunkSearch(query, 'hr');
}
