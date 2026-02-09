import { WebSocket } from 'ws';
import { TICK_INTERVAL, MAX_DIG_RATE } from '@shared/constants';
import {
  ClientMessage,
  ServerMessage,
  ConnectedPlayer,
} from '../types.js';

interface QueuedMessage {
  player: ConnectedPlayer;
  message: ClientMessage;
  receivedAt: number;
}

interface RateLimitEntry {
  digCount: number;
  windowStart: number;
}

export class GameLoop {
  private running = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private tickCount = 0;

  private messageQueue: QueuedMessage[] = [];
  private rateLimits = new Map<string, RateLimitEntry>();

  private players = new Map<string, ConnectedPlayer>();

  // Callbacks for shard-level processing
  private onProcessMessage: ((player: ConnectedPlayer, message: ClientMessage) => ServerMessage[] | null) | null = null;
  private onTick: ((tickCount: number, deltaMs: number) => void) | null = null;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.tickCount = 0;

    console.log(`[GameLoop] Started at ${1000 / TICK_INTERVAL}Hz (${TICK_INTERVAL}ms tick)`);

    this.tickTimer = setInterval(() => {
      this.tick();
    }, TICK_INTERVAL);
  }

  stop(): void {
    this.running = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.messageQueue = [];
    this.rateLimits.clear();
    console.log(`[GameLoop] Stopped after ${this.tickCount} ticks`);
  }

  addPlayer(player: ConnectedPlayer): void {
    this.players.set(player.id, player);
    this.rateLimits.set(player.id, { digCount: 0, windowStart: Date.now() });
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
    this.rateLimits.delete(playerId);
  }

  enqueue(player: ConnectedPlayer, message: ClientMessage): void {
    this.messageQueue.push({ player, message, receivedAt: Date.now() });
  }

  setMessageHandler(handler: (player: ConnectedPlayer, message: ClientMessage) => ServerMessage[] | null): void {
    this.onProcessMessage = handler;
  }

  setTickHandler(handler: (tickCount: number, deltaMs: number) => void): void {
    this.onTick = handler;
  }

  isRunning(): boolean {
    return this.running;
  }

  getTickCount(): number {
    return this.tickCount;
  }

  getPlayerCount(): number {
    return this.players.size;
  }

  private tick(): void {
    const tickStart = Date.now();
    this.tickCount++;

    // 1. Drain and process message queue
    const messages = this.messageQueue.splice(0);
    for (const queued of messages) {
      // Rate limit check for dig messages
      if (queued.message.type === 'dig') {
        if (!this.checkRateLimit(queued.player.id)) {
          this.sendToPlayer(queued.player, {
            type: 'error',
            code: 'RATE_LIMITED',
            message: 'Too many dig actions',
          });
          continue;
        }
      }

      // Process through handler
      if (this.onProcessMessage) {
        const responses = this.onProcessMessage(queued.player, queued.message);
        if (responses) {
          for (const response of responses) {
            this.sendToPlayer(queued.player, response);
          }
        }
      }
    }

    // 2. Tick callback for shard-level updates (gravity, events, etc.)
    if (this.onTick) {
      this.onTick(this.tickCount, TICK_INTERVAL);
    }

    // 3. Performance monitoring
    const tickDuration = Date.now() - tickStart;
    if (tickDuration > TICK_INTERVAL * 0.8) {
      console.warn(`[GameLoop] Tick ${this.tickCount} took ${tickDuration}ms (budget: ${TICK_INTERVAL}ms)`);
    }
  }

  private checkRateLimit(playerId: string): boolean {
    const now = Date.now();
    let entry = this.rateLimits.get(playerId);

    if (!entry) {
      entry = { digCount: 0, windowStart: now };
      this.rateLimits.set(playerId, entry);
    }

    // Reset window every second
    if (now - entry.windowStart >= 1000) {
      entry.digCount = 0;
      entry.windowStart = now;
    }

    entry.digCount++;
    return entry.digCount <= MAX_DIG_RATE;
  }

  sendToPlayer(player: ConnectedPlayer, message: ServerMessage): void {
    if (player.ws.readyState === WebSocket.OPEN) {
      player.ws.send(JSON.stringify(message));
    }
  }

  broadcast(message: ServerMessage, exclude?: string): void {
    const data = JSON.stringify(message);
    for (const [id, player] of this.players) {
      if (id === exclude) continue;
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }

  broadcastToAll(message: ServerMessage): void {
    const data = JSON.stringify(message);
    for (const [, player] of this.players) {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    }
  }
}
