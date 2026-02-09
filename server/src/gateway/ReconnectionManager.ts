import { ConnectedPlayer } from '../types.js';
import { ShardManager } from '../shard/ShardManager.js';

interface SessionInfo {
  playerId: string;
  displayName: string;
  shardId: string | null;
  disconnectedAt: number;
}

const GRACE_PERIOD_MS = 30000; // 30 seconds to reconnect

/**
 * Manages player sessions for reconnection.
 * When a player disconnects, their session is preserved for 30 seconds.
 * If they reconnect within that window, they rejoin their shard seamlessly.
 */
export class ReconnectionManager {
  private sessions = new Map<string, SessionInfo>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private shardManager: ShardManager) {
    // Periodically clean expired sessions
    this.cleanupTimer = setInterval(() => this.cleanup(), 10000);
  }

  /**
   * Called when a player disconnects. Stores session for potential reconnection.
   */
  onDisconnect(player: ConnectedPlayer): void {
    this.sessions.set(player.id, {
      playerId: player.id,
      displayName: player.displayName,
      shardId: player.shardId,
      disconnectedAt: Date.now(),
    });

    // Notify shard about disconnection (starts grace period)
    if (player.shardId) {
      this.shardManager.onPlayerDisconnect(player.id);
    }

    console.log(`[Reconnect] Session saved for ${player.id} (${player.displayName})`);
  }

  /**
   * Attempt to reconnect a player using their previous session.
   * Returns true if reconnection succeeded.
   */
  tryReconnect(playerId: string, newPlayer: ConnectedPlayer): boolean {
    const session = this.sessions.get(playerId);
    if (!session) return false;

    // Check if session expired
    if (Date.now() - session.disconnectedAt > GRACE_PERIOD_MS) {
      this.sessions.delete(playerId);
      return false;
    }

    // Try to reconnect to shard
    if (session.shardId) {
      const success = this.shardManager.onPlayerReconnect(playerId, newPlayer);
      if (success) {
        newPlayer.shardId = session.shardId;
        newPlayer.displayName = session.displayName;
        newPlayer.authenticated = true;
        this.sessions.delete(playerId);
        console.log(`[Reconnect] Player ${playerId} reconnected to shard ${session.shardId}`);
        return true;
      }
    }

    this.sessions.delete(playerId);
    return false;
  }

  /**
   * Check if a session exists for a player.
   */
  hasSession(playerId: string): boolean {
    const session = this.sessions.get(playerId);
    if (!session) return false;
    if (Date.now() - session.disconnectedAt > GRACE_PERIOD_MS) {
      this.sessions.delete(playerId);
      return false;
    }
    return true;
  }

  /**
   * Clean up expired sessions.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.disconnectedAt > GRACE_PERIOD_MS) {
        this.sessions.delete(id);
        // Remove player from shard (grace period expired)
        if (session.shardId) {
          this.shardManager.removePlayerFromShard(id);
        }
        console.log(`[Reconnect] Session expired for ${id}`);
      }
    }
  }

  getActiveSessionCount(): number {
    return this.sessions.size;
  }

  destroy(): void {
    clearInterval(this.cleanupTimer);
    this.sessions.clear();
  }
}
