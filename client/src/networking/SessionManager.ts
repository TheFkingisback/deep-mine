const SESSION_KEY = 'deep_mine_session';

interface StoredSession {
  playerId: string;
  token: string;
  shardId: string | null;
  timestamp: number;
}

/**
 * Manages client session persistence for reconnection.
 * Stores session info in localStorage so the client can attempt
 * to rejoin after a disconnect or page refresh.
 */
export class SessionManager {
  private session: StoredSession | null = null;

  constructor() {
    this.load();
  }

  /**
   * Save session after successful authentication/matchmaking.
   */
  save(playerId: string, token: string, shardId: string | null): void {
    this.session = {
      playerId,
      token,
      shardId,
      timestamp: Date.now(),
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
    } catch {
      // localStorage not available
    }
  }

  /**
   * Update the shard ID (e.g., after matchmaking).
   */
  updateShardId(shardId: string): void {
    if (this.session) {
      this.session.shardId = shardId;
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(this.session));
      } catch {
        // localStorage not available
      }
    }
  }

  /**
   * Load session from localStorage.
   */
  private load(): void {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredSession;
        // Session expires after 60 seconds
        if (Date.now() - parsed.timestamp < 60000) {
          this.session = parsed;
        } else {
          this.clear();
        }
      }
    } catch {
      this.session = null;
    }
  }

  /**
   * Get session info for reconnection attempt.
   */
  getSession(): StoredSession | null {
    if (!this.session) return null;
    // Check expiry
    if (Date.now() - this.session.timestamp > 60000) {
      this.clear();
      return null;
    }
    return this.session;
  }

  /**
   * Clear session (on logout or after failed reconnect).
   */
  clear(): void {
    this.session = null;
    try {
      localStorage.removeItem(SESSION_KEY);
    } catch {
      // localStorage not available
    }
  }

  hasValidSession(): boolean {
    return this.getSession() !== null;
  }
}
