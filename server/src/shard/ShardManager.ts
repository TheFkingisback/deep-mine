import { v4 as uuidv4 } from 'uuid';
import { PlayerState } from '@shared/types';
import { MAX_PLAYERS_PER_SHARD, ROOM_CODE_LENGTH } from '@shared/constants';
import { ConnectedPlayer, ClientMessage } from '../types.js';
import { Shard } from './Shard.js';

export class ShardManager {
  private shards = new Map<string, Shard>();
  private playerShardMap = new Map<string, string>();

  createShard(options?: { roomCode?: string; maxPlayers?: number; seed?: number }): Shard {
    const id = uuidv4();
    const shard = new Shard(id, options);
    this.shards.set(id, shard);
    shard.start();
    console.log(`[ShardManager] Created shard ${id}`);
    return shard;
  }

  destroyShard(shardId: string): void {
    const shard = this.shards.get(shardId);
    if (!shard) return;

    shard.stop();
    this.shards.delete(shardId);

    // Clean up player mappings
    for (const [playerId, sid] of this.playerShardMap) {
      if (sid === shardId) {
        this.playerShardMap.delete(playerId);
      }
    }

    console.log(`[ShardManager] Destroyed shard ${shardId}`);
  }

  addPlayerToShard(
    shardId: string,
    player: ConnectedPlayer,
    playerState: PlayerState
  ): boolean {
    const shard = this.shards.get(shardId);
    if (!shard) return false;

    const success = shard.addPlayer(player, playerState);
    if (success) {
      this.playerShardMap.set(player.id, shardId);
      player.shardId = shardId;
    }
    return success;
  }

  removePlayerFromShard(playerId: string): void {
    const shardId = this.playerShardMap.get(playerId);
    if (!shardId) return;

    const shard = this.shards.get(shardId);
    if (shard) {
      shard.removePlayer(playerId);

      // Auto-destroy empty shards
      if (shard.getPlayerCount() === 0) {
        this.destroyShard(shardId);
      }
    }

    this.playerShardMap.delete(playerId);
  }

  onPlayerDisconnect(playerId: string): void {
    const shardId = this.playerShardMap.get(playerId);
    if (!shardId) return;

    const shard = this.shards.get(shardId);
    shard?.onPlayerDisconnect(playerId);
  }

  onPlayerReconnect(playerId: string, ws: ConnectedPlayer): boolean {
    const shardId = this.playerShardMap.get(playerId);
    if (!shardId) return false;

    const shard = this.shards.get(shardId);
    if (!shard) return false;

    return shard.onPlayerReconnect(playerId, ws);
  }

  routeMessage(playerId: string, player: ConnectedPlayer, message: ClientMessage): void {
    const shardId = this.playerShardMap.get(playerId);
    if (!shardId) return;

    const shard = this.shards.get(shardId);
    shard?.enqueueMessage(player, message);
  }

  /**
   * Find the best shard for quick play.
   * Prefers shards with 3-6 players.
   */
  findBestShard(): Shard | null {
    let bestShard: Shard | null = null;
    let bestScore = -1;

    for (const [, shard] of this.shards) {
      if (shard.getState() !== 'active') continue;
      if (shard.isFull()) continue;
      if (shard.roomCode !== null) continue; // Skip private shards

      const count = shard.getPlayerCount();
      // Score: prefer 3-6 players range
      let score = 0;
      if (count >= 3 && count <= 6) score = 10;
      else if (count >= 1 && count < 3) score = 5;
      else score = 1;

      if (score > bestScore) {
        bestScore = score;
        bestShard = shard;
      }
    }

    return bestShard;
  }

  findShardByRoomCode(roomCode: string): Shard | null {
    for (const [, shard] of this.shards) {
      if (shard.roomCode === roomCode) return shard;
    }
    return null;
  }

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  getShard(shardId: string): Shard | null {
    return this.shards.get(shardId) ?? null;
  }

  getPlayerShard(playerId: string): Shard | null {
    const shardId = this.playerShardMap.get(playerId);
    if (!shardId) return null;
    return this.shards.get(shardId) ?? null;
  }

  getActiveShardCount(): number {
    return this.shards.size;
  }

  getTotalPlayerCount(): number {
    let count = 0;
    for (const [, shard] of this.shards) {
      count += shard.getPlayerCount();
    }
    return count;
  }

  destroyAll(): void {
    for (const [id] of this.shards) {
      this.destroyShard(id);
    }
  }
}
