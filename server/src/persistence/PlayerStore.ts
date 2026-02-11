import { PlayerState, EquipmentSlot, EquipmentTier, InventorySlot, ItemType, Position } from '@shared/types';

/**
 * Player persistence layer.
 * Abstracts database operations for player data.
 * In production uses Prisma/PostgreSQL; in dev can use in-memory store.
 */

interface StoredPlayer {
  id: string;
  displayName: string;
  gold: number;
  shovelTier: number;
  helmetTier: number;
  vestTier: number;
  torchTier: number;
  ropeTier: number;
  inventorySlots: number;
  inventoryLevel: number;
  maxDepthReached: number;
  totalBlocksMined: number;
  totalGoldEarned: number;
  totalExplosions: number;
  inventory: { slotIndex: number; itemType: string; quantity: number }[];
  checkpoints: { shardId: string; depth: number }[];
}

export class PlayerStore {
  // In-memory store for development (replace with Prisma in production)
  private players = new Map<string, StoredPlayer>();

  async createPlayer(id: string, displayName: string): Promise<PlayerState> {
    const stored: StoredPlayer = {
      id,
      displayName,
      gold: 0,
      shovelTier: 1,
      helmetTier: 1,
      vestTier: 1,
      torchTier: 1,
      ropeTier: 1,
      inventorySlots: 8,
      inventoryLevel: 0,
      maxDepthReached: 0,
      totalBlocksMined: 0,
      totalGoldEarned: 0,
      totalExplosions: 0,
      inventory: [],
      checkpoints: [],
    };

    this.players.set(id, stored);
    return this.storedToPlayerState(stored);
  }

  async loadPlayer(playerId: string): Promise<PlayerState | null> {
    const stored = this.players.get(playerId);
    if (!stored) return null;
    return this.storedToPlayerState(stored);
  }

  async savePlayer(state: PlayerState): Promise<void> {
    const stored: StoredPlayer = {
      id: state.id,
      displayName: '',
      gold: state.gold,
      shovelTier: state.equipment[EquipmentSlot.SHOVEL],
      helmetTier: state.equipment[EquipmentSlot.HELMET],
      vestTier: state.equipment[EquipmentSlot.VEST],
      torchTier: state.equipment[EquipmentSlot.TORCH],
      ropeTier: state.equipment[EquipmentSlot.ROPE],
      inventorySlots: state.maxInventorySlots,
      inventoryLevel: state.inventoryUpgradeLevel,
      maxDepthReached: state.maxDepthReached,
      totalBlocksMined: 0,
      totalGoldEarned: 0,
      totalExplosions: 0,
      inventory: state.inventory
        .map((slot, index) => slot ? { slotIndex: index, itemType: slot.itemType as string, quantity: slot.quantity } : null)
        .filter((s): s is { slotIndex: number; itemType: string; quantity: number } => s !== null),
      checkpoints: state.checkpoints.map(depth => ({ shardId: 'default', depth })),
    };

    // Preserve existing display name
    const existing = this.players.get(state.id);
    if (existing) {
      stored.displayName = existing.displayName;
      stored.totalBlocksMined = existing.totalBlocksMined;
      stored.totalGoldEarned = existing.totalGoldEarned;
      stored.totalExplosions = existing.totalExplosions;
    }

    this.players.set(state.id, stored);
  }

  async updateGold(playerId: string, newGold: number): Promise<void> {
    const stored = this.players.get(playerId);
    if (stored) {
      stored.gold = newGold;
    }
  }

  async updateEquipment(playerId: string, slot: EquipmentSlot, tier: number): Promise<void> {
    const stored = this.players.get(playerId);
    if (!stored) return;

    switch (slot) {
      case EquipmentSlot.SHOVEL: stored.shovelTier = tier; break;
      case EquipmentSlot.HELMET: stored.helmetTier = tier; break;
      case EquipmentSlot.VEST: stored.vestTier = tier; break;
      case EquipmentSlot.TORCH: stored.torchTier = tier; break;
      case EquipmentSlot.ROPE: stored.ropeTier = tier; break;
    }
  }

  async incrementStats(playerId: string, stats: {
    blocksMined?: number;
    goldEarned?: number;
    explosions?: number;
  }): Promise<void> {
    const stored = this.players.get(playerId);
    if (!stored) return;

    if (stats.blocksMined) stored.totalBlocksMined += stats.blocksMined;
    if (stats.goldEarned) stored.totalGoldEarned += stats.goldEarned;
    if (stats.explosions) stored.totalExplosions += stats.explosions;
  }

  async updateMaxDepth(playerId: string, depth: number): Promise<void> {
    const stored = this.players.get(playerId);
    if (stored && depth > stored.maxDepthReached) {
      stored.maxDepthReached = depth;
    }
  }

  async playerExists(playerId: string): Promise<boolean> {
    return this.players.has(playerId);
  }

  private storedToPlayerState(stored: StoredPlayer): PlayerState {
    // Build inventory array with nulls for empty slots
    const inventory: (InventorySlot | null)[] = new Array(stored.inventorySlots).fill(null);
    for (const item of stored.inventory) {
      if (item.slotIndex < inventory.length) {
        inventory[item.slotIndex] = {
          itemType: item.itemType as PlayerState['inventory'][0] extends infer T ? T extends null ? never : T extends InventorySlot ? T['itemType'] : never : never,
          quantity: item.quantity,
        } as InventorySlot;
      }
    }

    return {
      id: stored.id,
      position: { x: 10, y: 0 },
      gold: stored.gold,
      equipment: {
        [EquipmentSlot.SHOVEL]: stored.shovelTier as EquipmentTier,
        [EquipmentSlot.HELMET]: stored.helmetTier as EquipmentTier,
        [EquipmentSlot.VEST]: stored.vestTier as EquipmentTier,
        [EquipmentSlot.TORCH]: stored.torchTier as EquipmentTier,
        [EquipmentSlot.ROPE]: stored.ropeTier as EquipmentTier,
      },
      inventory,
      maxInventorySlots: stored.inventorySlots,
      inventoryUpgradeLevel: stored.inventoryLevel,
      maxDepthReached: stored.maxDepthReached,
      checkpoints: stored.checkpoints.map(c => c.depth),
      isStunned: false,
      stunEndTime: null,
      isOnSurface: true,
      lives: 2,
    };
  }
}
