import { WebSocket } from 'ws';
import { randomBytes } from 'crypto';
import { WorldManager } from './shard/WorldManager.js';
import { CHUNK_WIDTH, BASE_INVENTORY_SLOTS } from '@shared/constants';
import { DropItem, EquipmentSlot, InventorySlot } from '@shared/types';
import { createInventory } from '@shared/inventory';

export interface MatchPlayer {
  id: string;
  displayName: string;
  ws: WebSocket;
  x: number;
  y: number;
  gold: number;
  lives: number;
  items: { itemType: string; quantity: number }[];
  equipment: Record<string, number>;
  inventory: (InventorySlot | null)[];
  inventoryUpgradeLevel: number;
}

export interface Match {
  id: string;
  name: string;
  seed: number;
  worldManager: WorldManager;
  players: Map<string, MatchPlayer>;
  maxPlayers: number;
  createdAt: number;
  droppedItems: Map<string, DropItem>;
  destroyedBlocks: Set<string>;
}

export class MatchManager {
  private matches = new Map<string, Match>();
  private playerToMatch = new Map<string, string>();

  createMatch(name: string, maxPlayers = 8): Match {
    // H10: Use crypto.randomBytes instead of Math.random for IDs and seeds
    const id = randomBytes(4).toString('hex').toUpperCase();
    const seed = randomBytes(4).readUInt32BE(0);
    const match: Match = {
      id,
      name,
      seed,
      worldManager: new WorldManager(seed),
      players: new Map(),
      maxPlayers,
      createdAt: Date.now(),
      droppedItems: new Map(),
      destroyedBlocks: new Set(),
    };
    this.matches.set(id, match);
    console.log(`[Match] Created "${name}" (${id}) seed=${seed}`);
    return match;
  }

  joinMatch(matchId: string, playerId: string, displayName: string, ws: WebSocket): { match: Match; spawnX: number } | null {
    const match = this.matches.get(matchId);
    if (!match) return null;
    if (match.players.size >= match.maxPlayers) return null;

    const spawnX = Math.floor(Math.random() * CHUNK_WIDTH);
    const player: MatchPlayer = {
      id: playerId,
      displayName,
      ws,
      x: spawnX,
      y: 1,
      gold: 0,
      lives: 2,
      items: [],
      equipment: {
        [EquipmentSlot.SHOVEL]: 1,
        [EquipmentSlot.HELMET]: 1,
        [EquipmentSlot.VEST]: 1,
        [EquipmentSlot.TORCH]: 1,
        [EquipmentSlot.ROPE]: 1,
      },
      inventory: createInventory(BASE_INVENTORY_SLOTS),
      inventoryUpgradeLevel: 0,
    };

    match.players.set(playerId, player);
    this.playerToMatch.set(playerId, matchId);
    console.log(`[Match] ${displayName} joined "${match.name}" at x=${spawnX} (${match.players.size}/${match.maxPlayers})`);
    return { match, spawnX };
  }

  leaveMatch(playerId: string): { match: Match; displayName: string } | null {
    const matchId = this.playerToMatch.get(playerId);
    if (!matchId) return null;

    const match = this.matches.get(matchId);
    if (!match) return null;

    const player = match.players.get(playerId);
    const displayName = player?.displayName ?? 'Unknown';
    match.players.delete(playerId);
    this.playerToMatch.delete(playerId);

    console.log(`[Match] ${displayName} left "${match.name}" (${match.players.size} remaining)`);

    // Clean up empty matches
    if (match.players.size === 0) {
      match.worldManager.destroy();
      this.matches.delete(matchId);
      console.log(`[Match] Destroyed empty match "${match.name}" (${matchId})`);
    }

    return { match, displayName };
  }

  getPlayerMatch(playerId: string): Match | null {
    const matchId = this.playerToMatch.get(playerId);
    if (!matchId) return null;
    return this.matches.get(matchId) ?? null;
  }

  listMatches(): { matchId: string; matchName: string; playerCount: number; maxPlayers: number }[] {
    const list: { matchId: string; matchName: string; playerCount: number; maxPlayers: number }[] = [];
    for (const [, match] of this.matches) {
      if (match.players.size < match.maxPlayers) {
        list.push({
          matchId: match.id,
          matchName: match.name,
          playerCount: match.players.size,
          maxPlayers: match.maxPlayers,
        });
      }
    }
    return list;
  }

  findQuickPlayMatch(): Match | null {
    // Find the match with the most players that isn't full
    let best: Match | null = null;
    for (const [, match] of this.matches) {
      if (match.players.size < match.maxPlayers) {
        if (!best || match.players.size > best.players.size) {
          best = match;
        }
      }
    }
    return best;
  }

  getAllMatches(): Map<string, Match> {
    return this.matches;
  }

  broadcastToMatch(matchId: string, excludeId: string, msg: object): void {
    const match = this.matches.get(matchId);
    if (!match) return;
    const data = JSON.stringify(msg);
    for (const [id, p] of match.players) {
      if (id === excludeId) continue;
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(data);
      }
    }
  }

  broadcastToAllInMatch(matchId: string, msg: object): void {
    const match = this.matches.get(matchId);
    if (!match) return;
    const data = JSON.stringify(msg);
    for (const [, p] of match.players) {
      if (p.ws.readyState === WebSocket.OPEN) {
        p.ws.send(data);
      }
    }
  }

  getDestroyedBlocksForMatch(matchId: string): { x: number; y: number }[] {
    const match = this.matches.get(matchId);
    if (!match) return [];
    return [...match.destroyedBlocks].map(key => {
      const [x, y] = key.split(',').map(Number);
      return { x, y };
    });
  }

  syncPlayerItems(mp: MatchPlayer): void {
    mp.items = mp.inventory
      .filter((s): s is InventorySlot => s !== null)
      .map(s => ({ itemType: s.itemType, quantity: s.quantity }));
  }
}
