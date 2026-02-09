import type { BlockUpdateMessage, BlockDestroyedMessage, PlayerStateUpdateMessage } from '@shared/messages';

interface PendingPrediction {
  seq: number;
  type: 'dig';
  x: number;
  y: number;
  timestamp: number;
  predictedHp: number;
  predictedDestroyed: boolean;
}

/**
 * Client-side prediction engine.
 * Predicts dig results optimistically and reconciles with server responses.
 */
export class Prediction {
  private seq = 0;
  private pendingPredictions: PendingPrediction[] = [];
  private maxPendingAge = 5000; // Discard predictions older than 5s

  nextSeq(): number {
    return ++this.seq;
  }

  /**
   * Record a predicted dig action.
   */
  predictDig(
    seq: number,
    x: number,
    y: number,
    predictedHp: number,
    predictedDestroyed: boolean
  ): void {
    this.pendingPredictions.push({
      seq,
      type: 'dig',
      x,
      y,
      timestamp: Date.now(),
      predictedHp,
      predictedDestroyed,
    });

    // Prune old predictions
    const now = Date.now();
    this.pendingPredictions = this.pendingPredictions.filter(
      p => now - p.timestamp < this.maxPendingAge
    );
  }

  /**
   * Reconcile a block update from the server.
   * Returns correction info if the prediction was wrong.
   */
  reconcileBlockUpdate(msg: BlockUpdateMessage): {
    needsCorrection: boolean;
    predicted?: PendingPrediction;
  } {
    const idx = this.pendingPredictions.findIndex(
      p => p.x === msg.x && p.y === msg.y
    );

    if (idx === -1) {
      // No prediction for this block — apply directly
      return { needsCorrection: false };
    }

    const prediction = this.pendingPredictions[idx];
    this.pendingPredictions.splice(idx, 1);

    // Check if prediction matches server
    if (prediction.predictedHp !== msg.newHp || prediction.predictedDestroyed !== msg.destroyed) {
      return { needsCorrection: true, predicted: prediction };
    }

    return { needsCorrection: false };
  }

  /**
   * Reconcile a block destroyed message.
   */
  reconcileBlockDestroyed(msg: BlockDestroyedMessage): {
    needsCorrection: boolean;
    predicted?: PendingPrediction;
  } {
    const idx = this.pendingPredictions.findIndex(
      p => p.x === msg.x && p.y === msg.y
    );

    if (idx === -1) {
      return { needsCorrection: false };
    }

    const prediction = this.pendingPredictions[idx];
    this.pendingPredictions.splice(idx, 1);

    if (!prediction.predictedDestroyed) {
      // We predicted the block would survive but it was destroyed
      // (e.g., another player helped break it)
      return { needsCorrection: true, predicted: prediction };
    }

    return { needsCorrection: false };
  }

  /**
   * Reconcile a full player state update from the server.
   * Clears all pending predictions as server state is authoritative.
   */
  reconcilePlayerState(_msg: PlayerStateUpdateMessage): void {
    // Server state is authoritative — clear all pending predictions
    this.pendingPredictions = [];
  }

  getPendingCount(): number {
    return this.pendingPredictions.length;
  }

  clear(): void {
    this.pendingPredictions = [];
    this.seq = 0;
  }
}
