import { PlayerState, EquipmentSlot, EquipmentTier, ItemType } from '@shared/types';
import { MAX_PLAYERS_PER_SHARD, PLAYER_DISCONNECT_GRACE, CHUNK_SAVE_INTERVAL } from '@shared/constants';
import { ClientMessage, ServerMessage, ConnectedPlayer } from '../types.js';
import { GameLoop } from './GameLoop.js';
import { WorldManager } from './WorldManager.js';
import { DigValidator } from './DigValidator.js';
import { FogOfWar } from './FogOfWar.js';
import { EconomyManager } from './EconomyManager.js';

export type ShardState = 'waiting' | 'active' | 'closing';

interface ShardPlayer {
  connected: ConnectedPlayer;
  state: PlayerState;
  disconnectedAt: number | null;
}

export class Shard {
  readonly id: string;
  readonly roomCode: string | null;
  private state: ShardState = 'waiting';
  private maxPlayers: number;

  private gameLoop: GameLoop;
  private worldManager: WorldManager;
  private digValidator: DigValidator;
  private fogOfWar: FogOfWar;
  private economyManager: EconomyManager;

  private players = new Map<string, ShardPlayer>();
  private saveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(id: string, options?: { roomCode?: string; maxPlayers?: number; seed?: number }) {
    this.id = id;
    this.roomCode = options?.roomCode ?? null;
    this.maxPlayers = options?.maxPlayers ?? MAX_PLAYERS_PER_SHARD;

    this.worldManager = new WorldManager(options?.seed);
    this.digValidator = new DigValidator(this.worldManager);
    this.fogOfWar = new FogOfWar(this.worldManager);
    this.economyManager = new EconomyManager();

    this.gameLoop = new GameLoop();
    this.gameLoop.setMessageHandler((player, msg) => this.handleMessage(player, msg));
    this.gameLoop.setTickHandler((tick, deltaMs) => this.onTick(tick, deltaMs));
  }

  start(): void {
    this.state = 'active';
    this.gameLoop.start();

    // Periodic chunk save
    this.saveTimer = setInterval(() => {
      this.saveDirtyChunks();
    }, CHUNK_SAVE_INTERVAL);

    console.log(`[Shard ${this.id}] Started`);
  }

  stop(): void {
    this.state = 'closing';
    this.gameLoop.stop();

    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    this.saveDirtyChunks();
    this.fogOfWar.destroy();
    this.worldManager.destroy();

    console.log(`[Shard ${this.id}] Stopped`);
  }

  addPlayer(connected: ConnectedPlayer, playerState: PlayerState): boolean {
    if (this.players.size >= this.maxPlayers) return false;

    const shardPlayer: ShardPlayer = {
      connected,
      state: playerState,
      disconnectedAt: null,
    };

    this.players.set(connected.id, shardPlayer);
    this.gameLoop.addPlayer(connected);
    this.fogOfWar.addPlayer(
      connected.id,
      playerState.position,
      playerState.equipment[EquipmentSlot.TORCH] as EquipmentTier
    );

    // Notify other players
    this.gameLoop.broadcast({
      type: 'other_player_joined',
      playerId: connected.id,
      displayName: connected.displayName,
      x: playerState.position.x,
      y: playerState.position.y,
    }, connected.id);

    // Send initial reveals
    const reveals = this.fogOfWar.getInitialReveals(connected.id);
    for (const reveal of reveals) {
      this.gameLoop.sendToPlayer(connected, reveal);
    }

    console.log(`[Shard ${this.id}] Player ${connected.id} joined (${this.players.size}/${this.maxPlayers})`);
    return true;
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;

    this.players.delete(playerId);
    this.gameLoop.removePlayer(playerId);
    this.fogOfWar.removePlayer(playerId);

    // Notify others
    this.gameLoop.broadcastToAll({
      type: 'other_player_left',
      playerId,
    });

    console.log(`[Shard ${this.id}] Player ${playerId} left (${this.players.size}/${this.maxPlayers})`);
  }

  onPlayerDisconnect(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.disconnectedAt = Date.now();
      console.log(`[Shard ${this.id}] Player ${playerId} disconnected (grace period ${PLAYER_DISCONNECT_GRACE}ms)`);
    }
  }

  onPlayerReconnect(playerId: string, ws: ConnectedPlayer): boolean {
    const player = this.players.get(playerId);
    if (!player || player.disconnectedAt === null) return false;

    player.connected = ws;
    player.disconnectedAt = null;
    this.gameLoop.addPlayer(ws);

    console.log(`[Shard ${this.id}] Player ${playerId} reconnected`);
    return true;
  }

  enqueueMessage(player: ConnectedPlayer, message: ClientMessage): void {
    this.gameLoop.enqueue(player, message);
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  isFull(): boolean {
    return this.players.size >= this.maxPlayers;
  }

  getState(): ShardState {
    return this.state;
  }

  getWorldSeed(): number {
    return this.worldManager.getSeed();
  }

  hasPlayer(playerId: string): boolean {
    return this.players.has(playerId);
  }

  getPlayerState(playerId: string): PlayerState | null {
    return this.players.get(playerId)?.state ?? null;
  }

  private handleMessage(player: ConnectedPlayer, message: ClientMessage): ServerMessage[] | null {
    const shardPlayer = this.players.get(player.id);
    if (!shardPlayer) return null;

    switch (message.type) {
      case 'dig':
        return this.handleDig(shardPlayer, message.x, message.y);
      case 'move':
        return this.handleMove(shardPlayer, message.x, message.y);
      case 'sell':
        return this.handleSell(shardPlayer, message.items);
      case 'buy_equipment':
        return this.handleBuyEquipment(shardPlayer, message.slot, message.tier);
      case 'buy_inventory_upgrade':
        return this.handleBuyInventoryUpgrade(shardPlayer);
      case 'go_surface':
        return this.handleGoSurface(shardPlayer);
      default:
        return null;
    }
  }

  private handleDig(player: ShardPlayer, x: number, y: number): ServerMessage[] {
    const result = this.digValidator.validateAndProcessDig(player.state, x, y);

    if (!result.valid) {
      return [{ type: 'error', code: result.error ?? 'DIG_FAILED', message: result.error ?? 'Dig failed' }];
    }

    // Broadcast to all players
    for (const msg of result.broadcastMessages) {
      this.gameLoop.broadcastToAll(msg);
    }

    return result.messages;
  }

  private handleMove(player: ShardPlayer, x: number, y: number): ServerMessage[] {
    const oldPos = { ...player.state.position };
    player.state.position = { x, y };

    // Update max depth
    if (y > player.state.maxDepthReached) {
      player.state.maxDepthReached = y;
    }

    // Fog of war reveals
    const reveals = this.fogOfWar.onPlayerMove(player.connected.id, { x, y });
    const messages: ServerMessage[] = [...reveals];

    // Broadcast position to other players
    this.gameLoop.broadcast({
      type: 'other_player_update',
      playerId: player.connected.id,
      displayName: player.connected.displayName,
      x,
      y,
      action: 'walking',
      equipment: player.state.equipment as unknown as Record<string, number>,
    }, player.connected.id);

    return messages;
  }

  private handleSell(player: ShardPlayer, items: { itemType: ItemType; quantity: number }[]): ServerMessage[] {
    const result = this.economyManager.processSellRequest(player.state, items);
    return result.messages;
  }

  private handleBuyEquipment(player: ShardPlayer, slot: EquipmentSlot, tier: EquipmentTier): ServerMessage[] {
    const result = this.economyManager.processEquipmentBuyRequest(player.state, slot, tier);

    // Update fog of war if torch was upgraded
    if (result.success && slot === EquipmentSlot.TORCH) {
      this.fogOfWar.updateTorchTier(player.connected.id, tier);
    }

    return result.messages;
  }

  private handleBuyInventoryUpgrade(player: ShardPlayer): ServerMessage[] {
    const result = this.economyManager.processInventoryUpgradeRequest(player.state);
    return result.messages;
  }

  private handleGoSurface(player: ShardPlayer): ServerMessage[] {
    player.state.position = { x: 10, y: 0 };
    player.state.isOnSurface = true;
    return [];
  }

  private onTick(_tick: number, _deltaMs: number): void {
    // Check for disconnected players past grace period
    const now = Date.now();
    for (const [playerId, player] of this.players) {
      if (player.disconnectedAt && now - player.disconnectedAt > PLAYER_DISCONNECT_GRACE) {
        console.log(`[Shard ${this.id}] Player ${playerId} grace period expired, removing`);
        this.removePlayer(playerId);
      }
    }

    // Broadcast player positions to each other at tick rate
    for (const [, player] of this.players) {
      if (player.disconnectedAt) continue;
      // Other players' positions are broadcast via handleMove
    }
  }

  private saveDirtyChunks(): void {
    const dirty = this.worldManager.getDirtyChunks();
    if (dirty.length > 0) {
      console.log(`[Shard ${this.id}] Saving ${dirty.length} dirty chunks`);
      this.worldManager.markChunksSaved(dirty.map(d => d.chunkY));
    }
  }
}
