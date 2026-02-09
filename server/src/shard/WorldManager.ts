import { Block, BlockType, ChunkData } from '@shared/types';
import { CHUNK_WIDTH, CHUNK_HEIGHT } from '@shared/constants';
import { generateChunk, getChunkYForDepth } from '@shared/world-gen';
import { getTorchRadius } from '@shared/equipment';
import { WorldChunkMessage, RevealBlockMessage } from '../types.js';
import type { EquipmentTier } from '@shared/types';

interface ChunkModification {
  x: number;
  y: number;
  newType: BlockType;
  newHp: number;
}

interface LoadedChunk {
  data: ChunkData;
  modifications: ChunkModification[];
  dirty: boolean;
  lastAccessed: number;
}

export class WorldManager {
  private worldSeed: number;
  private chunks = new Map<number, LoadedChunk>();
  private maxCachedChunks = 100;

  constructor(worldSeed?: number) {
    this.worldSeed = worldSeed ?? Math.floor(Math.random() * 0xFFFFFFFF);
    console.log(`[WorldManager] Initialized with seed ${this.worldSeed}`);
  }

  getSeed(): number {
    return this.worldSeed;
  }

  getBlock(x: number, y: number): Block | null {
    const chunkY = getChunkYForDepth(y);
    const chunk = this.getOrGenerateChunk(chunkY);
    const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localY = y - chunkY * CHUNK_HEIGHT;

    if (localX < 0 || localX >= CHUNK_WIDTH || localY < 0 || localY >= CHUNK_HEIGHT) {
      return null;
    }

    return chunk.data.blocks[localX][localY];
  }

  setBlock(x: number, y: number, type: BlockType, hp: number): void {
    const chunkY = getChunkYForDepth(y);
    const chunk = this.getOrGenerateChunk(chunkY);
    const localX = ((x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
    const localY = y - chunkY * CHUNK_HEIGHT;

    if (localX < 0 || localX >= CHUNK_WIDTH || localY < 0 || localY >= CHUNK_HEIGHT) {
      return;
    }

    const block = chunk.data.blocks[localX][localY];
    block.type = type;
    block.hp = hp;

    chunk.modifications.push({ x, y, newType: type, newHp: hp });
    chunk.dirty = true;
  }

  damageBlock(x: number, y: number, damage: number): { destroyed: boolean; remainingHp: number } {
    const block = this.getBlock(x, y);
    if (!block || block.type === BlockType.EMPTY) {
      return { destroyed: false, remainingHp: 0 };
    }

    block.hp -= damage;

    if (block.hp <= 0) {
      const chunkY = getChunkYForDepth(y);
      const chunk = this.chunks.get(chunkY);
      if (chunk) {
        chunk.modifications.push({ x, y, newType: BlockType.EMPTY, newHp: 0 });
        chunk.dirty = true;
      }
      block.type = BlockType.EMPTY;
      block.hp = 0;
      return { destroyed: true, remainingHp: 0 };
    }

    const chunkY = getChunkYForDepth(y);
    const chunk = this.chunks.get(chunkY);
    if (chunk) {
      chunk.modifications.push({ x, y, newType: block.type, newHp: block.hp });
      chunk.dirty = true;
    }

    return { destroyed: false, remainingHp: block.hp };
  }

  destroyBlock(x: number, y: number): void {
    this.setBlock(x, y, BlockType.EMPTY, 0);
  }

  /**
   * Get chunk data formatted for sending to a client.
   * Applies TNT fog of war: blocks outside torch radius are sent as UNKNOWN.
   */
  getChunkForClient(
    chunkY: number,
    playerX: number,
    playerY: number,
    torchTier: EquipmentTier
  ): WorldChunkMessage {
    const chunk = this.getOrGenerateChunk(chunkY);
    const torchRadius = getTorchRadius(torchTier);
    const blocks: WorldChunkMessage['blocks'] = [];

    for (let x = 0; x < CHUNK_WIDTH; x++) {
      for (let localY = 0; localY < CHUNK_HEIGHT; localY++) {
        const block = chunk.data.blocks[x][localY];
        if (block.type === BlockType.EMPTY) continue;

        const worldY = chunkY * CHUNK_HEIGHT + localY;
        const dx = x - playerX;
        const dy = worldY - playerY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= torchRadius) {
          // Within torch radius: send true block type
          blocks.push({
            x: block.x,
            y: block.y,
            blockType: block.type,
            hp: block.hp,
            maxHp: block.maxHp,
          });
        } else {
          // Outside torch radius: mask TNT as UNKNOWN
          blocks.push({
            x: block.x,
            y: block.y,
            blockType: block.type === BlockType.TNT ? BlockType.UNKNOWN : block.type,
            hp: block.hp,
            maxHp: block.maxHp,
          });
        }
      }
    }

    return { type: 'world_chunk', chunkY, blocks };
  }

  /**
   * Get blocks that should be revealed as a player moves.
   * Returns reveal messages for blocks entering torch radius that were previously masked.
   */
  getRevealedBlocks(
    playerX: number,
    playerY: number,
    torchTier: EquipmentTier,
    prevPlayerX: number,
    prevPlayerY: number
  ): RevealBlockMessage[] {
    const torchRadius = getTorchRadius(torchTier);
    const reveals: RevealBlockMessage[] = [];

    // Check blocks in the torch radius around the new position
    const minX = Math.floor(playerX - torchRadius);
    const maxX = Math.ceil(playerX + torchRadius);
    const minY = Math.floor(playerY - torchRadius);
    const maxY = Math.ceil(playerY + torchRadius);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const newDist = Math.sqrt((x - playerX) ** 2 + (y - playerY) ** 2);
        if (newDist > torchRadius) continue;

        // Was this block outside the previous torch radius?
        const oldDist = Math.sqrt((x - prevPlayerX) ** 2 + (y - prevPlayerY) ** 2);
        if (oldDist <= torchRadius) continue;

        // This block just entered torch radius
        const block = this.getBlock(x, y);
        if (block && block.type === BlockType.TNT) {
          reveals.push({
            type: 'reveal_block',
            x: block.x,
            y: block.y,
            blockType: block.type,
            hp: block.hp,
            maxHp: block.maxHp,
          });
        }
      }
    }

    return reveals;
  }

  /**
   * Get chunks that overlap a viewport range.
   */
  getChunksForRange(startY: number, endY: number): number[] {
    const startChunk = getChunkYForDepth(Math.max(0, startY));
    const endChunk = getChunkYForDepth(endY);
    const chunkYs: number[] = [];
    for (let cy = startChunk; cy <= endChunk; cy++) {
      chunkYs.push(cy);
    }
    return chunkYs;
  }

  /**
   * Get dirty chunks that need to be persisted.
   */
  getDirtyChunks(): { chunkY: number; modifications: ChunkModification[] }[] {
    const dirty: { chunkY: number; modifications: ChunkModification[] }[] = [];
    for (const [chunkY, chunk] of this.chunks) {
      if (chunk.dirty) {
        dirty.push({ chunkY, modifications: [...chunk.modifications] });
      }
    }
    return dirty;
  }

  /**
   * Mark chunks as saved (no longer dirty).
   */
  markChunksSaved(chunkYs: number[]): void {
    for (const cy of chunkYs) {
      const chunk = this.chunks.get(cy);
      if (chunk) {
        chunk.dirty = false;
      }
    }
  }

  /**
   * Apply previously persisted modifications to a chunk.
   */
  applyModifications(chunkY: number, modifications: ChunkModification[]): void {
    const chunk = this.getOrGenerateChunk(chunkY);
    for (const mod of modifications) {
      const localX = ((mod.x % CHUNK_WIDTH) + CHUNK_WIDTH) % CHUNK_WIDTH;
      const localY = mod.y - chunkY * CHUNK_HEIGHT;
      if (localX >= 0 && localX < CHUNK_WIDTH && localY >= 0 && localY < CHUNK_HEIGHT) {
        chunk.data.blocks[localX][localY].type = mod.newType;
        chunk.data.blocks[localX][localY].hp = mod.newHp;
      }
    }
  }

  private getOrGenerateChunk(chunkY: number): LoadedChunk {
    let loaded = this.chunks.get(chunkY);
    if (loaded) {
      loaded.lastAccessed = Date.now();
      return loaded;
    }

    // Generate new chunk
    const data = generateChunk(this.worldSeed, chunkY);
    loaded = {
      data,
      modifications: [],
      dirty: false,
      lastAccessed: Date.now(),
    };
    this.chunks.set(chunkY, loaded);

    // Evict old chunks if over limit
    this.evictOldChunks();

    return loaded;
  }

  private evictOldChunks(): void {
    if (this.chunks.size <= this.maxCachedChunks) return;

    // Find and remove least recently accessed non-dirty chunks
    const entries = [...this.chunks.entries()]
      .filter(([, c]) => !c.dirty)
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    const toRemove = this.chunks.size - this.maxCachedChunks;
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.chunks.delete(entries[i][0]);
    }
  }

  destroy(): void {
    this.chunks.clear();
  }
}
