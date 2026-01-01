/**
 * Парсер НПА РБ с портала pravo.by
 *
 * Использует Puppeteer для эмуляции браузера и Cheerio для парсинга HTML
 * Генерирует JSON файлы с структурированными документами
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Типы документов
const DOCUMENT_TYPES = {
  CODE: { prefix: 'CODE', label: 'Кодекс', type: 'PDF' },
  DECREE: { prefix: 'DECREE', label: 'Декрет', type: 'WEB' },
  LAW: { prefix: 'LAW', label: 'Закон', type: 'WEB' },
  RESOLUTION: { prefix: 'RES', label: 'Постановление', type: 'WEB' }
};

// Целевые документы для парсинга (топ-100 НПА РБ)
// TODO: Добавить URL для остальных 60+ документов
const TARGET_DOCUMENTS = [
  // ========== КОДЕКСЫ РБ (15) ==========
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk9900296',
    id: 'TK_RB',
    title: 'Трудовой кодекс Республики Беларусь',
    citation: 'ТК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0900071',
    id: 'NK_RB',
    title: 'Налоговый кодекс Республики Беларусь',
    citation: 'НК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk9800218',
    id: 'GK_RB',
    title: 'Гражданский кодекс Республики Беларусь',
    citation: 'ГК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk9900275',
    id: 'UK_RB',
    title: 'Уголовный кодекс Республики Беларусь',
    citation: 'УК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0300194',
    id: 'KOAP_RB',
    title: 'Кодекс Республики Беларусь об административных правонарушениях',
    citation: 'КоАП РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk9900295',
    id: 'GPK_RB',
    title: 'Гражданский процессуальный кодекс Республики Беларусь',
    citation: 'ГПК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk9900298',
    id: 'UPK_RB',
    title: 'Уголовно-процессуальный кодекс Республики Беларусь',
    citation: 'УПК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0600166',
    id: 'HK_RB',
    title: 'Хозяйственный процессуальный кодекс Республики Беларусь',
    citation: 'ХПК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0000170',
    id: 'ZK_RB',
    title: 'Кодекс Республики Беларусь о земле',
    citation: 'ЗК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0000153',
    id: 'SK_RB',
    title: 'Кодекс Республики Беларусь о браке и семье',
    citation: 'КоБС РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0000214',
    id: 'ZHK_RB',
    title: 'Жилищный кодекс Республики Беларусь',
    citation: 'ЖК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0600325',
    id: 'LK_RB',
    title: 'Лесной кодекс Республики Беларусь',
    citation: 'ЛК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0200149',
    id: 'VK_RB',
    title: 'Водный кодекс Республики Беларусь',
    citation: 'ВК РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk0700039',
    id: 'EK_RB',
    title: 'Кодекс Республики Беларусь об образовании',
    citation: 'КоО РБ'
  },
  {
    type: 'CODE',
    url: 'https://pravo.by/document/?guid=3871&p0=Hk1200433',
    id: 'IK_RB',
    title: 'Инвестиционный кодекс Республики Беларусь',
    citation: 'ИК РБ'
  },

  // ========== ДЕКРЕТЫ ПРЕЗИДЕНТА (10) ==========
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd1700008',
    id: 'DECREE_8',
    title: 'Декрет Президента РБ №8 "О развитии цифровой экономии"',
    citation: 'Декрет №8'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd0400222',
    id: 'DECREE_7',
    title: 'Декрет Президента РБ №7 "О содействии занятости населения"',
    citation: 'Декрет №7'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd0600080',
    id: 'DECREE_1',
    title: 'Декрет Президента РБ №1 "О дополнительных мерах по работе с населением"',
    citation: 'Декрет №1'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd0700167',
    id: 'DECREE_9',
    title: 'Декрет Президента РБ №9 "О дополнительных мерах по защите прав граждан в жилищной сфере"',
    citation: 'Декрет №9'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd1500002',
    id: 'DECREE_3',
    title: 'Декрет Президента РБ №3 "О предупреждении социального иждивенчества"',
    citation: 'Декрет №3'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd0500214',
    id: 'DECREE_5',
    title: 'Декрет Президента РБ №5 "О некоторых мерах по противодействию торговле людьми"',
    citation: 'Декрет №5'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd1800007',
    id: 'DECREE_4_2018',
    title: 'Декрет Президента РБ №4 "О развитии предпринимательства"',
    citation: 'Декрет №4 (2018)'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd2100456',
    id: 'DECREE_7_2021',
    title: 'Декрет Президента РБ №7 "О регулировании арендных отношений"',
    citation: 'Декрет №7 (2021)'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd2200002',
    id: 'DECREE_2_2022',
    title: 'Декрет Президента РБ №2 "Об упрощении условий для осуществления инвестиционной деятельности"',
    citation: 'Декрет №2 (2022)'
  },
  {
    type: 'DECREE',
    url: 'https://pravo.by/document/?guid=3871&p0=Pd1100503',
    id: 'DECREE_10',
    title: 'Декрет Президента РБ №10 "О совершенствовании отношений в жилищной сфере"',
    citation: 'Декрет №10'
  },

  // ========== ЗАКОНЫ (25+) ==========
  // Информационные технологии и защита данных
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=H10800099',
    id: 'DATA_PROT',
    title: 'Закон РБ "О защите персональных данных"',
    citation: 'Закон о ПД'
  },
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=H10800455',
    id: 'INFO_LAW',
    title: 'Закон РБ "Об информации, информатизации и защите информации"',
    citation: 'Закон об информации'
  },
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=H11100407',
    id: 'COPYRIGHT_LAW',
    title: 'Закон РБ "Об авторском праве и смежных правах"',
    citation: 'Закон об авторском праве'
  },
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=H11200070',
    id: 'ECOM_LAW',
    title: 'Закон РБ "Об электронной цифровой подписи и электронном документе"',
    citation: 'Закон об ЭЦП'
  },

  // Трудовые отношения и занятость
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=V19103104',
    id: 'PROFUNION_LAW',
    title: 'Закон РБ "О профессиональных союзах"',
    citation: 'Закон о профсоюзах'
  },
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=V19102611',
    id: 'LABOR_SAFETY',
    title: 'Закон РБ "Об охране труда"',
    citation: 'Закон об охране труда'
  },

  // Бухгалтерия и налоги
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=H11200057',
    id: 'ACCOUNTING_LAW',
    title: 'Закон РБ "О бухгалтерском учете и отчетности"',
    citation: 'Закон о бухучете'
  },

  // Бизнес и предпринимательство
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=V19102366',
    id: 'LLC_LAW',
    title: 'Закон РБ "О хозяйственных обществах"',
    citation: 'Закон о хоз. обществах'
  },
  {
    type: 'LAW',
    url: 'https://pravo.by/document/?guid=3871&p0=V19102231',
    id: 'IP_LAW',
    title: 'Закон РБ "О предпринимательстве в Республике Беларусь"',
    citation: 'Закон о предпринимательстве'
  },

  // ========== ПОСТАНОВЛЕНИЯ СОВМИНА (10+) ==========
  {
    type: 'RESOLUTION',
    url: 'https://pravo.by/document/?guid=3871&p0=C21500713',
    id: 'RES_713',
    title: 'Постановление Совета Министров РБ №713 "О ценообразовании"',
    citation: 'Пост. №713'
  },
  {
    type: 'RESOLUTION',
    url: 'https://pravo.by/document/?guid=3871&p0=C21200040',
    id: 'RES_40',
    title: 'Постановление Совета Министров РБ №40 "О мерах по совершенствованию правового положения граждан"',
    citation: 'Пост. №40'
  },

  // TODO: Добавить ещё 50+ документов:
  // - Остальные законы по категориям (финансы, недвижимость, медицина, образование)
  // - Указы Президента
  // - Постановления Минтруда, Минфина, Минюста
  // - Технические нормативы и ГОСТы
];

/**
 * Парсинг одного документа
 */
async function parseDocument(browser, docMeta) {
  console.log(`\n📄 Парсинг: ${docMeta.title}...`);

  const page = await browser.newPage();

  try {
    // Эмуляция браузера для обхода блокировки
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1920, height: 1080 });

    // Загрузка страницы с увеличенным таймаутом (для больших кодексов)
    await page.goto(docMeta.url, {
      waitUntil: 'networkidle2',
      timeout: 120000 // 2 минуты
    });

    // Подождать загрузку контента
    await page.waitForSelector('body', { timeout: 10000 });

    const htmlContent = await page.content();
    const $ = cheerio.load(htmlContent);

    // Извлечение структурированного контента
    const document = {
      id: docMeta.id,
      title: docMeta.title,
      type: DOCUMENT_TYPES[docMeta.type].type,
      citation: docMeta.citation,
      url: docMeta.url,
      adoptedDate: extractDate($),
      lastUpdated: new Date().toISOString(),
      sections: []
    };

    // Парсинг структуры документа
    const fullText = extractFullText($);
    document.sections = parseStructure(fullText, docMeta.type);

    // Генерация fullContent для RAG
    document.fullContent = generateFullContent(document);
    document.preview = document.fullContent.substring(0, 300) + '...';

    console.log(`✅ Успешно спарсено: ${document.sections.length} разделов`);

    await page.close();
    return document;

  } catch (error) {
    console.error(`❌ Ошибка парсинга ${docMeta.title}:`, error.message);
    await page.close();
    return null;
  }
}

/**
 * Извлечение даты принятия документа
 */
function extractDate($) {
  // Поиск даты в различных форматах
  const datePatterns = [
    /Принят.+?(\d{1,2}\s+\w+\s+\d{4})/i,
    /от\s+(\d{1,2}\.\d{1,2}\.\d{4})/,
    /№\s*\d+\s+от\s+(\d{1,2}\.\d{1,2}\.\d{4})/
  ];

  const bodyText = $('body').text();

  for (const pattern of datePatterns) {
    const match = bodyText.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

/**
 * Извлечение полного текста документа
 */
function extractFullText($) {
  // Удалить скрипты, стили, навигацию, footer ДО извлечения текста
  $('script').remove();
  $('style').remove();
  $('noscript').remove();
  $('iframe').remove();
  $('nav').remove();
  $('header').remove();
  $('footer').remove();
  $('.menu').remove();
  $('.navigation').remove();
  $('.breadcrumb').remove();
  $('.social').remove();
  $('.cookie').remove();

  // Специфичные селекторы для pravo.by
  const pravBySelectors = [
    '.document',        // Основной контейнер документа
    '.npa-content',     // Контент НПА
    '.law-content',     // Контент закона
    '[class*="content"]', // Любой элемент с "content" в классе
    '[id*="content"]'    // Любой элемент с "content" в ID
  ];

  for (const selector of pravBySelectors) {
    const element = $(selector);
    if (element.length > 0) {
      const text = element.text().trim();
      // Проверка что это не мусор (должен содержать "Статья" или "РАЗДЕЛ")
      if (text.length > 500 && (text.includes('Статья') || text.includes('РАЗДЕЛ') || text.includes('ГЛАВА'))) {
        console.log(`   ✓ Найден контент через selector: ${selector} (${text.length} символов)`);
        return text;
      }
    }
  }

  // Fallback: попробовать найти основной текст через эвристику
  const bodyText = $('body').text();

  // Найти начало юридического текста (обычно начинается с "РАЗДЕЛ" или "Статья")
  const startMarkers = ['РАЗДЕЛ I', 'ГЛАВА 1', 'Статья 1'];
  let startIdx = -1;

  for (const marker of startMarkers) {
    const idx = bodyText.indexOf(marker);
    if (idx !== -1 && (startIdx === -1 || idx < startIdx)) {
      startIdx = idx;
    }
  }

  if (startIdx !== -1) {
    console.log(`   ✓ Найдено начало документа по маркеру на позиции ${startIdx}`);
    // Взять текст от начала юридического документа до конца
    return bodyText.substring(startIdx);
  }

  console.warn('   ⚠️ Не удалось найти структурированный контент, используем весь body');
  return bodyText;
}

/**
 * Парсинг структуры документа
 */
function parseStructure(fullText, docType) {
  const sections = [];

  // Разбиение текста на разделы по заголовкам
  const sectionPattern = /РАЗДЕЛ\s+([IVX]+)\.\s*([^\n]+)/gi;
  const chapterPattern = /ГЛАВА\s+(\d+)\.\s*([^\n]+)/gi;
  const articlePattern = /Статья\s+(\d+)\.\s*([^\n]+)/gi;

  // Извлечение разделов
  const sectionMatches = [...fullText.matchAll(sectionPattern)];

  if (sectionMatches.length > 0) {
    // Документ имеет разделы
    sectionMatches.forEach((sectionMatch, idx) => {
      const sectionNumber = sectionMatch[1];
      const sectionTitle = sectionMatch[2].trim();

      // Найти текст между текущим и следующим разделом
      const startIdx = sectionMatch.index;
      const endIdx = sectionMatches[idx + 1]?.index || fullText.length;
      const sectionText = fullText.substring(startIdx, endIdx);

      const section = {
        number: sectionNumber,
        title: sectionTitle,
        chapters: parseChapters(sectionText)
      };

      sections.push(section);
    });
  } else {
    // Документ без разделов, только главы
    const chapters = parseChapters(fullText);
    if (chapters.length > 0) {
      sections.push({
        number: 'I',
        title: 'Общие положения',
        chapters
      });
    } else {
      // Документ без разделов и глав, только статьи
      const articles = parseArticles(fullText);
      if (articles.length > 0) {
        sections.push({
          number: 'I',
          title: 'Основные положения',
          chapters: [{
            number: '1',
            title: 'Общие положения',
            articles
          }]
        });
      } else {
        // Документ вообще без структуры - сохранить весь текст как один раздел
        // Это для постановлений, декретов без чёткой структуры
        const cleanText = fullText.trim();
        if (cleanText.length > 100) {
          sections.push({
            number: 'I',
            title: 'Содержание документа',
            chapters: [{
              number: '1',
              title: 'Текст документа',
              articles: [{
                number: '1',
                title: 'Полный текст',
                content: cleanText.substring(0, 10000), // Ограничить до 10KB
                paragraphs: [] // Пустой массив для совместимости
              }]
            }]
          });
        }
      }
    }
  }

  return sections;
}

/**
 * Парсинг глав из текста раздела
 */
function parseChapters(text) {
  const chapters = [];
  const chapterPattern = /ГЛАВА\s+(\d+)\.\s*([^\n]+)/gi;
  const chapterMatches = [...text.matchAll(chapterPattern)];

  chapterMatches.forEach((chapterMatch, idx) => {
    const chapterNumber = chapterMatch[1];
    const chapterTitle = chapterMatch[2].trim();

    // Найти текст между текущей и следующей главой
    const startIdx = chapterMatch.index;
    const endIdx = chapterMatches[idx + 1]?.index || text.length;
    const chapterText = text.substring(startIdx, endIdx);

    const chapter = {
      number: chapterNumber,
      title: chapterTitle,
      articles: parseArticles(chapterText)
    };

    chapters.push(chapter);
  });

  return chapters;
}

/**
 * Парсинг статей из текста главы
 */
function parseArticles(text) {
  const articles = [];
  const articlePattern = /Статья\s+(\d+)\.\s*([^\n]+)/gi;
  const articleMatches = [...text.matchAll(articlePattern)];

  articleMatches.forEach((articleMatch, idx) => {
    const articleNumber = articleMatch[1];
    const articleTitle = articleMatch[2].trim();

    // Найти текст между текущей и следующей статьей
    const startIdx = articleMatch.index;
    const endIdx = articleMatches[idx + 1]?.index || text.length;
    const articleText = text.substring(startIdx, endIdx);

    // Очистка текста статьи (убрать заголовок)
    const contentStartIdx = articleText.indexOf('\n');
    const content = articleText.substring(contentStartIdx + 1).trim();

    const article = {
      number: articleNumber,
      title: articleTitle,
      content: content.substring(0, 500), // Ограничение для preview
      paragraphs: parseParagraphs(content)
    };

    articles.push(article);
  });

  return articles;
}

/**
 * Парсинг пунктов из текста статьи
 */
function parseParagraphs(text) {
  const paragraphs = [];
  const paraPattern = /(\d+)\.\s+([^\n]+(?:\n(?!\d+\.)[^\n]+)*)/g;
  const paraMatches = [...text.matchAll(paraPattern)];

  paraMatches.forEach(match => {
    paragraphs.push({
      number: match[1],
      text: match[2].trim()
    });
  });

  return paragraphs;
}

/**
 * Генерация fullContent для RAG
 */
function generateFullContent(document) {
  let content = `${document.title}\n`;

  if (document.adoptedDate) {
    content += `Принят: ${document.adoptedDate}\n`;
  }

  content += '\n';

  document.sections.forEach(section => {
    content += `РАЗДЕЛ ${section.number}. ${section.title}\n\n`;

    section.chapters.forEach(chapter => {
      content += `ГЛАВА ${chapter.number}. ${chapter.title}\n\n`;

      chapter.articles.forEach(article => {
        content += `Статья ${article.number}. ${article.title}\n${article.content}\n\n`;

        if (article.paragraphs && article.paragraphs.length > 0) {
          article.paragraphs.forEach(para => {
            content += `${para.number}. ${para.text}\n`;
          });
        }

        content += '\n';
      });
    });
  });

  return content;
}

/**
 * Главная функция
 */
async function main() {
  console.log('🚀 Запуск парсера pravo.by...\n');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const results = [];
  const outputDir = path.join(__dirname, '../../public/data/documents');

  // Создать директорию если не существует
  await fs.mkdir(outputDir, { recursive: true });

  for (const docMeta of TARGET_DOCUMENTS) {
    try {
      const document = await parseDocument(browser, docMeta);

      if (document) {
        results.push(document);

        // Сохранение промежуточных результатов
        const filePath = path.join(outputDir, `${docMeta.id}.json`);
        await fs.writeFile(
          filePath,
          JSON.stringify(document, null, 2),
          'utf-8'
        );

        console.log(`💾 Сохранено: ${filePath}`);
      }

      // Пауза для избежания блокировки (3-5 секунд)
      const delay = 3000 + Math.random() * 2000;
      console.log(`⏳ Пауза ${Math.round(delay/1000)} сек...`);
      await new Promise(resolve => setTimeout(resolve, delay));

    } catch (error) {
      console.error(`❌ Критическая ошибка для ${docMeta.title}:`, error);
    }
  }

  await browser.close();

  // Генерация индексного файла
  const index = results.map(doc => ({
    id: doc.id,
    title: doc.title,
    type: doc.type,
    citation: doc.citation,
    url: doc.url,
    adoptedDate: doc.adoptedDate,
    lastUpdated: doc.lastUpdated,
    fileSize: Buffer.byteLength(JSON.stringify(doc), 'utf-8'),
    sectionsCount: doc.sections.length,
    articlesCount: doc.sections.reduce((sum, s) =>
      sum + s.chapters.reduce((chSum, ch) => chSum + ch.articles.length, 0), 0
    )
  }));

  const indexPath = path.join(__dirname, '../../public/data/documents-index.json');
  await fs.writeFile(
    indexPath,
    JSON.stringify(index, null, 2),
    'utf-8'
  );

  console.log(`\n✅ Парсинг завершен!`);
  console.log(`📊 Статистика:`);
  console.log(`   - Успешно спарсено: ${results.length} из ${TARGET_DOCUMENTS.length} документов`);
  console.log(`   - Общий размер: ${Math.round(index.reduce((sum, i) => sum + i.fileSize, 0) / 1024)} KB`);
  console.log(`   - Индексный файл: ${indexPath}`);
  console.log(`   - Документы: ${outputDir}`);
}

// Запуск
main().catch(error => {
  console.error('💥 Критическая ошибка:', error);
  process.exit(1);
});
