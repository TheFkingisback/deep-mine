import { BlockType, PlayerState, EquipmentTier } from '@shared/types';
import { getShovelDamage, getMaxDepth } from '@shared/equipment';
import { STUN_DURATION } from '@shared/constants';
import { calculateFullExplosion, calculateLaunchPosition, getExplosionZone } from '@shared/tnt';
import { rollLootDrop } from '@shared/layers';
import { createRNG } from '@shared/world-gen';
import {
  ServerMessage,
  BlockUpdateMessage,
  BlockDestroyedMessage,
  ExplosionMessage,
} from '../types.js';
import { WorldManager } from './WorldManager.js';

export interface DigResult {
  valid: boolean;
  error?: string;
  messages: ServerMessage[];
  broadcastMessages: ServerMessage[];
  destroyed: boolean;
  wasTnt: boolean;
}

export class DigValidator {
  private worldManager: WorldManager;
  private lootRng: () => number;

  constructor(worldManager: WorldManager) {
    this.worldManager = worldManager;
    this.lootRng = createRNG(worldManager.getSeed() + 777);
  }

  validateAndProcessDig(
    player: PlayerState,
    targetX: number,
    targetY: number
  ): DigResult {
    const result: DigResult = {
      valid: false,
      messages: [],
      broadcastMessages: [],
      destroyed: false,
      wasTnt: false,
    };

    // 1. Check if player is stunned
    if (player.isStunned && player.stunEndTime !== null && player.stunEndTime > Date.now()) {
      result.error = 'STUNNED';
      return result;
    }

    // 2. Check adjacency (block must be within 1 block of player)
    const dx = Math.abs(targetX - player.position.x);
    const dy = Math.abs(targetY - player.position.y);
    if (dx > 1 || dy > 1) {
      result.error = 'NOT_ADJACENT';
      return result;
    }

    // 3. Check depth limit based on helmet tier
    const maxDepth = getMaxDepth(player.equipment.helmet as EquipmentTier);
    if (targetY > maxDepth) {
      result.error = 'DEPTH_LIMIT';
      return result;
    }

    // 4. Get the block
    const block = this.worldManager.getBlock(targetX, targetY);
    if (!block || block.type === BlockType.EMPTY) {
      result.error = 'NO_BLOCK';
      return result;
    }

    // 5. Calculate damage
    const damage = getShovelDamage(player.equipment.shovel as EquipmentTier);

    // 6. Check if it's TNT
    if (block.type === BlockType.TNT) {
      return this.processTntExplosion(player, targetX, targetY);
    }

    // 7. Apply damage
    const { destroyed, remainingHp } = this.worldManager.damageBlock(targetX, targetY, damage);
    result.valid = true;
    result.destroyed = destroyed;

    if (destroyed) {
      // Roll loot
      const itemType = rollLootDrop(targetY, this.lootRng);
      const drop = itemType ? {
        itemId: `drop_${Date.now()}_${targetX}_${targetY}`,
        itemType,
        position: { x: targetX, y: targetY },
      } : null;

      const destroyedMsg: BlockDestroyedMessage = {
        type: 'block_destroyed',
        x: targetX,
        y: targetY,
        actor: player.id,
        drop,
      };
      result.broadcastMessages.push(destroyedMsg);
    } else {
      const updateMsg: BlockUpdateMessage = {
        type: 'block_update',
        x: targetX,
        y: targetY,
        newHp: remainingHp,
        destroyed: false,
        actor: player.id,
      };
      result.broadcastMessages.push(updateMsg);
    }

    return result;
  }

  private processTntExplosion(
    player: PlayerState,
    tntX: number,
    tntY: number
  ): DigResult {
    const result: DigResult = {
      valid: true,
      messages: [],
      broadcastMessages: [],
      destroyed: true,
      wasTnt: true,
    };

    // Build a world blocks record for the tnt module
    const explosionZone = getExplosionZone({ x: tntX, y: tntY });
    const worldBlocks: Record<string, { type: BlockType; hp: number; maxHp: number; x: number; y: number }> = {};

    // Load blocks in a wider area to catch chains
    const scanRadius = 5;
    for (let dx = -scanRadius; dx <= scanRadius; dx++) {
      for (let dy = -scanRadius; dy <= scanRadius; dy++) {
        const bx = tntX + dx;
        const by = tntY + dy;
        const block = this.worldManager.getBlock(bx, by);
        if (block) {
          worldBlocks[`${bx},${by}`] = block;
        }
      }
    }

    const explosion = calculateFullExplosion(worldBlocks, { x: tntX, y: tntY });

    // Destroy all blocks in the explosion
    for (const pos of explosion.totalBlocksDestroyed) {
      this.worldManager.destroyBlock(pos.x, pos.y);
    }

    // Calculate player launch position
    const launchPos = calculateLaunchPosition(player.position, explosion.totalLaunchDistance);

    // Build chain info for client
    const chain = explosion.phases.slice(1).map(phase => ({
      center: phase.center,
      delayMs: phase.delay,
    }));

    const explosionMsg: ExplosionMessage = {
      type: 'explosion',
      center: { x: tntX, y: tntY },
      radius: 1,
      destroyedBlocks: explosion.totalBlocksDestroyed,
      chain,
      goldPenalty: explosion.totalGoldPenalty,
      affectedPlayer: player.id,
      playerLaunchToY: launchPos.y,
    };

    result.broadcastMessages.push(explosionMsg);

    return result;
  }
}
