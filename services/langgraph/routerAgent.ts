/**
 * Router Agent
 *
 * Классифицирует входящий запрос и определяет:
 * 1. Какие агенты должны обработать запрос
 * 2. Нужен ли RAG (поиск по базе знаний)
 */

import { DepartmentId, RouterDecision } from '../../types';
import { AgentStateType } from './state';

// Keywords для определения департамента
const DEPARTMENT_PATTERNS: Record<DepartmentId, RegExp[]> = {
  hr: [
    /труд/i, /работ/i, /отпуск/i, /увольнен/i, /прием/i, /кадр/i,
    /заработ/i, /зарплат/i, /больнич/i, /декрет/i, /стаж/i,
    /трудов(ой|ая|ое)/i, /работник/i, /сотрудник/i
  ],
  accounting: [
    /налог/i, /бухгалтер/i, /отчет/i, /платеж/i, /декларац/i,
    /учет/i, /взнос/i, /ставк/i, /ндс/i, /прибыл/i, /расход/i,
    /доход/i, /баланс/i, /счет/i
  ],
  legal: [
    /договор/i, /право/i, /закон/i, /суд/i, /иск/i, /претенз/i,
    /гражданск/i, /ответственн/i, /штраф/i, /нарушен/i, /кодекс/i,
    /статья/i, /юрид/i, /ip/i, /авторск/i
  ],
  it: [
    /пвт/i, /декрет.*8/i, /резидент/i, /информац/i, /данн/i,
    /защит/i, /цифров/i, /программ/i, /разработк/i, /софт/i,
    /it/i, /айти/i, /технолог/i, /оац/i
  ],
  general: []
};

// Простые запросы, не требующие RAG
const SIMPLE_PATTERNS = [
  /^привет/i, /^здравствуй/i, /^добрый/i, /^спасибо/i,
  /^пока/i, /^до свидания/i, /как дела/i, /кто ты/i
];

/**
 * Определяет релевантные департаменты для запроса
 */
function detectDepartments(query: string): DepartmentId[] {
  const detected: DepartmentId[] = [];

  for (const [dept, patterns] of Object.entries(DEPARTMENT_PATTERNS)) {
    if (dept === 'general') continue;

    for (const pattern of patterns) {
      if (pattern.test(query)) {
        detected.push(dept as DepartmentId);
        break;
      }
    }
  }

  // Если ничего не найдено - general
  if (detected.length === 0) {
    detected.push('general');
  }

  return detected;
}

/**
 * Определяет, нужен ли RAG для этого запроса
 */
function needsRAG(query: string): boolean {
  // Простые запросы не требуют RAG
  for (const pattern of SIMPLE_PATTERNS) {
    if (pattern.test(query)) {
      return false;
    }
  }

  return true;
}

/**
 * Router Agent Node
 *
 * Анализирует запрос и возвращает решение о маршрутизации
 * Учитывает preferredDepartment если пользователь явно выбрал отдел
 */
export async function routerAgent(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  const query = state.currentQuery;
  const preferredDepartment = state.preferredDepartment;

  console.log('🔀 Router Agent: Analyzing query:', query.substring(0, 100));
  console.log('🔀 Preferred department:', preferredDepartment);

  let agents = detectDepartments(query);
  const requiresRAG = needsRAG(query);

  // If user selected a specific department (not 'general'), prioritize it
  if (preferredDepartment && preferredDepartment !== 'general') {
    // If the preferred department wasn't detected, add it first
    if (!agents.includes(preferredDepartment)) {
      agents = [preferredDepartment, ...agents.filter(a => a !== 'general')];
    } else {
      // Move preferred department to first position
      agents = [preferredDepartment, ...agents.filter(a => a !== preferredDepartment)];
    }
  }

  // Limit to max 3 agents for efficiency
  agents = agents.slice(0, 3);

  console.log('🔀 Router Decision:', {
    agents,
    needsRetrieval: requiresRAG,
    preferredDepartment
  });

  return {
    selectedAgents: agents,
    needsRetrieval: requiresRAG
  };
}

/**
 * Routing function for conditional edges
 *
 * Определяет следующий узел на основе решения роутера
 */
export function routeToNextNode(
  state: AgentStateType
): string {
  if (!state.needsRetrieval) {
    // Простой запрос - сразу к агентам (без RAG)
    return "direct_agents";
  }

  // Сложный запрос - сначала retrieval
  return "retrieve";
}

/**
 * Determine which agents to call based on router decision
 */
export function getSelectedAgentNodes(
  state: AgentStateType
): string[] {
  return state.selectedAgents.map(dept => `${dept}_agent`);
}
