import { Block, BlockType, ChunkData } from './types';
import { CHUNK_WIDTH, CHUNK_HEIGHT, SAFE_SPAWN_BLOCKS } from './constants';
import { getLayerAtDepth, getBlockHardness } from './layers';

/**
 * 32-bit integer multiplication (polyfill for Math.imul for ES5 compatibility).
 * @param a - First operand
 * @param b - Second operand
 * @returns 32-bit multiplication result
 */
function imul(a: number, b: number): number {
  const aHi = (a >>> 16) & 0xffff;
  const aLo = a & 0xffff;
  const bHi = (b >>> 16) & 0xffff;
  const bLo = b & 0xffff;
  return ((aLo * bLo) + (((aHi * bLo + aLo * bHi) << 16) >>> 0) | 0);
}

/**
 * Creates a deterministic pseudo-random number generator using the Mulberry32 algorithm.
 * This PRNG is fast, simple, and produces high-quality random numbers.
 * The same seed will always produce the same sequence of numbers.
 *
 * @param seed - Integer seed value for the generator
 * @returns Function that returns pseudo-random numbers in range [0, 1)
 */
export function createRNG(seed: number): () => number {
  let state = seed;
  return () => {
    // Mulberry32 algorithm
    state = (state + 0x6D2B79F5) | 0;
    let t = imul(state ^ (state >>> 15), 1 | state);
    t = (t + imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a deterministic chunk seed from world seed and chunk Y coordinate.
 * Uses a simple but effective integer hash function.
 *
 * @param worldSeed - The global world seed
 * @param chunkY - Vertical chunk index
 * @returns Hashed seed value for this specific chunk
 */
function hashChunkSeed(worldSeed: number, chunkY: number): number {
  let hash = worldSeed;
  // Mix in chunkY using bit shifts and addition
  hash = ((hash << 5) - hash + chunkY) | 0;
  hash = ((hash << 5) - hash + chunkY) | 0;
  // Ensure positive 32-bit integer
  return hash >>> 0;
}

/**
 * Gets the default block type for a layer (excluding TNT).
 * Filters out TNT from the layer's block types to get the base terrain block.
 *
 * @param blockTypes - Array of block types from layer definition
 * @returns The primary non-TNT block type for this layer
 */
function getDefaultBlockType(blockTypes: BlockType[]): BlockType {
  for (const blockType of blockTypes) {
    if (blockType !== BlockType.TNT) {
      return blockType;
    }
  }
  // Fallback to first block type if somehow all are TNT
  return blockTypes[0];
}

/**
 * Generates a complete chunk of terrain deterministically.
 * The same worldSeed and chunkY will always produce identical chunks.
 *
 * Process:
 * 1. Hash worldSeed + chunkY to get unique chunk seed
 * 2. Create RNG from chunk seed
 * 3. Generate each block in the chunk (CHUNK_WIDTH × CHUNK_HEIGHT)
 * 4. For each block:
 *    - Calculate actual world depth (y-coordinate)
 *    - Get layer properties at that depth
 *    - Set default block type from layer
 *    - Roll for TNT placement (if not in safe spawn zone)
 *    - Set block HP based on layer hardness
 *
 * @param worldSeed - Global world seed
 * @param chunkY - Vertical chunk index (0 = surface chunks)
 * @returns ChunkData containing all blocks in this chunk
 */
export function generateChunk(worldSeed: number, chunkY: number): ChunkData {
  const chunkSeed = hashChunkSeed(worldSeed, chunkY);
  const rng = createRNG(chunkSeed);

  const blocks: Block[][] = [];

  // Generate blocks column by column (x, then y)
  for (let x = 0; x < CHUNK_WIDTH; x++) {
    blocks[x] = [];
    for (let localY = 0; localY < CHUNK_HEIGHT; localY++) {
      // Calculate absolute world depth
      const depth = chunkY * CHUNK_HEIGHT + localY;

      // Get layer properties for this depth
      const layer = getLayerAtDepth(depth);

      // Start with default block type for this layer
      let blockType = getDefaultBlockType(layer.blockTypes);

      // Roll for TNT placement (only outside safe spawn zone)
      if (depth >= SAFE_SPAWN_BLOCKS) {
        if (rng() < layer.tntSpawnChance) {
          blockType = BlockType.TNT;
        }
      }

      // Calculate block hardness (includes VOID_STONE scaling)
      const hardness = getBlockHardness(depth);

      blocks[x][localY] = {
        type: blockType,
        hp: hardness,
        maxHp: hardness,
        x: x,
        y: depth
      };
    }
  }

  return {
    chunkY,
    blocks,
    seed: chunkSeed
  };
}

/**
 * Generates a single block at specific world coordinates without generating the full chunk.
 * Optimization for single-block lookups (e.g., player interactions, sparse queries).
 *
 * This is deterministic - the same coordinates always produce the same block,
 * matching what would be in the full chunk if it were generated.
 *
 * Implementation:
 * 1. Calculate which chunk contains this block
 * 2. Generate chunk seed
 * 3. Create RNG and advance it to the correct position for this block
 * 4. Generate the block using the same logic as generateChunk
 *
 * @param worldSeed - Global world seed
 * @param x - Horizontal block coordinate
 * @param y - Vertical block coordinate (depth)
 * @returns The block at this position
 */
export function getBlockAt(worldSeed: number, x: number, y: number): Block {
  // Determine which chunk contains this block
  const chunkY = Math.floor(y / CHUNK_HEIGHT);
  const localY = y % CHUNK_HEIGHT;
  const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH; // Handle negative x

  // Generate deterministic seed for this chunk
  const chunkSeed = hashChunkSeed(worldSeed, chunkY);
  const rng = createRNG(chunkSeed);

  // Advance RNG to the correct position
  // Blocks are generated in order: x0y0, x0y1, ..., x0y31, x1y0, x1y1, ...
  const blockIndex = localX * CHUNK_HEIGHT + localY;
  for (let i = 0; i < blockIndex; i++) {
    rng(); // Skip previous blocks to maintain determinism
  }

  // Get layer properties
  const depth = y;
  const layer = getLayerAtDepth(depth);

  // Determine block type
  let blockType = getDefaultBlockType(layer.blockTypes);

  // Roll for TNT (same logic as chunk generation)
  if (depth >= SAFE_SPAWN_BLOCKS) {
    if (rng() < layer.tntSpawnChance) {
      blockType = BlockType.TNT;
    }
  }

  // Calculate hardness
  const hardness = getBlockHardness(depth);

  return {
    type: blockType,
    hp: hardness,
    maxHp: hardness,
    x: x,
    y: depth
  };
}

/**
 * Validates that world generation is deterministic by generating the same chunk twice.
 * Useful for testing and debugging.
 *
 * @param worldSeed - Seed to test
 * @param chunkY - Chunk to test
 * @returns True if both generations match exactly
 */
export function validateDeterminism(worldSeed: number, chunkY: number): boolean {
  const chunk1 = generateChunk(worldSeed, chunkY);
  const chunk2 = generateChunk(worldSeed, chunkY);

  // Check if chunks are identical
  for (let x = 0; x < CHUNK_WIDTH; x++) {
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      const b1 = chunk1.blocks[x][y];
      const b2 = chunk2.blocks[x][y];
      if (
        b1.type !== b2.type ||
        b1.hp !== b2.hp ||
        b1.maxHp !== b2.maxHp ||
        b1.x !== b2.x ||
        b1.y !== b2.y
      ) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Gets the chunk Y index for a given world Y coordinate.
 * Useful for determining which chunk to load/generate.
 *
 * @param y - World Y coordinate (depth)
 * @returns Chunk Y index
 */
export function getChunkYForDepth(y: number): number {
  return Math.floor(y / CHUNK_HEIGHT);
}

/**
 * Converts world coordinates to local chunk coordinates.
 *
 * @param x - World X coordinate
 * @param y - World Y coordinate
 * @returns Object with chunkY, localX, and localY
 */
export function worldToChunkCoords(x: number, y: number): {
  chunkY: number;
  localX: number;
  localY: number;
} {
  return {
    chunkY: Math.floor(y / CHUNK_HEIGHT),
    localX: ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH,
    localY: y % CHUNK_HEIGHT
  };
}
