import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { ClientMessage, ServerMessage, ConnectedPlayer } from '../types.js';
import { createGuestAuth, validateToken } from './Auth.js';
import { ReconnectionManager } from './ReconnectionManager.js';
import { ShardManager } from '../shard/ShardManager.js';
import { Matchmaker } from '../matchmaking/Matchmaker.js';
import { PlayerStore } from '../persistence/PlayerStore.js';

/**
 * Gateway process: handles WebSocket connections, authentication,
 * and routes messages to the appropriate shard.
 * Separated from shard game logic for horizontal scaling.
 */
export class Gateway {
  private wss: WebSocketServer | null = null;
  private players = new Map<string, ConnectedPlayer>();
  private reconnectionManager: ReconnectionManager;
  private shardManager: ShardManager;
  private matchmaker: Matchmaker;
  private playerStore: PlayerStore;

  constructor() {
    this.playerStore = new PlayerStore();
    this.shardManager = new ShardManager();
    this.reconnectionManager = new ReconnectionManager(this.shardManager);
    this.matchmaker = new Matchmaker(this.shardManager, this.playerStore);
  }

  start(port: number): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('listening', () => {
      console.log(`[Gateway] Listening on ws://localhost:${port}`);
    });

    this.wss.on('connection', (ws: WebSocket) => {
      this.handleConnection(ws);
    });

    console.log(`[Gateway] Starting on port ${port}...`);
  }

  private handleConnection(ws: WebSocket): void {
    const playerId = uuidv4();
    const player: ConnectedPlayer = {
      id: playerId,
      displayName: '',
      ws,
      authenticated: false,
      shardId: null,
      lastActivity: Date.now(),
    };

    this.players.set(playerId, player);
    console.log(`[Gateway] Player ${playerId} connected (${this.players.size} total)`);

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as ClientMessage;
        player.lastActivity = Date.now();
        this.routeMessage(player, message);
      } catch (err) {
        console.error(`[Gateway] Invalid message from ${playerId}:`, err);
        this.sendToPlayer(ws, {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: 'Could not parse message',
        });
      }
    });

    ws.on('close', () => {
      console.log(`[Gateway] Player ${playerId} disconnected`);
      this.reconnectionManager.onDisconnect(player);
      this.players.delete(playerId);
    });

    ws.on('error', (err) => {
      console.error(`[Gateway] Player ${playerId} error:`, err.message);
    });
  }

  private async routeMessage(player: ConnectedPlayer, message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'auth':
        await this.handleAuth(player, message.token);
        break;

      // Matchmaking messages - handled by gateway
      case 'join_quick_play':
      case 'create_party':
      case 'join_party':
      case 'play_solo':
        await this.handleMatchmaking(player, message);
        break;

      // Game messages - route to shard
      case 'dig':
      case 'move':
      case 'collect_item':
      case 'go_surface':
      case 'sell':
      case 'buy_equipment':
      case 'buy_inventory_upgrade':
      case 'set_checkpoint':
      case 'descend':
      case 'chat':
        this.routeToShard(player, message);
        break;

      default:
        this.sendToPlayer(player.ws, {
          type: 'error',
          code: 'UNKNOWN_TYPE',
          message: 'Unknown message type',
        });
    }
  }

  private async handleAuth(player: ConnectedPlayer, token?: string): Promise<void> {
    const defaultState = { gold: 0, equipment: {}, inventorySlots: 8, inventoryLevel: 0, maxDepthReached: 0 };

    if (token) {
      // Verify existing token
      const payload = validateToken(token);
      if (payload) {
        player.id = payload.playerId;
        player.displayName = payload.displayName;
        player.authenticated = true;

        // Try reconnection
        if (this.reconnectionManager.hasSession(payload.playerId)) {
          const reconnected = this.reconnectionManager.tryReconnect(payload.playerId, player);
          if (reconnected) {
            this.sendToPlayer(player.ws, {
              type: 'welcome',
              playerId: player.id,
              displayName: player.displayName,
              state: defaultState,
            });
            return;
          }
        }

        this.sendToPlayer(player.ws, {
          type: 'welcome',
          playerId: player.id,
          displayName: player.displayName,
          state: defaultState,
        });
        return;
      }
    }

    // Create guest auth
    const guestAuth = createGuestAuth();
    player.id = guestAuth.playerId;
    player.displayName = guestAuth.displayName;
    player.authenticated = true;

    this.sendToPlayer(player.ws, {
      type: 'welcome',
      playerId: guestAuth.playerId,
      displayName: guestAuth.displayName,
      state: defaultState,
    });
  }

  private async handleMatchmaking(player: ConnectedPlayer, message: ClientMessage): Promise<void> {
    if (!player.authenticated) {
      this.sendToPlayer(player.ws, {
        type: 'error',
        code: 'NOT_AUTHENTICATED',
        message: 'Must authenticate first',
      });
      return;
    }

    let responses: ServerMessage[] = [];

    switch (message.type) {
      case 'join_quick_play':
        responses = await this.matchmaker.handleQuickPlay(player);
        break;
      case 'create_party':
        responses = await this.matchmaker.handleCreateParty(player, message.maxPlayers);
        break;
      case 'join_party':
        responses = await this.matchmaker.handleJoinParty(player, message.roomCode);
        break;
      case 'play_solo':
        responses = await this.matchmaker.handlePlaySolo(player);
        break;
    }

    for (const msg of responses) {
      this.sendToPlayer(player.ws, msg);
    }
  }

  private routeToShard(player: ConnectedPlayer, message: ClientMessage): void {
    if (!player.shardId) {
      this.sendToPlayer(player.ws, {
        type: 'error',
        code: 'NOT_IN_SHARD',
        message: 'Not in a game session',
      });
      return;
    }

    this.shardManager.routeMessage(player.id, player, message);
  }

  private sendToPlayer(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  stop(): void {
    this.reconnectionManager.destroy();
    this.shardManager.destroyAll();

    if (this.wss) {
      this.wss.clients.forEach((client) => {
        client.close(1001, 'Server shutting down');
      });
      this.wss.close();
      this.wss = null;
    }

    console.log('[Gateway] Stopped');
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  getShardCount(): number {
    return this.shardManager.getActiveShardCount();
  }
}
