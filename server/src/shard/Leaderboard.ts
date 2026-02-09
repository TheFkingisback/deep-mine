interface LeaderboardEntry {
  playerId: string;
  displayName: string;
  gold: number;
  maxDepth: number;
  updatedAt: number;
}

export interface LeaderboardData {
  topGold: { displayName: string; gold: number }[];
  topDepth: { displayName: string; maxDepth: number }[];
}

const MAX_ENTRIES = 100;
const TOP_N = 10;

/**
 * In-memory leaderboard tracking top players by gold earned and max depth reached.
 * Updates are batched - only the top N are sent to clients.
 */
export class Leaderboard {
  private entries = new Map<string, LeaderboardEntry>();

  updatePlayer(playerId: string, displayName: string, gold: number, maxDepth: number): void {
    this.entries.set(playerId, {
      playerId,
      displayName,
      gold,
      maxDepth,
      updatedAt: Date.now(),
    });

    // Evict old entries if over limit
    if (this.entries.size > MAX_ENTRIES) {
      this.evictOldest();
    }
  }

  removePlayer(playerId: string): void {
    this.entries.delete(playerId);
  }

  getTopGold(n: number = TOP_N): { displayName: string; gold: number }[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.gold - a.gold)
      .slice(0, n)
      .map(e => ({ displayName: e.displayName, gold: e.gold }));
  }

  getTopDepth(n: number = TOP_N): { displayName: string; maxDepth: number }[] {
    return Array.from(this.entries.values())
      .sort((a, b) => b.maxDepth - a.maxDepth)
      .slice(0, n)
      .map(e => ({ displayName: e.displayName, maxDepth: e.maxDepth }));
  }

  getLeaderboardData(): LeaderboardData {
    return {
      topGold: this.getTopGold(),
      topDepth: this.getTopDepth(),
    };
  }

  getPlayerRank(playerId: string): { goldRank: number; depthRank: number } | null {
    const entry = this.entries.get(playerId);
    if (!entry) return null;

    const byGold = Array.from(this.entries.values()).sort((a, b) => b.gold - a.gold);
    const byDepth = Array.from(this.entries.values()).sort((a, b) => b.maxDepth - a.maxDepth);

    const goldRank = byGold.findIndex(e => e.playerId === playerId) + 1;
    const depthRank = byDepth.findIndex(e => e.playerId === playerId) + 1;

    return { goldRank, depthRank };
  }

  getEntryCount(): number {
    return this.entries.size;
  }

  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [id, entry] of this.entries) {
      if (entry.updatedAt < oldestTime) {
        oldestTime = entry.updatedAt;
        oldest = id;
      }
    }

    if (oldest) {
      this.entries.delete(oldest);
    }
  }

  destroy(): void {
    this.entries.clear();
  }
}
