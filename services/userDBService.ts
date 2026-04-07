/**
 * User API Service — server-side auth via /api/auth/*
 * Replaces IndexedDB-based user storage
 */

export interface DBUser {
  id: string;
  email: string;
  name: string;
  company?: string;
  position?: string;
  country: string;
  role?: string;
}

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
  localStorage.removeItem('belhard_session_token'); // legacy cleanup
}

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';

async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: any = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

class UserDBService {
  async init(): Promise<void> { /* no-op, server handles DB */ }

  async register(email: string, password: string, name: string, country: string, company?: string, position?: string): Promise<DBUser> {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, country, company, position }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Registration failed');
    }

    setTokens(data.accessToken, data.refreshToken);
    return data.user;
  }

  async login(email: string, password: string): Promise<{ user: DBUser; token: string }> {
    const res = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    setTokens(data.accessToken, data.refreshToken);
    return { user: data.user, token: data.accessToken };
  }

  async findByEmail(email: string): Promise<DBUser | null> {
    // Not needed on client side — server handles lookup during login
    return null;
  }

  async restoreSession(): Promise<DBUser | null> {
    const token = getToken();
    if (!token) return null;

    try {
      const res = await apiFetch('/api/auth/me');
      if (!res.ok) {
        // Try refresh
        const refreshToken = localStorage.getItem('belhard_refresh_token');
        if (refreshToken) {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const tokens = await refreshRes.json();
            setTokens(tokens.accessToken, tokens.refreshToken);
            // Retry
            const retryRes = await apiFetch('/api/auth/me');
            if (retryRes.ok) {
              const data = await retryRes.json();
              return data.user;
            }
          }
        }
        clearTokens();
        return null;
      }

      const data = await res.json();
      return data.user;
    } catch {
      clearTokens();
      return null;
    }
  }

  async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch { /* ignore */ }
    clearTokens();
  }

  async seedDemoUsers(): Promise<void> { /* server handles this via seed-db */ }

  // Helper: get auth headers for other API calls
  static getAuthHeaders(): Record<string, string> {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }
}

export const userDB = new UserDBService();
