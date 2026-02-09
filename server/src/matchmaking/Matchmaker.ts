import { PlayerState } from '@shared/types';
import { ServerMessage, MatchmakingResultMessage } from '../types.js';
import { ConnectedPlayer } from '../types.js';
import { ShardManager } from '../shard/ShardManager.js';
import { PlayerStore } from '../persistence/PlayerStore.js';

export class Matchmaker {
  private shardManager: ShardManager;
  private playerStore: PlayerStore;

  constructor(shardManager: ShardManager, playerStore: PlayerStore) {
    this.shardManager = shardManager;
    this.playerStore = playerStore;
  }

  async handleQuickPlay(player: ConnectedPlayer): Promise<ServerMessage[]> {
    const messages: ServerMessage[] = [];

    // Try to find an existing shard with room
    let shard = this.shardManager.findBestShard();

    // If no suitable shard found, create a new one
    if (!shard) {
      shard = this.shardManager.createShard();
    }

    // Load or create player state
    let playerState = await this.playerStore.loadPlayer(player.id);
    if (!playerState) {
      playerState = await this.playerStore.createPlayer(player.id, player.displayName);
    }

    // Add player to shard
    const success = this.shardManager.addPlayerToShard(shard.id, player, playerState);

    const result: MatchmakingResultMessage = {
      type: 'matchmaking_result',
      success,
      shardId: success ? shard.id : undefined,
      error: success ? undefined : 'Failed to join shard',
    };
    messages.push(result);

    return messages;
  }

  async handleCreateParty(player: ConnectedPlayer, maxPlayers?: number): Promise<ServerMessage[]> {
    const messages: ServerMessage[] = [];

    const roomCode = this.shardManager.generateRoomCode();
    const shard = this.shardManager.createShard({ roomCode, maxPlayers });

    let playerState = await this.playerStore.loadPlayer(player.id);
    if (!playerState) {
      playerState = await this.playerStore.createPlayer(player.id, player.displayName);
    }

    const success = this.shardManager.addPlayerToShard(shard.id, player, playerState);

    const result: MatchmakingResultMessage = {
      type: 'matchmaking_result',
      success,
      shardId: success ? shard.id : undefined,
      roomCode: success ? roomCode : undefined,
      error: success ? undefined : 'Failed to create party',
    };
    messages.push(result);

    return messages;
  }

  async handleJoinParty(player: ConnectedPlayer, roomCode: string): Promise<ServerMessage[]> {
    const messages: ServerMessage[] = [];

    const shard = this.shardManager.findShardByRoomCode(roomCode);
    if (!shard) {
      const result: MatchmakingResultMessage = {
        type: 'matchmaking_result',
        success: false,
        error: 'Room not found',
      };
      messages.push(result);
      return messages;
    }

    if (shard.isFull()) {
      const result: MatchmakingResultMessage = {
        type: 'matchmaking_result',
        success: false,
        error: 'Room is full',
      };
      messages.push(result);
      return messages;
    }

    let playerState = await this.playerStore.loadPlayer(player.id);
    if (!playerState) {
      playerState = await this.playerStore.createPlayer(player.id, player.displayName);
    }

    const success = this.shardManager.addPlayerToShard(shard.id, player, playerState);

    const result: MatchmakingResultMessage = {
      type: 'matchmaking_result',
      success,
      shardId: success ? shard.id : undefined,
      roomCode: success ? roomCode : undefined,
      error: success ? undefined : 'Failed to join party',
    };
    messages.push(result);

    return messages;
  }

  async handlePlaySolo(player: ConnectedPlayer): Promise<ServerMessage[]> {
    const messages: ServerMessage[] = [];

    const shard = this.shardManager.createShard({ maxPlayers: 1 });

    let playerState = await this.playerStore.loadPlayer(player.id);
    if (!playerState) {
      playerState = await this.playerStore.createPlayer(player.id, player.displayName);
    }

    const success = this.shardManager.addPlayerToShard(shard.id, player, playerState);

    const result: MatchmakingResultMessage = {
      type: 'matchmaking_result',
      success,
      shardId: success ? shard.id : undefined,
      error: success ? undefined : 'Failed to create solo session',
    };
    messages.push(result);

    return messages;
  }
}
