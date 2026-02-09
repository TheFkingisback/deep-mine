/**
 * Redis abstraction layer.
 * In production uses ioredis; in dev uses an in-memory implementation.
 * Handles sessions, matchmaking queues, and room codes.
 */

interface SessionData {
  playerId: string;
  shardId: string | null;
  gatewayId: string;
  connectedAt: number;
}

export class RedisStore {
  // In-memory stores for development
  private sessions = new Map<string, SessionData>();
  private matchmakingQueue: { playerId: string; addedAt: number }[] = [];
  private roomCodes = new Map<string, { shardId: string; createdAt: number }>();
  private shardPlayers = new Map<string, Set<string>>();
  private shardSeeds = new Map<string, number>();
  private shardStates = new Map<string, 'waiting' | 'active' | 'closing'>();

  // ─── Session Management ─────────────────────────────────────────

  async setSession(playerId: string, data: SessionData): Promise<void> {
    this.sessions.set(playerId, data);
  }

  async getSession(playerId: string): Promise<SessionData | null> {
    return this.sessions.get(playerId) ?? null;
  }

  async removeSession(playerId: string): Promise<void> {
    this.sessions.delete(playerId);
  }

  async getAllSessions(): Promise<SessionData[]> {
    return [...this.sessions.values()];
  }

  // ─── Matchmaking Queue ──────────────────────────────────────────

  async addToMatchmakingQueue(playerId: string): Promise<void> {
    // Remove if already in queue
    this.matchmakingQueue = this.matchmakingQueue.filter(e => e.playerId !== playerId);
    this.matchmakingQueue.push({ playerId, addedAt: Date.now() });
  }

  async removeFromMatchmakingQueue(playerId: string): Promise<void> {
    this.matchmakingQueue = this.matchmakingQueue.filter(e => e.playerId !== playerId);
  }

  async getMatchmakingQueue(): Promise<string[]> {
    return this.matchmakingQueue.map(e => e.playerId);
  }

  async getMatchmakingQueueSize(): Promise<number> {
    return this.matchmakingQueue.length;
  }

  // ─── Room Codes ─────────────────────────────────────────────────

  async setRoomCode(code: string, shardId: string, ttlSeconds: number): Promise<void> {
    this.roomCodes.set(code, { shardId, createdAt: Date.now() });
    // Auto-expire after TTL
    setTimeout(() => {
      this.roomCodes.delete(code);
    }, ttlSeconds * 1000);
  }

  async getRoomCode(code: string): Promise<string | null> {
    const entry = this.roomCodes.get(code);
    return entry?.shardId ?? null;
  }

  async removeRoomCode(code: string): Promise<void> {
    this.roomCodes.delete(code);
  }

  // ─── Shard State ────────────────────────────────────────────────

  async setShardPlayers(shardId: string, playerIds: string[]): Promise<void> {
    this.shardPlayers.set(shardId, new Set(playerIds));
  }

  async addShardPlayer(shardId: string, playerId: string): Promise<void> {
    let players = this.shardPlayers.get(shardId);
    if (!players) {
      players = new Set();
      this.shardPlayers.set(shardId, players);
    }
    players.add(playerId);
  }

  async removeShardPlayer(shardId: string, playerId: string): Promise<void> {
    const players = this.shardPlayers.get(shardId);
    if (players) {
      players.delete(playerId);
      if (players.size === 0) {
        this.shardPlayers.delete(shardId);
      }
    }
  }

  async getShardPlayers(shardId: string): Promise<string[]> {
    const players = this.shardPlayers.get(shardId);
    return players ? [...players] : [];
  }

  async getShardPlayerCount(shardId: string): Promise<number> {
    return this.shardPlayers.get(shardId)?.size ?? 0;
  }

  async setShardSeed(shardId: string, seed: number): Promise<void> {
    this.shardSeeds.set(shardId, seed);
  }

  async getShardSeed(shardId: string): Promise<number | null> {
    return this.shardSeeds.get(shardId) ?? null;
  }

  async setShardState(shardId: string, state: 'waiting' | 'active' | 'closing'): Promise<void> {
    this.shardStates.set(shardId, state);
  }

  async getShardState(shardId: string): Promise<'waiting' | 'active' | 'closing' | null> {
    return this.shardStates.get(shardId) ?? null;
  }

  async getActiveShards(): Promise<string[]> {
    const active: string[] = [];
    for (const [shardId, state] of this.shardStates) {
      if (state === 'active') active.push(shardId);
    }
    return active;
  }

  async removeShard(shardId: string): Promise<void> {
    this.shardPlayers.delete(shardId);
    this.shardSeeds.delete(shardId);
    this.shardStates.delete(shardId);
  }

  // ─── Stats ──────────────────────────────────────────────────────

  async getOnlinePlayerCount(): Promise<number> {
    return this.sessions.size;
  }

  async getActiveShardCount(): Promise<number> {
    let count = 0;
    for (const state of this.shardStates.values()) {
      if (state === 'active') count++;
    }
    return count;
  }

  destroy(): void {
    this.sessions.clear();
    this.matchmakingQueue = [];
    this.roomCodes.clear();
    this.shardPlayers.clear();
    this.shardSeeds.clear();
    this.shardStates.clear();
  }
}
