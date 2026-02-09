import { BlockType } from '@shared/types';

interface ChunkModification {
  x: number;
  y: number;
  newType: BlockType;
  newHp: number;
}

interface StoredChunk {
  chunkY: number;
  worldSeed: number;
  modifications: ChunkModification[];
  savedAt: number;
}

/**
 * Chunk persistence layer.
 * Saves modified chunks as JSON (in production could use S3).
 * Only stores diffs from generated state for efficiency.
 */
export class ChunkStore {
  // In-memory store for development
  private chunks = new Map<string, StoredChunk>();

  private makeKey(shardId: string, chunkY: number): string {
    return `${shardId}:${chunkY}`;
  }

  async saveChunk(
    shardId: string,
    chunkY: number,
    worldSeed: number,
    modifications: ChunkModification[]
  ): Promise<void> {
    if (modifications.length === 0) return;

    const key = this.makeKey(shardId, chunkY);
    this.chunks.set(key, {
      chunkY,
      worldSeed,
      modifications: [...modifications],
      savedAt: Date.now(),
    });
  }

  async loadChunk(
    shardId: string,
    chunkY: number
  ): Promise<ChunkModification[] | null> {
    const key = this.makeKey(shardId, chunkY);
    const stored = this.chunks.get(key);
    if (!stored) return null;
    return [...stored.modifications];
  }

  async saveMultipleChunks(
    shardId: string,
    chunks: { chunkY: number; worldSeed: number; modifications: ChunkModification[] }[]
  ): Promise<void> {
    for (const chunk of chunks) {
      await this.saveChunk(shardId, chunk.chunkY, chunk.worldSeed, chunk.modifications);
    }
  }

  async loadAllChunksForShard(
    shardId: string
  ): Promise<{ chunkY: number; modifications: ChunkModification[] }[]> {
    const result: { chunkY: number; modifications: ChunkModification[] }[] = [];
    const prefix = `${shardId}:`;

    for (const [key, stored] of this.chunks) {
      if (key.startsWith(prefix)) {
        result.push({
          chunkY: stored.chunkY,
          modifications: [...stored.modifications],
        });
      }
    }

    return result;
  }

  async deleteShardChunks(shardId: string): Promise<void> {
    const prefix = `${shardId}:`;
    for (const key of this.chunks.keys()) {
      if (key.startsWith(prefix)) {
        this.chunks.delete(key);
      }
    }
  }

  getStoredChunkCount(): number {
    return this.chunks.size;
  }
}
