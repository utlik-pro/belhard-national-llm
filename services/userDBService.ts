/**
 * User Auth Service — tries server API, falls back to local auth for demo
 */

export interface DBUser {
  id: string;
  email: string;
  name: string;
  company?: string;
  position?: string;
  country: string;
  role?: string;
  password?: string;
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('belhard_access_token');
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('belhard_access_token', accessToken);
  localStorage.setItem('belhard_refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('belhard_access_token');
  localStorage.removeItem('belhard_refresh_token');
  localStorage.removeItem('belhard_session_token');
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch {
    clearTimeout(timeout);
    throw new Error('API_UNAVAILABLE');
  }
}

// ==================== LOCAL FALLBACK AUTH ====================

const LOCAL_USERS_KEY = 'belhard_local_users';
const LOCAL_SESSION_KEY = 'belhard_local_session';

function getLocalUsers(): DBUser[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || '[]'); } catch { return []; }
}

function saveLocalUsers(users: DBUser[]) {
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
}

function seedLocalUsers() {
  const users = getLocalUsers();
  if (users.length > 0) return;
  saveLocalUsers([
    { id: 'u1', email: 'demo@belhard.ai', name: 'Алексей Петров', country: 'belarus', company: 'Belhard Group', position: 'Разработчик', role: 'admin', password: '123456' },
    { id: 'u2', email: 'demo@huquqi.az', name: 'Test User', country: 'azerbaijan', company: 'HeadBots', position: 'Developer', role: 'user', password: '123456' },
  ]);
}

// ==================== SERVICE ====================

class UserDBService {
  async init(): Promise<void> {
    seedLocalUsers();
  }

  async register(email: string, password: string, name: string, country: string, company?: string, position?: string): Promise<DBUser> {
    // Try server first
    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name, country, company, position }),
      });
      const data = await res.json();
      if (res.ok) {
        setTokens(data.accessToken, data.refreshToken);
        return data.user;
      }
      if (data.error === 'USER_EXISTS') throw new Error('USER_EXISTS');
    } catch (e: any) {
      if (e.message === 'USER_EXISTS') throw e;
      console.warn('Server unavailable, using local auth');
    }

    // Fallback: local
    const users = getLocalUsers();
    if (users.find(u => u.email === email.toLowerCase().trim())) throw new Error('USER_EXISTS');

    const user: DBUser = { id: 'u_' + Date.now(), email: email.toLowerCase().trim(), name: name.trim(), country, company, position, role: 'user', password };
    users.push(user);
    saveLocalUsers(users);
    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
    return user;
  }

  async login(email: string, password: string): Promise<{ user: DBUser; token: string }> {
    // Try server first
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setTokens(data.accessToken, data.refreshToken);
        return { user: data.user, token: data.accessToken };
      }
      // Server responded with auth error — use it
      if (data.error === 'USER_NOT_FOUND' || data.error === 'INVALID_PASSWORD') {
        throw new Error(data.error);
      }
    } catch (e: any) {
      if (e.message === 'USER_NOT_FOUND' || e.message === 'INVALID_PASSWORD') throw e;
      console.warn('Server unavailable, using local auth');
    }

    // Fallback: local auth
    seedLocalUsers();
    const users = getLocalUsers();
    const user = users.find(u => u.email === email.toLowerCase().trim());
    if (!user) throw new Error('USER_NOT_FOUND');
    if (user.password && user.password !== password) throw new Error('INVALID_PASSWORD');

    localStorage.setItem(LOCAL_SESSION_KEY, JSON.stringify(user));
    return { user, token: 'local' };
  }

  async findByEmail(email: string): Promise<DBUser | null> {
    const users = getLocalUsers();
    return users.find(u => u.email === email.toLowerCase().trim()) || null;
  }

  async restoreSession(): Promise<DBUser | null> {
    // Try server first
    const token = getToken();
    if (token) {
      try {
        const res = await apiFetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          return data.user;
        }
      } catch { /* server unavailable */ }
    }

    // Fallback: local session
    try {
      const saved = localStorage.getItem(LOCAL_SESSION_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* ignore */ }

    return null;
  }

  async logout(): Promise<void> {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearTokens();
    localStorage.removeItem(LOCAL_SESSION_KEY);
  }

  async seedDemoUsers(): Promise<void> {
    seedLocalUsers();
  }

  static getAuthHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

export const userDB = new UserDBService();
