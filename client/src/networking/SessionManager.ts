const AUTH_KEY = 'deep_mine_auth';
const SESSION_KEY = 'deep_mine_session';
const AUTH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface StoredAuth {
  token: string;
  nickname: string;
  timestamp: number;
}

interface StoredSession {
  playerId: string;
  token: string;
  shardId: string | null;
  timestamp: number;
}

export class SessionManager {
  private session: StoredSession | null = null;

  constructor() {
    this.loadSession();
  }

  // ─── Auth token (persistent login) ──────────────────────────────

  saveAuth(token: string, nickname: string): void {
    const data: StoredAuth = { token, nickname, timestamp: Date.now() };
    try { localStorage.setItem(AUTH_KEY, JSON.stringify(data)); } catch { /* noop */ }
  }

  getAuth(): StoredAuth | null {
    try {
      const raw = localStorage.getItem(AUTH_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw) as StoredAuth;
      if (Date.now() - data.timestamp > AUTH_EXPIRY_MS) { this.clearAuth(); return null; }
      return data;
    } catch { return null; }
  }

  clearAuth(): void {
    try { localStorage.removeItem(AUTH_KEY); } catch { /* noop */ }
  }

  isLoggedIn(): boolean {
    return this.getAuth() !== null;
  }

  getNickname(): string | null {
    return this.getAuth()?.nickname ?? null;
  }

  getToken(): string | null {
    return this.getAuth()?.token ?? null;
  }

  // ─── Game session (reconnection) ────────────────────────────────

  save(playerId: string, token: string, shardId: string | null): void {
    this.session = { playerId, token, shardId, timestamp: Date.now() };
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch { /* noop */ }
  }

  updateShardId(shardId: string): void {
    if (this.session) {
      this.session.shardId = shardId;
      try { localStorage.setItem(SESSION_KEY, JSON.stringify(this.session)); } catch { /* noop */ }
    }
  }

  private loadSession(): void {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession;
        if (Date.now() - parsed.timestamp < 60000) {
          this.session = parsed;
        } else { this.clear(); }
      }
    } catch { this.session = null; }
  }

  getSession(): StoredSession | null {
    if (!this.session) return null;
    if (Date.now() - this.session.timestamp > 60000) { this.clear(); return null; }
    return this.session;
  }

  clear(): void {
    this.session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch { /* noop */ }
  }

  hasValidSession(): boolean {
    return this.getSession() !== null;
  }
}
