import { BlockType, EquipmentTier, Position } from '@shared/types';
import { getTorchRadius } from '@shared/equipment';
import { RevealBlockMessage } from '../types.js';
import { WorldManager } from './WorldManager.js';

interface PlayerVisibility {
  playerId: string;
  lastPosition: Position;
  torchTier: EquipmentTier;
  revealedTntPositions: Set<string>;
}

/**
 * TNT Fog of War manager.
 * The server NEVER sends TNT block type to clients outside their torch radius.
 * Blocks outside radius are sent as UNKNOWN.
 * When a player moves and new blocks enter their torch radius,
 * the server sends reveal_block with the true type.
 */
export class FogOfWar {
  private worldManager: WorldManager;
  private players = new Map<string, PlayerVisibility>();

  constructor(worldManager: WorldManager) {
    this.worldManager = worldManager;
  }

  addPlayer(playerId: string, position: Position, torchTier: EquipmentTier): void {
    this.players.set(playerId, {
      playerId,
      lastPosition: { ...position },
      torchTier,
      revealedTntPositions: new Set(),
    });
  }

  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  updateTorchTier(playerId: string, torchTier: EquipmentTier): void {
    const pv = this.players.get(playerId);
    if (pv) pv.torchTier = torchTier;
  }

  /**
   * Called when a player moves. Returns reveal messages for any TNT blocks
   * that just entered their torch radius.
   */
  onPlayerMove(playerId: string, newPosition: Position): RevealBlockMessage[] {
    const pv = this.players.get(playerId);
    if (!pv) return [];

    const reveals: RevealBlockMessage[] = [];
    const torchRadius = getTorchRadius(pv.torchTier);
    const oldPos = pv.lastPosition;

    // Scan blocks in new torch radius
    const minX = Math.floor(newPosition.x - torchRadius);
    const maxX = Math.ceil(newPosition.x + torchRadius);
    const minY = Math.floor(newPosition.y - torchRadius);
    const maxY = Math.ceil(newPosition.y + torchRadius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (y < 0) continue;

        const newDist = Math.sqrt((x - newPosition.x) ** 2 + (y - newPosition.y) ** 2);
        if (newDist > torchRadius) continue;

        const key = `${x},${y}`;

        // Skip if already revealed
        if (pv.revealedTntPositions.has(key)) continue;

        // Was this outside the previous torch radius?
        const oldDist = Math.sqrt((x - oldPos.x) ** 2 + (y - oldPos.y) ** 2);
        if (oldDist <= torchRadius) continue;

        // New block entering torch radius — check if it's TNT
        const block = this.worldManager.getBlock(x, y);
        if (block && block.type === BlockType.TNT) {
          pv.revealedTntPositions.add(key);
          reveals.push({
            type: 'reveal_block',
            x,
            y,
            blockType: BlockType.TNT,
            hp: block.hp,
            maxHp: block.maxHp,
          });
        }
      }
    }

    pv.lastPosition = { ...newPosition };
    return reveals;
  }

  /**
   * Mask a block type for sending to a specific player.
   * TNT blocks outside torch radius are sent as UNKNOWN.
   */
  maskBlockType(
    playerId: string,
    blockX: number,
    blockY: number,
    actualType: BlockType
  ): BlockType {
    if (actualType !== BlockType.TNT) return actualType;

    const pv = this.players.get(playerId);
    if (!pv) return BlockType.UNKNOWN;

    const torchRadius = getTorchRadius(pv.torchTier);
    const dist = Math.sqrt(
      (blockX - pv.lastPosition.x) ** 2 +
      (blockY - pv.lastPosition.y) ** 2
    );

    return dist <= torchRadius ? BlockType.TNT : BlockType.UNKNOWN;
  }

  /**
   * Get all initial reveals for a player at their current position.
   * Used when player first joins or teleports.
   */
  getInitialReveals(playerId: string): RevealBlockMessage[] {
    const pv = this.players.get(playerId);
    if (!pv) return [];

    const reveals: RevealBlockMessage[] = [];
    const torchRadius = getTorchRadius(pv.torchTier);
    const pos = pv.lastPosition;

    const minX = Math.floor(pos.x - torchRadius);
    const maxX = Math.ceil(pos.x + torchRadius);
    const minY = Math.floor(pos.y - torchRadius);
    const maxY = Math.ceil(pos.y + torchRadius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (y < 0) continue;

        const dist = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
        if (dist > torchRadius) continue;

        const block = this.worldManager.getBlock(x, y);
        if (block && block.type === BlockType.TNT) {
          const key = `${x},${y}`;
          pv.revealedTntPositions.add(key);
          reveals.push({
            type: 'reveal_block',
            x,
            y,
            blockType: BlockType.TNT,
            hp: block.hp,
            maxHp: block.maxHp,
          });
        }
      }
    }

    return reveals;
  }

  destroy(): void {
    this.players.clear();
  }
}
