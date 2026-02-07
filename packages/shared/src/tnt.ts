import { Position, Block, BlockType } from './types';
import {
  TNT_DESTROY_RADIUS,
  TNT_LAUNCH_DISTANCE,
  TNT_CHAIN_DELAY,
  TNT_CHAIN_EXTRA_LAUNCH,
  SAFE_SPAWN_BLOCKS
} from './constants';
import { getTntGoldPenalty } from './layers';

/**
 * Converts a position to a string key for map lookups.
 * @param pos - Position to convert
 * @returns String key in format "x,y"
 */
function positionToKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}

/**
 * Converts a string key back to a Position object.
 * @param key - String key in format "x,y"
 * @returns Position object
 */
function keyToPosition(key: string): Position {
  const parts = key.split(',');
  return {
    x: parseInt(parts[0], 10),
    y: parseInt(parts[1], 10)
  };
}

/**
 * Gets all block positions in the explosion radius around a center point.
 * With TNT_DESTROY_RADIUS = 1, this returns a 3x3 grid (9 positions).
 *
 * @param center - Center position of the explosion
 * @returns Array of all positions in the explosion zone
 */
export function getExplosionZone(center: Position): Position[] {
  const positions: Position[] = [];

  for (let dx = -TNT_DESTROY_RADIUS; dx <= TNT_DESTROY_RADIUS; dx++) {
    for (let dy = -TNT_DESTROY_RADIUS; dy <= TNT_DESTROY_RADIUS; dy++) {
      positions.push({
        x: center.x + dx,
        y: center.y + dy
      });
    }
  }

  return positions;
}

/**
 * Finds all TNT blocks within the explosion zone of a given center.
 * These TNT blocks will chain-react if not already destroyed.
 *
 * @param worldBlocks - Record of world blocks keyed by "x,y"
 * @param center - Center position to check around
 * @returns Array of positions containing TNT blocks
 */
export function findChainTNT(
  worldBlocks: Record<string, Block>,
  center: Position
): Position[] {
  const explosionZone = getExplosionZone(center);
  const tntPositions: Position[] = [];

  for (let i = 0; i < explosionZone.length; i++) {
    const pos = explosionZone[i];
    const key = positionToKey(pos);
    const block = worldBlocks[key];

    if (block && block.type === BlockType.TNT) {
      tntPositions.push(pos);
    }
  }

  return tntPositions;
}

/**
 * Calculates the full chain reaction from an initial TNT explosion.
 * Simulates all phases of the explosion, tracking destroyed blocks,
 * gold penalties, and launch distance.
 *
 * Process:
 * 1. Phase 0: Initial TNT explodes at delay 0
 * 2. Find all TNT in phase 0's blast zone
 * 3. Phase 1: Those TNTs explode at delay TNT_CHAIN_DELAY
 * 4. Continue until no more TNT is found
 *
 * Important: TNT blocks destroyed in earlier phases don't chain again,
 * preventing infinite loops.
 *
 * @param worldBlocks - Record of world blocks keyed by "x,y"
 * @param initialTnt - Position of the TNT that was mined/triggered
 * @returns Complete explosion simulation data
 */
export function calculateFullExplosion(
  worldBlocks: Record<string, Block>,
  initialTnt: Position
): {
  phases: { center: Position; destroyedBlocks: Position[]; delay: number }[];
  totalBlocksDestroyed: Position[];
  totalGoldPenalty: number;
  totalLaunchDistance: number;
  chainLength: number;
} {
  const phases: { center: Position; destroyedBlocks: Position[]; delay: number }[] = [];
  const allDestroyedKeys: Record<string, boolean> = {};
  const processedTntKeys: Record<string, boolean> = {};
  let totalGoldPenalty = 0;

  // Start with initial TNT
  let currentPhaseTnts: Position[] = [initialTnt];
  let phaseNumber = 0;

  while (currentPhaseTnts.length > 0) {
    const nextPhaseTnts: Position[] = [];

    // Process each TNT in the current phase
    for (let i = 0; i < currentPhaseTnts.length; i++) {
      const tntPos = currentPhaseTnts[i];
      const tntKey = positionToKey(tntPos);

      // Skip if this TNT was already processed (prevent infinite loops)
      if (processedTntKeys[tntKey]) {
        continue;
      }

      processedTntKeys[tntKey] = true;

      // Get all blocks in explosion zone
      const explosionZone = getExplosionZone(tntPos);
      const destroyedThisExplosion: Position[] = [];

      for (let j = 0; j < explosionZone.length; j++) {
        const pos = explosionZone[j];
        const key = positionToKey(pos);
        const block = worldBlocks[key];

        if (block) {
          // Mark as destroyed
          allDestroyedKeys[key] = true;
          destroyedThisExplosion.push(pos);

          // Check if this is a TNT that should chain
          if (block.type === BlockType.TNT) {
            const chainTntKey = positionToKey(pos);
            // Only chain if not already processed
            if (!processedTntKeys[chainTntKey]) {
              nextPhaseTnts.push(pos);
            }
          }
        }
      }

      // Calculate gold penalty for this specific TNT explosion
      totalGoldPenalty += getTntGoldPenalty(tntPos.y);

      // Record this explosion phase
      phases.push({
        center: tntPos,
        destroyedBlocks: destroyedThisExplosion,
        delay: phaseNumber * TNT_CHAIN_DELAY
      });
    }

    // Move to next phase
    currentPhaseTnts = nextPhaseTnts;
    phaseNumber++;
  }

  // Convert destroyed keys back to positions (deduplicated)
  const totalBlocksDestroyed: Position[] = [];
  const destroyedKeys = Object.keys(allDestroyedKeys);
  for (let i = 0; i < destroyedKeys.length; i++) {
    totalBlocksDestroyed.push(keyToPosition(destroyedKeys[i]));
  }

  // Calculate total launch distance
  // Base launch + extra per additional chain phase
  const chainLength = phases.length;
  const totalLaunchDistance =
    TNT_LAUNCH_DISTANCE + (chainLength - 1) * TNT_CHAIN_EXTRA_LAUNCH;

  return {
    phases,
    totalBlocksDestroyed,
    totalGoldPenalty,
    totalLaunchDistance,
    chainLength
  };
}

/**
 * Checks if a depth is in the safe spawn zone where TNT cannot spawn.
 * Safe zones include the first SAFE_SPAWN_BLOCKS from surface and checkpoints.
 *
 * @param depth - Y coordinate (depth) to check
 * @returns True if this depth is safe from TNT spawns
 */
export function isBlockSafeFromTnt(depth: number): boolean {
  return depth < SAFE_SPAWN_BLOCKS;
}

/**
 * Calculates the player's new position after being launched by TNT.
 * Player is launched upward by totalLaunchDistance blocks.
 *
 * @param currentPosition - Player's current position
 * @param launchDistance - How many blocks to launch upward
 * @returns New position after launch
 */
export function calculateLaunchPosition(
  currentPosition: Position,
  launchDistance: number
): Position {
  return {
    x: currentPosition.x,
    y: Math.max(0, currentPosition.y - launchDistance) // Can't go above surface (y=0)
  };
}

/**
 * Checks if a position is within the explosion zone of a TNT.
 *
 * @param position - Position to check
 * @param tntCenter - Center of TNT explosion
 * @returns True if position is in explosion zone
 */
export function isInExplosionZone(position: Position, tntCenter: Position): boolean {
  const dx = Math.abs(position.x - tntCenter.x);
  const dy = Math.abs(position.y - tntCenter.y);
  return dx <= TNT_DESTROY_RADIUS && dy <= TNT_DESTROY_RADIUS;
}

/**
 * Gets statistics about a chain explosion for display/logging.
 *
 * @param explosion - Result from calculateFullExplosion
 * @returns Human-readable summary
 */
export function getExplosionSummary(explosion: {
  phases: { center: Position; destroyedBlocks: Position[]; delay: number }[];
  totalBlocksDestroyed: Position[];
  totalGoldPenalty: number;
  totalLaunchDistance: number;
  chainLength: number;
}): string {
  const lines: string[] = [];
  lines.push(`TNT Chain Reaction:`);
  lines.push(`- Chain Length: ${explosion.chainLength} explosion(s)`);
  lines.push(`- Blocks Destroyed: ${explosion.totalBlocksDestroyed.length}`);
  lines.push(`- Gold Penalty: ${explosion.totalGoldPenalty}g`);
  lines.push(`- Launch Distance: ${explosion.totalLaunchDistance} blocks upward`);
  lines.push(`- Total Duration: ${(explosion.chainLength - 1) * TNT_CHAIN_DELAY}ms`);
  return lines.join('\n');
}
